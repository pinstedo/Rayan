import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar } from '../../../components/Calendar';
import { CustomModal } from '../../../components/CustomModal';
import { SalaryPaymentModal } from '../../../components/SalaryPaymentModal';
import { SearchBar } from '../../../components/list';
import { useTheme } from '../../../context/ThemeContext';
import { api } from '../../../services/api'; // Adjust path as needed
import { getDailyWage } from '../../../utils/wages';

type DatePickerField = 'wageStart' | 'wageEnd' | 'advanceStart' | 'advanceEnd';

const formatDateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getCurrentMonthRange = () => {
    const now = new Date();
    return {
        startDate: formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
        endDate: formatDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
};

const isValidDateInput = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00`);
    return !Number.isNaN(parsed.getTime()) && formatDateInput(parsed) === value;
};

const formatReportDate = (value: string) => {
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const parseDateInput = (value: string) => {
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const getRangeLabel = (range: { startDate: string; endDate: string }) => (
    `${formatReportDate(range.startDate)} to ${formatReportDate(range.endDate)}`
);

const toAmount = (value: unknown) => {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
};

const formatCurrencyValue = (value: unknown) => {
    return toAmount(value).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
};

const formatDeductionValue = (value: unknown) => {
    const amount = toAmount(value);
    return amount > 0 ? `-${formatCurrencyValue(amount)}` : formatCurrencyValue(amount);
};

const formatCurrencyHtml = (value: unknown) => `&#8377;${formatCurrencyValue(value)}`;

const formatDeductionCurrencyHtml = (value: unknown) => {
    const amount = toAmount(value);
    return amount > 0 ? `-&#8377;${formatCurrencyValue(amount)}` : `&#8377;${formatCurrencyValue(amount)}`;
};

const formatCountValue = (value: unknown) => {
    const amount = toAmount(value);
    if (Number.isInteger(amount)) return amount.toString();
    return amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const getFoodDeductionAmount = (item: any) => {
    return toAmount(item?.current_food_deduction_amount ?? item?.current_food_given_amount);
};

const escapeHtml = (unsafe: unknown) => {
    return String(unsafe ?? '').replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

const getDailyRateSummaryHtml = (item: any) => {
    const wageBreakdown = Array.isArray(item?.wage_breakdown) ? item.wage_breakdown : [];
    if (wageBreakdown.length === 0) {
        return `<div>${formatCurrencyValue(getDailyWage(item))}</div>`;
    }

    return wageBreakdown.map((breakdown: any) => {
        const attendance = `${formatCountValue(breakdown.fullDays)}F/${formatCountValue(breakdown.halfDays)}H`;
        return `<div>${formatCurrencyValue(getDailyWage(breakdown))} <span class="muted">(${attendance})</span></div>`;
    }).join('');
};

const printReportHtml = async (html: string) => {
    if (Platform.OS === 'web') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const frameDocument = iframe.contentDocument || iframe.contentWindow?.document;
        if (!frameDocument) {
            document.body.removeChild(iframe);
            throw new Error("Unable to prepare PDF report");
        }

        frameDocument.open();
        frameDocument.write(html);
        frameDocument.close();
        iframe.contentWindow?.focus();

        setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => {
                if (iframe.parentNode) {
                    document.body.removeChild(iframe);
                }
            }, 1000);
        }, 250);
        return;
    }

    const { uri } = await Print.printToFileAsync({ html });
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
        throw new Error("PDF generated, but sharing is not available on this device.");
    }

    await Sharing.shareAsync(uri, {
        dialogTitle: "Share Wage Report PDF",
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
    });
};

export default function WageReportScreen() {
    const router = useRouter();
    const { isDark } = useTheme();
    const local = getStyles(isDark);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [reportData, setReportData] = useState<any[]>([]);

    const [generatingPdf, setGeneratingPdf] = useState(false);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedLabour, setSelectedLabour] = useState<any>(null);
    const [searchText, setSearchText] = useState("");

    const initialRange = useMemo(() => getCurrentMonthRange(), []);
    const [draftStartDate, setDraftStartDate] = useState(initialRange.startDate);
    const [draftEndDate, setDraftEndDate] = useState(initialRange.endDate);
    const [draftAdvanceStartDate, setDraftAdvanceStartDate] = useState(initialRange.startDate);
    const [draftAdvanceEndDate, setDraftAdvanceEndDate] = useState(initialRange.endDate);
    const [reportRange, setReportRange] = useState(initialRange);
    const [advanceRange, setAdvanceRange] = useState(initialRange);
    const [activeDatePicker, setActiveDatePicker] = useState<DatePickerField | null>(null);

    const reportPayload = useMemo(() => ({
        startDate: reportRange.startDate,
        endDate: reportRange.endDate,
        advanceStartDate: advanceRange.startDate,
        advanceEndDate: advanceRange.endDate,
    }), [reportRange, advanceRange]);
    const reportReference = `${reportRange.startDate}_${reportRange.endDate}`;
    const reportPeriodLabel = getRangeLabel(reportRange);
    const advancePeriodLabel = getRangeLabel(advanceRange);

    useEffect(() => {
        fetchReport();
    }, [reportRange.startDate, reportRange.endDate, advanceRange.startDate, advanceRange.endDate]);

    const fetchReport = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            const res = await api.post(`/reports/wage-month`, reportPayload);
            const data = await res.json();
            if (res.ok) {
                setReportData(data);
            } else {
                Alert.alert("Error", data.error || "Failed to fetch report");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Network request failed");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        fetchReport(true);
    };

    const getDraftDateValue = (field: DatePickerField) => {
        switch (field) {
            case 'wageStart':
                return draftStartDate;
            case 'wageEnd':
                return draftEndDate;
            case 'advanceStart':
                return draftAdvanceStartDate;
            case 'advanceEnd':
                return draftAdvanceEndDate;
            default:
                return draftStartDate;
        }
    };

    const setDraftDateValue = (field: DatePickerField, value: string) => {
        switch (field) {
            case 'wageStart':
                setDraftStartDate(value);
                break;
            case 'wageEnd':
                setDraftEndDate(value);
                break;
            case 'advanceStart':
                setDraftAdvanceStartDate(value);
                break;
            case 'advanceEnd':
                setDraftAdvanceEndDate(value);
                break;
        }
    };

    const getDatePickerTitle = () => {
        switch (activeDatePicker) {
            case 'wageStart':
                return "Select Wage From Date";
            case 'wageEnd':
                return "Select Wage To Date";
            case 'advanceStart':
                return "Select Advance From Date";
            case 'advanceEnd':
                return "Select Advance To Date";
            default:
                return "Select Date";
        }
    };

    const handleDraftDateSelect = (date: Date) => {
        if (!activeDatePicker) return;
        setDraftDateValue(activeDatePicker, formatDateInput(date));
        setActiveDatePicker(null);
    };

    const activeDatePickerValue = activeDatePicker
        ? parseDateInput(getDraftDateValue(activeDatePicker))
        : parseDateInput(draftStartDate);

    const applyDateRange = () => {
        if (!isValidDateInput(draftStartDate) || !isValidDateInput(draftEndDate)) {
            Alert.alert("Invalid Wage Dates", "Please enter wage dates in YYYY-MM-DD format.");
            return;
        }

        if (!isValidDateInput(draftAdvanceStartDate) || !isValidDateInput(draftAdvanceEndDate)) {
            Alert.alert("Invalid Advance Dates", "Please enter advance dates in YYYY-MM-DD format.");
            return;
        }

        if (draftStartDate > draftEndDate) {
            Alert.alert("Invalid Wage Range", "Wage From date cannot be after Wage To date.");
            return;
        }

        if (draftAdvanceStartDate > draftAdvanceEndDate) {
            Alert.alert("Invalid Advance Range", "Advance From date cannot be after Advance To date.");
            return;
        }

        setReportRange({ startDate: draftStartDate, endDate: draftEndDate });
        setAdvanceRange({ startDate: draftAdvanceStartDate, endDate: draftAdvanceEndDate });
    };

    const generateSummaryPDF = async () => {
        if (generatingPdf) return;
        setGeneratingPdf(true);

        try {
            let pdfData = Array.isArray(reportData) ? [...reportData] : [];

            if (pdfData.length === 0) {
                const res = await api.post(`/reports/wage-month`, reportPayload);
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Failed to fetch data for PDF");
                }

                pdfData = Array.isArray(data) ? [...data] : [];
                if (Array.isArray(data)) {
                    setReportData(data);
                }
            }

            if (pdfData.length === 0) {
                Alert.alert("No Data", "No data to generate report");
                return;
            }

            pdfData.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

            const totals = pdfData.reduce((acc: any, curr: any) => ({
                labours: acc.labours + 1,
                fullDays: acc.fullDays + toAmount(curr.current_full_days),
                halfDays: acc.halfDays + toAmount(curr.current_half_days),
                wage: acc.wage + toAmount(curr.current_wage),
                ot: acc.ot + toAmount(curr.current_overtime_amount),
                food: acc.food + toAmount(curr.current_food_allowance_amount),
                foodDeduction: acc.foodDeduction + getFoodDeductionAmount(curr),
                adv: acc.adv + toAmount(curr.current_advance_amount),
                prev: acc.prev + toAmount(curr.previous_balance),
                net: acc.net + toAmount(curr.current_net_payable),
                paid: acc.paid + toAmount(curr.salary_paid),
                total: acc.total + toAmount(curr.total_payable),
                closing: acc.closing + toAmount(curr.closing_balance)
            }), { labours: 0, fullDays: 0, halfDays: 0, wage: 0, ot: 0, food: 0, foodDeduction: 0, adv: 0, prev: 0, net: 0, paid: 0, total: 0, closing: 0 });

            const generatedAt = new Date().toLocaleString(undefined, {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            if (Platform.OS !== 'web') {
                const html = `
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="utf-8" />
                        <meta name="viewport" content="width=device-width, initial-scale=1" />
                        <style>
                            @page { size: A4 portrait; margin: 12mm; }
                            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            body {
                                margin: 0;
                                background: #ffffff;
                                color: #17202a;
                                font-family: Arial, Helvetica, sans-serif;
                                font-size: 11px;
                                line-height: 1.35;
                            }
                            .header {
                                border-bottom: 2px solid #243b53;
                                padding-bottom: 10px;
                                margin-bottom: 10px;
                            }
                            .eyebrow {
                                margin: 0 0 3px;
                                color: #52606d;
                                font-size: 10px;
                                font-weight: 700;
                                text-transform: uppercase;
                            }
                            h1 {
                                margin: 0 0 8px;
                                color: #102a43;
                                font-size: 22px;
                                line-height: 1.1;
                            }
                            .period-grid {
                                display: grid;
                                grid-template-columns: 1fr 1fr;
                                gap: 6px;
                            }
                            .period {
                                border: 1px solid #bcccdc;
                                border-radius: 4px;
                                padding: 6px;
                            }
                            .period-label {
                                color: #52606d;
                                font-size: 9px;
                                font-weight: 700;
                                text-transform: uppercase;
                            }
                            .period-value {
                                margin-top: 2px;
                                color: #102a43;
                                font-weight: 700;
                            }
                            .summary-grid {
                                display: grid;
                                grid-template-columns: 1fr 1fr;
                                gap: 6px;
                                margin: 10px 0;
                            }
                            .metric {
                                border: 1px solid #d9e2ec;
                                border-left: 3px solid #0a84ff;
                                border-radius: 4px;
                                background: #f8fafc;
                                padding: 7px;
                            }
                            .metric-label {
                                color: #52606d;
                                font-size: 9px;
                                font-weight: 700;
                                text-transform: uppercase;
                            }
                            .metric-value {
                                margin-top: 3px;
                                color: #102a43;
                                font-size: 14px;
                                font-weight: 800;
                            }
                            .section-title {
                                margin: 12px 0 6px;
                                color: #102a43;
                                font-size: 14px;
                                font-weight: 800;
                            }
                            .labour {
                                border: 1px solid #bcccdc;
                                border-left: 4px solid #0a84ff;
                                border-radius: 5px;
                                margin-bottom: 8px;
                                page-break-inside: avoid;
                                overflow: hidden;
                            }
                            .labour-head {
                                display: flex;
                                justify-content: space-between;
                                gap: 8px;
                                background: #f8fafc;
                                padding: 7px;
                                border-bottom: 1px solid #d9e2ec;
                            }
                            .labour-name {
                                color: #102a43;
                                font-size: 13px;
                                font-weight: 800;
                            }
                            .payable {
                                color: #0b4f8a;
                                font-weight: 800;
                                text-align: right;
                                white-space: nowrap;
                            }
                            .detail-grid {
                                display: grid;
                                grid-template-columns: 1fr 1fr 1fr;
                            }
                            .detail {
                                min-height: 34px;
                                padding: 6px 7px;
                                border-right: 1px solid #d9e2ec;
                                border-bottom: 1px solid #d9e2ec;
                            }
                            .detail:nth-child(3n) { border-right: 0; }
                            .detail-label {
                                color: #627d98;
                                font-size: 8.5px;
                                font-weight: 700;
                                text-transform: uppercase;
                            }
                            .detail-value {
                                margin-top: 2px;
                                color: #17202a;
                                font-weight: 800;
                            }
                            .deduct { color: #b42318; }
                            .paid { color: #1f7a3f; }
                            .closing { color: #8a4b00; }
                            .notes {
                                margin-top: 10px;
                                color: #52606d;
                                font-size: 9px;
                            }
                            .generated {
                                margin-top: 8px;
                                color: #627d98;
                                font-size: 8.5px;
                                text-align: right;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <p class="eyebrow">Rayan Labour Management</p>
                            <h1>Labour Wage Summary</h1>
                            <div class="period-grid">
                                <div class="period">
                                    <div class="period-label">Wage Period</div>
                                    <div class="period-value">${escapeHtml(reportPeriodLabel)}</div>
                                </div>
                                <div class="period">
                                    <div class="period-label">Advance Period</div>
                                    <div class="period-value">${escapeHtml(advancePeriodLabel)}</div>
                                </div>
                            </div>
                        </div>

                        <div class="summary-grid">
                            <div class="metric">
                                <div class="metric-label">Labours</div>
                                <div class="metric-value">${totals.labours}</div>
                            </div>
                            <div class="metric">
                                <div class="metric-label">Attendance</div>
                                <div class="metric-value">${formatCountValue(totals.fullDays)} F / ${formatCountValue(totals.halfDays)} H</div>
                            </div>
                            <div class="metric">
                                <div class="metric-label">Current Net</div>
                                <div class="metric-value">${formatCurrencyHtml(totals.net)}</div>
                            </div>
                            <div class="metric">
                                <div class="metric-label">Total Payable</div>
                                <div class="metric-value">${formatCurrencyHtml(totals.total)}</div>
                            </div>
                            <div class="metric">
                                <div class="metric-label">Salary Paid</div>
                                <div class="metric-value">${formatCurrencyHtml(totals.paid)}</div>
                            </div>
                            <div class="metric">
                                <div class="metric-label">Closing Balance</div>
                                <div class="metric-value">${formatCurrencyHtml(totals.closing)}</div>
                            </div>
                        </div>

                        <div class="section-title">Labour Details</div>
                        ${pdfData.map((item: any, index: number) => `
                            <div class="labour">
                                <div class="labour-head">
                                    <div class="labour-name">${index + 1}. ${escapeHtml(item.name)}</div>
                                    <div class="payable">${formatCurrencyHtml(item.total_payable)}</div>
                                </div>
                                <div class="detail-grid">
                                    <div class="detail">
                                        <div class="detail-label">Rate / Day</div>
                                        <div class="detail-value">${getDailyRateSummaryHtml(item)}</div>
                                    </div>
                                    <div class="detail">
                                        <div class="detail-label">Attendance</div>
                                        <div class="detail-value">${formatCountValue(item.current_full_days)} F / ${formatCountValue(item.current_half_days)} H</div>
                                    </div>
                                    <div class="detail">
                                        <div class="detail-label">Wage</div>
                                        <div class="detail-value">${formatCurrencyHtml(item.current_wage)}</div>
                                    </div>
                                    <div class="detail">
                                        <div class="detail-label">OT</div>
                                        <div class="detail-value">${formatCurrencyHtml(item.current_overtime_amount)}</div>
                                    </div>
                                    <div class="detail">
                                        <div class="detail-label">Food Allow</div>
                                        <div class="detail-value">${formatCurrencyHtml(item.current_food_allowance_amount)}</div>
                                    </div>
                                    <div class="detail">
                                        <div class="detail-label">Food Given</div>
                                        <div class="detail-value deduct">${formatDeductionCurrencyHtml(getFoodDeductionAmount(item))}</div>
                                    </div>
                                    <div class="detail">
                                        <div class="detail-label">Advance</div>
                                        <div class="detail-value deduct">${formatDeductionCurrencyHtml(item.current_advance_amount)}</div>
                                    </div>
                                    <div class="detail">
                                        <div class="detail-label">Previous Bal</div>
                                        <div class="detail-value">${formatCurrencyHtml(item.previous_balance)}</div>
                                    </div>
                                    <div class="detail">
                                        <div class="detail-label">Current Net</div>
                                        <div class="detail-value">${formatCurrencyHtml(item.current_net_payable)}</div>
                                    </div>
                                    <div class="detail">
                                        <div class="detail-label">Paid</div>
                                        <div class="detail-value paid">${formatCurrencyHtml(item.salary_paid)}</div>
                                    </div>
                                    <div class="detail">
                                        <div class="detail-label">Closing</div>
                                        <div class="detail-value closing">${formatCurrencyHtml(item.closing_balance)}</div>
                                    </div>
                                    <div class="detail">
                                        <div class="detail-label">Total Payable</div>
                                        <div class="detail-value">${formatCurrencyHtml(item.total_payable)}</div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}

                        <div class="notes">
                            Current Net = wage + overtime + food allowance - food given - advances.
                            Previous Balance includes opening balance and unpaid wage activity before the wage period.
                        </div>
                        <div class="generated">Generated on ${escapeHtml(generatedAt)}</div>
                    </body>
                </html>
                `;

                await printReportHtml(html);
                return;
            }

            const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8" />
                    <style>
                        @page { size: A4 landscape; margin: 10mm; }
                        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        body {
                            margin: 0;
                            font-family: Arial, Helvetica, sans-serif;
                            background: #ffffff;
                            color: #17202a;
                            font-size: 10px;
                        }
                        .report-page { width: 100%; }
                        .report-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            border-bottom: 2px solid #243b53;
                            padding-bottom: 8px;
                            margin-bottom: 10px;
                        }
                        .eyebrow {
                            margin: 0 0 3px;
                            color: #52606d;
                            font-size: 10px;
                            font-weight: 700;
                            text-transform: uppercase;
                        }
                        h1 {
                            margin: 0;
                            color: #102a43;
                            font-size: 22px;
                            line-height: 1.1;
                        }
                        .periods {
                            min-width: 260px;
                            border: 1px solid #bcccdc;
                            border-radius: 4px;
                            overflow: hidden;
                        }
                        .period-row {
                            display: flex;
                            justify-content: space-between;
                            gap: 16px;
                            padding: 5px 7px;
                            border-bottom: 1px solid #d9e2ec;
                        }
                        .period-row:last-child { border-bottom: 0; }
                        .period-label { color: #52606d; font-weight: 700; }
                        .period-value { color: #102a43; font-weight: 700; text-align: right; }
                        .summary-grid {
                            display: grid;
                            grid-template-columns: repeat(6, 1fr);
                            gap: 6px;
                            margin: 0 0 10px;
                        }
                        .metric {
                            border: 1px solid #d9e2ec;
                            border-left: 3px solid #0a84ff;
                            border-radius: 4px;
                            background: #f8fafc;
                            padding: 6px;
                        }
                        .metric-label {
                            color: #52606d;
                            font-size: 8px;
                            font-weight: 700;
                            text-transform: uppercase;
                        }
                        .metric-value {
                            margin-top: 3px;
                            color: #102a43;
                            font-size: 12px;
                            font-weight: 800;
                            line-height: 1.15;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            table-layout: fixed;
                        }
                        thead { display: table-header-group; }
                        tfoot { display: table-row-group; }
                        tr { page-break-inside: avoid; }
                        th, td {
                            border: 1px solid #bcccdc;
                            padding: 4px 5px;
                            vertical-align: top;
                        }
                        th {
                            background: #243b53;
                            color: #ffffff;
                            font-size: 8px;
                            font-weight: 800;
                            text-transform: uppercase;
                        }
                        td {
                            color: #17202a;
                            font-size: 8.5px;
                            line-height: 1.25;
                        }
                        tbody tr:nth-child(even) td { background: #f8fafc; }
                        tfoot td {
                            background: #e6f0ff;
                            color: #102a43;
                            font-weight: 800;
                        }
                        .name {
                            color: #102a43;
                            font-weight: 800;
                            word-break: break-word;
                        }
                        .center { text-align: center; }
                        .num {
                            text-align: right;
                            white-space: nowrap;
                            font-variant-numeric: tabular-nums;
                        }
                        .muted { color: #627d98; font-weight: 600; }
                        .deduct { color: #b42318; }
                        .paid { color: #1f7a3f; }
                        .total-col {
                            background: #eef7ff !important;
                            color: #0b4f8a;
                            font-weight: 800;
                        }
                        .closing-col {
                            background: #fff8e5 !important;
                            color: #8a4b00;
                            font-weight: 800;
                        }
                        .notes {
                            margin-top: 8px;
                            color: #52606d;
                            font-size: 8.5px;
                            line-height: 1.35;
                        }
                        .generated {
                            margin-top: 6px;
                            color: #627d98;
                            font-size: 8px;
                            text-align: right;
                        }
                    </style>
                </head>
                <body>
                    <div class="report-page">
                        <div class="report-header">
                            <div>
                                <p class="eyebrow">Rayan Labour Management</p>
                                <h1>Labour Wage Summary</h1>
                            </div>
                            <div class="periods">
                                <div class="period-row">
                                    <span class="period-label">Wage Period</span>
                                    <span class="period-value">${escapeHtml(reportPeriodLabel)}</span>
                                </div>
                                <div class="period-row">
                                    <span class="period-label">Advance Period</span>
                                    <span class="period-value">${escapeHtml(advancePeriodLabel)}</span>
                                </div>
                            </div>
                        </div>

                        <div class="summary-grid">
                            <div class="metric">
                                <div class="metric-label">Labours</div>
                                <div class="metric-value">${totals.labours}</div>
                            </div>
                            <div class="metric">
                                <div class="metric-label">Attendance</div>
                                <div class="metric-value">${formatCountValue(totals.fullDays)} F / ${formatCountValue(totals.halfDays)} H</div>
                            </div>
                            <div class="metric">
                                <div class="metric-label">Current Net</div>
                                <div class="metric-value">&#8377;${formatCurrencyValue(totals.net)}</div>
                            </div>
                            <div class="metric">
                                <div class="metric-label">Total Payable</div>
                                <div class="metric-value">&#8377;${formatCurrencyValue(totals.total)}</div>
                            </div>
                            <div class="metric">
                                <div class="metric-label">Salary Paid</div>
                                <div class="metric-value">&#8377;${formatCurrencyValue(totals.paid)}</div>
                            </div>
                            <div class="metric">
                                <div class="metric-label">Closing Balance</div>
                                <div class="metric-value">&#8377;${formatCurrencyValue(totals.closing)}</div>
                            </div>
                        </div>

                        <table>
                            <colgroup>
                                <col style="width: 3%;" />
                                <col style="width: 14%;" />
                                <col style="width: 7%;" />
                                <col style="width: 4%;" />
                                <col style="width: 4%;" />
                                <col style="width: 7%;" />
                                <col style="width: 5%;" />
                                <col style="width: 6%;" />
                                <col style="width: 6%;" />
                                <col style="width: 7%;" />
                                <col style="width: 7%;" />
                                <col style="width: 7%;" />
                                <col style="width: 7%;" />
                                <col style="width: 8%;" />
                                <col style="width: 8%;" />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>Labour</th>
                                    <th>Rate / Day</th>
                                    <th>Full</th>
                                    <th>Half</th>
                                    <th>Wage</th>
                                    <th>OT</th>
                                    <th>Food Allow</th>
                                    <th>Food Given</th>
                                    <th>Advance</th>
                                    <th>Prev Bal</th>
                                    <th>Current Net</th>
                                    <th>Paid</th>
                                    <th>Total Payable</th>
                                    <th>Closing</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${pdfData.map((item: any, index: number) => `
                                    <tr>
                                        <td class="center">${index + 1}</td>
                                        <td class="name">${escapeHtml(item.name)}</td>
                                        <td class="num">${getDailyRateSummaryHtml(item)}</td>
                                        <td class="center">${formatCountValue(item.current_full_days)}</td>
                                        <td class="center">${formatCountValue(item.current_half_days)}</td>
                                        <td class="num">${formatCurrencyValue(item.current_wage)}</td>
                                        <td class="num">${formatCurrencyValue(item.current_overtime_amount)}</td>
                                        <td class="num">${formatCurrencyValue(item.current_food_allowance_amount)}</td>
                                        <td class="num deduct">${formatDeductionValue(getFoodDeductionAmount(item))}</td>
                                        <td class="num deduct">${formatDeductionValue(item.current_advance_amount)}</td>
                                        <td class="num">${formatCurrencyValue(item.previous_balance)}</td>
                                        <td class="num">${formatCurrencyValue(item.current_net_payable)}</td>
                                        <td class="num paid">${formatCurrencyValue(item.salary_paid)}</td>
                                        <td class="num total-col">${formatCurrencyValue(item.total_payable)}</td>
                                        <td class="num closing-col">${formatCurrencyValue(item.closing_balance)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="3">Totals</td>
                                    <td class="center">${formatCountValue(totals.fullDays)}</td>
                                    <td class="center">${formatCountValue(totals.halfDays)}</td>
                                    <td class="num">${formatCurrencyValue(totals.wage)}</td>
                                    <td class="num">${formatCurrencyValue(totals.ot)}</td>
                                    <td class="num">${formatCurrencyValue(totals.food)}</td>
                                    <td class="num deduct">${formatDeductionValue(totals.foodDeduction)}</td>
                                    <td class="num deduct">${formatDeductionValue(totals.adv)}</td>
                                    <td class="num">${formatCurrencyValue(totals.prev)}</td>
                                    <td class="num">${formatCurrencyValue(totals.net)}</td>
                                    <td class="num">${formatCurrencyValue(totals.paid)}</td>
                                    <td class="num">${formatCurrencyValue(totals.total)}</td>
                                    <td class="num">${formatCurrencyValue(totals.closing)}</td>
                                </tr>
                            </tfoot>
                        </table>

                        <div class="notes">
                            Current Net = wage + overtime + food allowance - food given - advances for the selected periods.
                            Previous Balance includes opening balance and unpaid wage activity before the wage period.
                        </div>
                        <div class="generated">Generated on ${escapeHtml(generatedAt)}</div>
                    </div>
                </body>
            </html>
            `;

            await printReportHtml(html);

        } catch (error: any) {
            if (error.message?.includes("not complete") || error.message?.includes("cancel")) {
                console.log("Print cancelled or not completed");
                return;
            }
            console.error("Print Error:", error);
            Alert.alert("Error", error.message || "Failed to generate PDF. Please try again.");
        } finally {
            setGeneratingPdf(false);
        }
    };

    const generateIndividualBillsPDF = async (specificData?: any[]) => {
        if (generatingPdf) return;
        setGeneratingPdf(true);

        try {
            let pdfData: any = Array.isArray(specificData) ? specificData : null;
            if (!pdfData) {
                const res = await api.post(`/reports/wage-month`, reportPayload);
                pdfData = await res.json();

                if (!res.ok) {
                    throw new Error(pdfData.error || "Failed to fetch data for PDF");
                }
            }

            if (!Array.isArray(pdfData) || pdfData.length === 0) {
                Alert.alert("No Data", "No data to generate bills");
                return;
            }

            pdfData.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

            const escapeHtml = (unsafe: string) => {
                return (unsafe || '').replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            };

            const html = `
            <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                    <style>
                        body { font-family: 'Helvetica', sans-serif; }
                        .bill-page { page-break-after: always; padding: 30px; border: 1px solid #ccc; margin: 20px; box-sizing: border-box; }
                        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
                        .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
                        .header p { margin: 5px 0 0; color: #555; font-size: 14px; }
                        
                        .info-section { margin-bottom: 20px; }
                        .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
                        .info-label { font-weight: bold; color: #555; }
                        .info-value { font-weight: bold; color: #000; }
    
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f8f8f8; font-weight: bold; color: #333; }
                        td.amount { text-align: right; font-family: 'Courier New', monospace; font-weight: bold; }
                        
                        .total-section { margin-top: 20px; border-top: 2px solid #333; padding-top: 10px; }
                        .total-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
                        .total-label { font-size: 16px; font-weight: bold; color: #333; }
                        .total-amount { font-size: 20px; font-weight: bold; color: #000; }
    
                        .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
                        
                        /* Utility for text colors */
                        .text-red { color: #d32f2f; }
                        .text-green { color: #388e3c; }
                    </style>
                </head>
                <body>
                    ${pdfData.map((item: any) => {
                const dailyRate = getDailyWage(item);
                const grossWage = item.current_wage || 0;
                const otAmount = item.current_overtime_amount || 0;
                const foodAmount = item.current_food_allowance_amount || 0;
                const foodDeductionAmount = getFoodDeductionAmount(item);
                const advances = item.current_advance_amount || 0;
                const prevBal = item.previous_balance || 0;
                const netPayable = item.total_payable || 0;
                const currentNet = item.current_net_payable || 0;

                let rateHtml = '';
                let attendanceHtml = '';
                let basicWageRowsHtml = '';

                if (item.wage_breakdown && item.wage_breakdown.length > 0) {
                    rateHtml = item.wage_breakdown.map((wb: any) => `₹${formatCurrency(getDailyWage(wb))}/day`).join(' & ');

                    if (item.wage_breakdown.length > 1) {
                        attendanceHtml = item.wage_breakdown.map((wb: any) =>
                            `<div><span class="info-value">${wb.fullDays} F, ${wb.halfDays} H (@ ₹${formatCurrency(getDailyWage(wb))})</span></div>`
                        ).join('');

                        basicWageRowsHtml = item.wage_breakdown.map((wb: any) => `
                                    <tr>
                                        <td>Basic Wage (Rate: ₹${formatCurrency(getDailyWage(wb))}/day)</td>
                                        <td class="amount">${formatCurrency(wb.wage)}</td>
                                    </tr>
                         `).join('');
                    } else {
                        attendanceHtml = `<div><span class="info-value">${item.current_full_days} Full Days</span>, <span class="info-value">${item.current_half_days} Half Days</span></div>`;
                        basicWageRowsHtml = `
                                    <tr>
                                        <td>Basic Wage</td>
                                        <td class="amount">${formatCurrency(grossWage)}</td>
                                    </tr>`;
                    }
                } else {
                    rateHtml = `₹${formatCurrency(dailyRate)}/day`;
                    attendanceHtml = `<div><span class="info-value">${item.current_full_days} Full Days</span>, <span class="info-value">${item.current_half_days} Half Days</span></div>`;
                    basicWageRowsHtml = `
                                    <tr>
                                        <td>Basic Wage</td>
                                        <td class="amount">${formatCurrency(grossWage)}</td>
                                    </tr>`;
                }

                return `
                        <div class="bill-page">
                            <div class="header">
                                <h1>Salary Bill</h1>
                                <p>Wage Period: ${reportPeriodLabel}</p>
                                <p>Advance Period: ${advancePeriodLabel}</p>
                            </div>
    
                            <div class="info-section">
                                <div class="info-row">
                                    <span class="info-label">Employee Name:</span>
                                    <span class="info-value" style="font-size: 16px; text-transform: uppercase;">${escapeHtml(item.name)}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Rate per Day:</span>
                                    <span class="info-value">${rateHtml}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Attendance:</span>
                                    <div style="text-align: right;">
                                        ${attendanceHtml}
                                    </div>
                                </div>
                            </div>
    
                            <table>
                                <thead>
                                    <tr>
                                        <th width="60%">Description</th>
                                        <th width="40%" style="text-align: right;">Amount (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${basicWageRowsHtml}
                                    ${otAmount > 0 ? `
                                    <tr>
                                        <td>Overtime</td>
                                        <td class="amount">${formatCurrency(otAmount)}</td>
                                    </tr>` : ''}
                                    ${foodAmount > 0 ? `
                                    <tr>
                                        <td>Food Allowance</td>
                                        <td class="amount">${formatCurrency(foodAmount)}</td>
                                    </tr>` : ''}
                                    ${foodDeductionAmount > 0 ? `
                                    <tr style="background-color: #fff9f9;">
                                        <td>Less: Food Given</td>
                                        <td class="amount text-red">-${formatCurrency(foodDeductionAmount)}</td>
                                    </tr>` : ''}
                                    
                                    <tr style="background-color: #fff9f9;">
                                        <td>Less: Advances</td>
                                        <td class="amount text-red">-${formatCurrency(advances)}</td>
                                    </tr>
    
                                    <tr style="background-color: #f0f8ff;">
                                        <td><strong>Net Payable (Current Month)</strong></td>
                                        <td class="amount"><strong>${formatCurrency(currentNet)}</strong></td>
                                    </tr>
                                    
                                    <tr>
                                        <td>Previous Balance</td>
                                        <td class="amount">${formatCurrency(prevBal)}</td>
                                    </tr>
                                </tbody>
                            </table>
    
                            <div class="total-section">
                                <div class="total-row">
                                    <span class="total-label">Total Net Payable</span>
                                    <span class="total-amount">₹${formatCurrency(netPayable)}</span>
                                </div>
                                <div class="total-row" style="margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 5px;">
                                    <span class="info-label">Salary Paid this Month</span>
                                    <span class="total-amount text-green">₹${formatCurrency(item.salary_paid || 0)}</span>
                                </div>
                                <div class="total-row" style="margin-top: 5px; border-top: 1px dashed #ccc; padding-top: 5px;">
                                    <span class="total-label">Closing Balance</span>
                                    <span class="total-amount">₹${formatCurrency(item.closing_balance || 0)}</span>
                                </div>
                            </div>
    
                            <div style="margin-top: 60px; display: flex; justify-content: space-between; padding: 0 20px;">
                                <div style="text-align: center; border-top: 1px solid #ccc; width: 150px; padding-top: 5px;">
                                    <small>Accountant</small>
                                </div>
                                <div style="text-align: center; border-top: 1px solid #ccc; width: 150px; padding-top: 5px;">
                                    <small>Receiver's Signature</small>
                                </div>
                            </div>
    
                            <div class="footer">
                                Generated on ${new Date().toLocaleDateString()}
                            </div>
                        </div>
                        `;
            }).join('')}
                </body>
            </html>
            `;

            await printReportHtml(html);

        } catch (error: any) {
            if (error.message?.includes("not complete") || error.message?.includes("cancel")) {
                console.log("Print cancelled or not completed");
                return;
            }
            console.error("Print Error:", error);
            Alert.alert("Error", error.message || "Failed to generate PDF. Please try again.");
        } finally {
            setGeneratingPdf(false);
        }
    };

    const formatCurrency = (val: number | undefined) => {
        return (val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    };

    const filteredAndSortedData = useMemo(() => {
        let filtered = Array.isArray(reportData) ? reportData : [];
        if (searchText) {
            filtered = filtered.filter(item =>
                (item.name || '').toLowerCase().includes(searchText.toLowerCase())
            );
        }
        return [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [reportData, searchText]);

    return (
        <View style={local.container}>
            <View style={local.headerRow}>
                <TouchableOpacity onPress={() => router.back()} style={local.backBtn}>
                    <Text style={local.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={local.headerTitle}>Wage Reports</Text>
                <View style={{ width: 50 }} />
            </View>

            <View style={local.controls}>
                <View style={local.datePeriodBlock}>
                    <View style={local.dateRangeHeader}>
                        <View>
                            <Text style={local.dateRangeTitle}>Wage Period</Text>
                            <Text style={local.dateHelperText}>{reportPeriodLabel}</Text>
                        </View>
                        <MaterialIcons name="date-range" size={24} color={isDark ? "#4da6ff" : "#0a84ff"} />
                    </View>
                    <View style={local.dateInputGrid}>
                        <View style={local.dateField}>
                            <Text style={local.dateLabel}>From Date</Text>
                            <TouchableOpacity
                                style={local.dateInput}
                                onPress={() => setActiveDatePicker('wageStart')}
                            >
                                <Text style={local.dateInputText}>{formatReportDate(draftStartDate)}</Text>
                                <MaterialIcons name="calendar-today" size={18} color={isDark ? "#aaa" : "#666"} />
                            </TouchableOpacity>
                        </View>
                        <View style={local.dateField}>
                            <Text style={local.dateLabel}>To Date</Text>
                            <TouchableOpacity
                                style={local.dateInput}
                                onPress={() => setActiveDatePicker('wageEnd')}
                            >
                                <Text style={local.dateInputText}>{formatReportDate(draftEndDate)}</Text>
                                <MaterialIcons name="calendar-today" size={18} color={isDark ? "#aaa" : "#666"} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View style={local.periodDivider} />

                <View style={local.datePeriodBlock}>
                    <View style={local.dateRangeHeader}>
                        <View>
                            <Text style={local.dateRangeTitle}>Advance Period</Text>
                            <Text style={local.dateHelperText}>{advancePeriodLabel}</Text>
                        </View>
                        <MaterialIcons name="payments" size={24} color={isDark ? "#4da6ff" : "#0a84ff"} />
                    </View>
                    <View style={local.dateInputGrid}>
                        <View style={local.dateField}>
                            <Text style={local.dateLabel}>From Date</Text>
                            <TouchableOpacity
                                style={local.dateInput}
                                onPress={() => setActiveDatePicker('advanceStart')}
                            >
                                <Text style={local.dateInputText}>{formatReportDate(draftAdvanceStartDate)}</Text>
                                <MaterialIcons name="calendar-today" size={18} color={isDark ? "#aaa" : "#666"} />
                            </TouchableOpacity>
                        </View>
                        <View style={local.dateField}>
                            <Text style={local.dateLabel}>To Date</Text>
                            <TouchableOpacity
                                style={local.dateInput}
                                onPress={() => setActiveDatePicker('advanceEnd')}
                            >
                                <Text style={local.dateInputText}>{formatReportDate(draftAdvanceEndDate)}</Text>
                                <MaterialIcons name="calendar-today" size={18} color={isDark ? "#aaa" : "#666"} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <TouchableOpacity style={local.applyRangeBtn} onPress={applyDateRange}>
                    <MaterialIcons name="check" size={18} color="#fff" />
                    <Text style={local.applyRangeText}>Apply</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#0a84ff" style={{ marginTop: 20 }} />
            ) : (
                <ScrollView
                    contentContainerStyle={local.content}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0a84ff']} />
                    }
                >
                    <View style={local.summaryCard}>
                        <Text style={local.summaryTitle}>Date Range Summary</Text>
                        <View style={local.row}>
                            <Text style={local.label}>Total Payable:</Text>
                            <Text style={local.value}>
                                ₹{formatCurrency((Array.isArray(reportData) ? reportData : []).reduce((sum, item) => sum + (item.total_payable || 0), 0))}
                            </Text>
                        </View>
                        <View style={local.row}>
                            <Text style={local.label}>Selected Range Net:</Text>
                            <Text style={local.vVal}>
                                ₹{formatCurrency((Array.isArray(reportData) ? reportData : []).reduce((sum, item) => sum + (item.current_net_payable || 0), 0))}
                            </Text>
                        </View>
                        <View style={local.row}>
                            <Text style={local.label}>Total Labours:</Text>
                            <Text style={local.vVal}>{(Array.isArray(reportData) ? reportData : []).length}</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[local.pdfBtn, generatingPdf && local.disabledBtn]}
                        onPress={generateSummaryPDF}
                        disabled={generatingPdf}
                    >
                        {generatingPdf ? (
                            <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />
                        ) : (
                            <MaterialIcons name="print" size={24} color="#fff" />
                        )}
                        <Text style={local.btnText}>
                            {generatingPdf ? "Generating..." : "Generate Summary PDF"}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[local.pdfBtn, local.secondaryBtn, generatingPdf && local.disabledBtn]}
                        onPress={() => generateIndividualBillsPDF()}
                        disabled={generatingPdf}
                    >
                        {generatingPdf ? (
                            <ActivityIndicator color={isDark ? "#4da6ff" : "#0a84ff"} style={{ marginRight: 10 }} />
                        ) : (
                            <MaterialIcons name="print" size={24} color={isDark ? "#4da6ff" : "#0a84ff"} />
                        )}
                        <Text style={[local.btnText, { color: isDark ? '#4da6ff' : '#0a84ff' }]}>
                            {generatingPdf ? "Generating..." : "Generate Individual Bills PDF"}
                        </Text>
                    </TouchableOpacity>

                    <Text style={local.note}>
                        * Wages are paid on the 10th of each month.
                        * Report includes previous wage balance before the wage from date and previous advances before the advance from date.
                    </Text>

                    <Text style={[local.summaryTitle, { marginTop: 20 }]}>Labour Details</Text>

                    <View style={{ marginBottom: 15 }}>
                        <SearchBar
                            value={searchText}
                            onChangeText={setSearchText}
                            placeholder="Search labour name..."
                        />
                    </View>

                    {filteredAndSortedData.map((item, index) => (
                        <TouchableOpacity
                            key={item.id.toString() + index}
                            style={local.labourCard}
                            onPress={() => generateIndividualBillsPDF([item])}
                        >
                            <View style={local.labourRow}>
                                <Text style={local.labourName}>{item.name}</Text>
                                <View style={local.balanceBadge}>
                                    <Text style={local.balanceLabel}>Payable</Text>
                                    <Text style={local.balanceValue}>₹{formatCurrency(item.total_payable)}</Text>
                                </View>
                            </View>
                            <View style={[local.labourRow, { marginTop: 10 }]}>
                                <View>
                                    <Text style={local.smallLabel}>Paid: <Text style={{ color: isDark ? '#81C784' : '#388E3C', fontWeight: 'bold' }}>₹{formatCurrency(item.salary_paid)}</Text></Text>
                                    <Text style={local.smallLabel}>Closing Bal: <Text style={{ color: isDark ? '#E57373' : '#D32F2F', fontWeight: 'bold' }}>₹{formatCurrency(item.closing_balance)}</Text></Text>
                                </View>
                                <TouchableOpacity
                                    style={local.payBtn}
                                    onPress={() => {
                                        setSelectedLabour(item);
                                        setModalVisible(true);
                                    }}
                                >
                                    <Text style={local.payBtnText}>Record Payment</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            <CustomModal
                visible={!!activeDatePicker}
                onClose={() => setActiveDatePicker(null)}
                title={getDatePickerTitle()}
                type="date"
                actions={[
                    { text: "Cancel", onPress: () => setActiveDatePicker(null), style: "cancel" }
                ]}
            >
                {activeDatePicker && (
                    <Calendar
                        selectedDate={activeDatePickerValue}
                        onDateSelect={handleDraftDateSelect}
                        markedDates={[]}
                        onMonthChange={() => { }}
                        allowFutureDates
                    />
                )}
            </CustomModal>

            {selectedLabour && (
                <SalaryPaymentModal
                    visible={modalVisible}
                    onClose={() => setModalVisible(false)}
                    onSuccess={() => {
                        setModalVisible(false);
                        fetchReport();
                    }}
                    labourId={selectedLabour.id}
                    labourName={selectedLabour.name}
                    totalPayable={selectedLabour.total_payable}
                    monthReference={reportReference}
                />
            )}
        </View>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#121212' : '#f5f5f5', paddingTop: 40 },
    headerRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingBottom: 15, backgroundColor: isDark ? '#1e1e1e' : '#fff',
        borderBottomWidth: 1, borderBottomColor: isDark ? '#333' : '#eee'
    },
    backBtn: { padding: 5 },
    backText: { color: isDark ? '#4da6ff' : '#0a84ff', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: isDark ? '#fff' : '#000' },
    controls: {
        padding: 16, backgroundColor: isDark ? '#1e1e1e' : '#fff', marginTop: 10, marginHorizontal: 20,
        borderRadius: 10, elevation: 2
    },
    dateRangeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    datePeriodBlock: {
        marginBottom: 14,
    },
    periodDivider: {
        height: 1,
        backgroundColor: isDark ? '#333' : '#eee',
        marginBottom: 14,
    },
    dateRangeTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: isDark ? '#fff' : '#333',
    },
    dateHelperText: {
        fontSize: 12,
        color: isDark ? '#aaa' : '#666',
        marginTop: 3,
    },
    dateInputGrid: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
        flexWrap: 'wrap',
    },
    dateField: {
        flex: 1,
        minWidth: 130,
    },
    dateLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: isDark ? '#bbb' : '#555',
        marginBottom: 6,
    },
    dateInput: {
        borderWidth: 1,
        borderColor: isDark ? '#333' : '#ddd',
        backgroundColor: isDark ? '#2a2a2a' : '#fafafa',
        borderRadius: 8,
        paddingHorizontal: 12,
        minHeight: 43,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    dateInputText: {
        color: isDark ? '#fff' : '#111',
        fontSize: 14,
        fontWeight: '600',
        flexShrink: 1,
    },
    applyRangeBtn: {
        minHeight: 43,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#0a84ff',
        borderRadius: 8,
        paddingHorizontal: 16,
        alignSelf: 'flex-start',
    },
    applyRangeText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    content: { padding: 20 },
    summaryCard: {
        backgroundColor: isDark ? '#1e1e1e' : '#fff', padding: 20, borderRadius: 12, marginBottom: 20, elevation: 2
    },
    summaryTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: isDark ? '#fff' : '#333' },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    label: { fontSize: 16, color: isDark ? '#bbb' : '#666' },
    value: { fontSize: 18, fontWeight: 'bold', color: isDark ? '#4da6ff' : '#0a84ff' },
    vVal: { fontSize: 16, fontWeight: '600', color: isDark ? '#eee' : '#333' },
    pdfBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#0a84ff', padding: 16, borderRadius: 12, marginBottom: 15,
        elevation: 2
    },
    secondaryBtn: {
        backgroundColor: isDark ? '#1e1e1e' : '#fff', borderWidth: 1, borderColor: isDark ? '#4da6ff' : '#0a84ff'
    },
    disabledBtn: {
        opacity: 0.7
    },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 10 },
    note: { textAlign: 'center', color: isDark ? '#777' : '#888', fontStyle: 'italic', marginTop: 20 },
    labourCard: {
        backgroundColor: isDark ? '#1e1e1e' : '#fff',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        elevation: 1,
        borderLeftWidth: 4,
        borderLeftColor: '#0a84ff',
    },
    labourRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    labourName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: isDark ? '#fff' : '#333',
    },
    balanceBadge: {
        alignItems: 'flex-end',
    },
    balanceLabel: {
        fontSize: 12,
        color: isDark ? '#aaa' : '#666',
    },
    balanceValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: isDark ? '#fff' : '#000',
    },
    smallLabel: {
        fontSize: 13,
        color: isDark ? '#bbb' : '#666',
        marginTop: 2,
    },
    payBtn: {
        backgroundColor: '#4CAF50',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 6,
    },
    payBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    }
});
