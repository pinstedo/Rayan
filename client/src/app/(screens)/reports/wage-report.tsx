import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CustomModal } from '../../../components/CustomModal';
import { SalaryPaymentModal } from '../../../components/SalaryPaymentModal';
import { SearchBar } from '../../../components/list';
import { useTheme } from '../../../context/ThemeContext';
import { api } from '../../../services/api'; // Adjust path as needed

export default function WageReportScreen() {
    const router = useRouter();
    const { isDark } = useTheme();
    const local = getStyles(isDark);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [reportData, setReportData] = useState<any[]>([]);

    const [generatingPdf, setGeneratingPdf] = useState(false);

    // Month Picker state
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedLabour, setSelectedLabour] = useState<any>(null);
    const [searchText, setSearchText] = useState("");

    // Month Selection
    const [date, setDate] = useState(new Date());

    const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

    useEffect(() => {
        fetchReport();
    }, [monthStr]);

    const fetchReport = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            const res = await api.post(`/reports/wage-month`, { month: monthStr });
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

    const changeMonth = (delta: number) => {
        const newDate = new Date(date);
        newDate.setMonth(newDate.getMonth() + delta);
        setDate(newDate);
    };

    const getFormattedFilename = (prefix: string) => {
        const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).replace(/ /g, '_');
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}`;
        // Clean filename to remove potentially problematic characters
        return `${prefix}_${monthName}_${timestamp}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    };

    const generateSummaryPDF = async () => {
        if (generatingPdf) return;
        setGeneratingPdf(true);

        try {
            const res = await api.post(`/reports/wage-month`, { month: monthStr });
            const pdfData = await res.json();

            if (!res.ok) {
                throw new Error(pdfData.error || "Failed to fetch data for PDF");
            }

            if (!Array.isArray(pdfData) || pdfData.length === 0) {
                Alert.alert("No Data", "No data to generate report");
                return;
            }

            const totals = pdfData.reduce((acc: any, curr: any) => ({
                wage: acc.wage + (curr.current_wage || 0),
                ot: acc.ot + (curr.current_overtime_amount || 0),
                food: acc.food + (curr.current_food_allowance_amount || 0),
                adv: acc.adv + (curr.current_advance_amount || 0),
                prev: acc.prev + (curr.previous_balance || 0),
                net: acc.net + (curr.current_net_payable || 0),
                total: acc.total + (curr.total_payable || 0)
            }), { wage: 0, ot: 0, food: 0, adv: 0, prev: 0, net: 0, total: 0 });

            // Ensure special chars in names don't break HTML
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
                        body { font-family: 'Helvetica', sans-serif; padding: 20px; }
                        h1 { text-align: center; color: #333; }
                        .header { margin-bottom: 20px; text-align: center; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }
                        th, td { border: 1px solid #ddd; padding: 6px; text-align: right; }
                        th { background-color: #f2f2f2; text-align: center; }
                        .text-left { text-align: left; }
                        .total-row { font-weight: bold; background-color: #e6e6e6; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Salary Report</h1>
                        <h3>Month: ${date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
                        <p>Generated on: ${new Date().toLocaleDateString()}</p>
                    </div>
    
                    <table>
                        <thead>
                            <tr>
                                <th class="text-left">Name</th>
                                <th>Rate</th>
                                <th>Full Days</th>
                                <th>Half Days</th>
                                <th>Wage</th>
                                <th>Overtime</th>
                                <th>Food Allow.</th>
                                <th>Advances</th>
                                <th>Current Net</th>
                                <th>Prev Bal</th>
                                <th>Total Payable</th>
                                <th>Paid</th>
                                <th>Closing Bal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pdfData.map((item: any) => {
                                const rateDisplay = item.wage_breakdown && item.wage_breakdown.length > 1 
                                    ? item.wage_breakdown.map((wb: any) => wb.rate * 8).join(', ') 
                                    : (item.rate || 0) * 8;
                                return `
                                <tr>
                                    <td class="text-left">${escapeHtml(item.name)}</td>
                                    <td>${rateDisplay}</td>
                                    <td>${item.current_full_days}</td>
                                    <td>${item.current_half_days}</td>
                                    <td>${formatCurrency(item.current_wage)}</td>
                                    <td>${formatCurrency(item.current_overtime_amount)}</td>
                                    <td>${formatCurrency(item.current_food_allowance_amount)}</td>
                                    <td>${formatCurrency(item.current_advance_amount)}</td>
                                    <td>${formatCurrency(item.current_net_payable)}</td>
                                    <td>${formatCurrency(item.previous_balance)}</td>
                                    <td><strong>${formatCurrency(item.total_payable)}</strong></td>
                                    <td>${formatCurrency(item.salary_paid)}</td>
                                    <td><strong>${formatCurrency(item.closing_balance)}</strong></td>
                                </tr>
                                `;
                            }).join('')}
                            <tr class="total-row">
                                <td class="text-left">TOTAL</td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                                <td>${formatCurrency(totals.wage)}</td>
                                <td>${formatCurrency(totals.ot)}</td>
                                <td>${formatCurrency(totals.food)}</td>
                                <td>${formatCurrency(totals.adv)}</td>
                                <td>${formatCurrency(totals.net)}</td>
                                <td>${formatCurrency(totals.prev)}</td>
                                <td>${formatCurrency(totals.total)}</td>
                                <td>-</td>
                                <td>-</td>
                            </tr>
                        </tbody>
                    </table>
                </body>
            </html>
            `;

            if (Platform.OS === 'web') {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                document.body.appendChild(iframe);

                iframe.contentDocument?.write(html);
                iframe.contentDocument?.close();
                iframe.contentWindow?.focus();

                setTimeout(() => {
                    iframe.contentWindow?.print();
                    setTimeout(() => {
                        document.body.removeChild(iframe);
                    }, 1000);
                }, 250);
            } else {
                await Print.printAsync({ html });
            }

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

    const generateIndividualBillsPDF = async () => {
        if (generatingPdf) return;
        setGeneratingPdf(true);

        try {
            const res = await api.post(`/reports/wage-month`, { month: monthStr });
            const pdfData = await res.json();

            if (!res.ok) {
                throw new Error(pdfData.error || "Failed to fetch data for PDF");
            }

            if (!Array.isArray(pdfData) || pdfData.length === 0) {
                Alert.alert("No Data", "No data to generate bills");
                return;
            }

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
                const dailyRate = (item.rate || 0) * 8;
                const grossWage = item.current_wage || 0;
                const otAmount = item.current_overtime_amount || 0;
                const foodAmount = item.current_food_allowance_amount || 0;
                const advances = item.current_advance_amount || 0;
                const prevBal = item.previous_balance || 0;
                const netPayable = item.total_payable || 0;
                const currentNet = item.current_net_payable || 0;

                let rateHtml = '';
                let attendanceHtml = '';
                let basicWageRowsHtml = '';

                if (item.wage_breakdown && item.wage_breakdown.length > 0) {
                    rateHtml = item.wage_breakdown.map((wb: any) => \`₹\${formatCurrency(wb.rate * 8)}/day\`).join(' & ');
                    
                    if (item.wage_breakdown.length > 1) {
                         attendanceHtml = item.wage_breakdown.map((wb: any) => 
                            \`<div><span class="info-value">\${wb.fullDays} F, \${wb.halfDays} H (@ ₹\${formatCurrency(wb.rate * 8)})</span></div>\`
                         ).join('');
                         
                         basicWageRowsHtml = item.wage_breakdown.map((wb: any) => \`
                                    <tr>
                                        <td>Basic Wage (Rate: ₹\${formatCurrency(wb.rate * 8)}/day)</td>
                                        <td class="amount">\${formatCurrency(wb.wage)}</td>
                                    </tr>
                         \`).join('');
                    } else {
                         attendanceHtml = \`<div><span class="info-value">\${item.current_full_days} Full Days</span>, <span class="info-value">\${item.current_half_days} Half Days</span></div>\`;
                         basicWageRowsHtml = \`
                                    <tr>
                                        <td>Basic Wage</td>
                                        <td class="amount">\${formatCurrency(grossWage)}</td>
                                    </tr>\`;
                    }
                } else {
                    rateHtml = \`₹\${formatCurrency(dailyRate)}/day\`;
                    attendanceHtml = \`<div><span class="info-value">\${item.current_full_days} Full Days</span>, <span class="info-value">\${item.current_half_days} Half Days</span></div>\`;
                    basicWageRowsHtml = \`
                                    <tr>
                                        <td>Basic Wage</td>
                                        <td class="amount">\${formatCurrency(grossWage)}</td>
                                    </tr>\`;
                }

                return `
                        <div class="bill-page">
                            <div class="header">
                                <h1>Salary Bill</h1>
                                <p>For the month of ${date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
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

            if (Platform.OS === 'web') {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                document.body.appendChild(iframe);

                iframe.contentDocument?.write(html);
                iframe.contentDocument?.close();
                iframe.contentWindow?.focus();

                setTimeout(() => {
                    iframe.contentWindow?.print();
                    setTimeout(() => {
                        document.body.removeChild(iframe);
                    }, 1000);
                }, 250);
            } else {
                await Print.printAsync({ html });
            }

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
                <TouchableOpacity onPress={() => changeMonth(-1)} style={local.arrowBtn}>
                    <MaterialIcons name="chevron-left" size={30} color={isDark ? "#fff" : "#333"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setPickerYear(date.getFullYear()); setShowMonthPicker(true); }}>
                    <Text style={[local.monthText, { color: isDark ? '#4da6ff' : '#0a84ff', textDecorationLine: 'underline' }]}>
                        {date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => changeMonth(1)} style={local.arrowBtn}>
                    <MaterialIcons name="chevron-right" size={30} color={isDark ? "#fff" : "#333"} />
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
                        <Text style={local.summaryTitle}>Month Summary</Text>
                        <View style={local.row}>
                            <Text style={local.label}>Total Payable:</Text>
                            <Text style={local.value}>
                                ₹{formatCurrency((Array.isArray(reportData) ? reportData : []).reduce((sum, item) => sum + (item.total_payable || 0), 0))}
                            </Text>
                        </View>
                        <View style={local.row}>
                            <Text style={local.label}>Current Month Net:</Text>
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
                        onPress={generateIndividualBillsPDF}
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
                        * Report includes previous month balance.
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
                        <View key={item.id.toString() + index} style={local.labourCard}>
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
                        </View>
                    ))}
                </ScrollView>
            )}

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
                    monthReference={monthStr}
                />
            )}

            <CustomModal
                visible={showMonthPicker}
                onClose={() => setShowMonthPicker(false)}
                title="Select Month"
                actions={[
                    { text: "Cancel", onPress: () => setShowMonthPicker(false), style: "cancel" }
                ]}
            >
                <View style={{ alignItems: 'center', padding: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                        <TouchableOpacity onPress={() => setPickerYear(y => y - 1)} style={{ padding: 10 }}>
                            <MaterialIcons name="chevron-left" size={30} color={isDark ? "#fff" : "#333"} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: isDark ? "#fff" : "#333", marginHorizontal: 30 }}>{pickerYear}</Text>
                        <TouchableOpacity onPress={() => setPickerYear(y => y + 1)} style={{ padding: 10 }}>
                            <MaterialIcons name="chevron-right" size={30} color={isDark ? "#fff" : "#333"} />
                        </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => {
                            const isSelected = date.getMonth() === i && date.getFullYear() === pickerYear;
                            return (
                                <TouchableOpacity
                                    key={m}
                                    style={{
                                        paddingVertical: 12, width: '28%', alignItems: 'center',
                                        backgroundColor: isSelected ? '#0a84ff' : (isDark ? '#333' : '#eee'),
                                        borderRadius: 8
                                    }}
                                    onPress={() => {
                                        const newDate = new Date(pickerYear, i, 1);
                                        setDate(newDate);
                                        setShowMonthPicker(false);
                                    }}
                                >
                                    <Text style={{ fontSize: 16, color: isSelected ? '#fff' : (isDark ? '#fff' : '#333'), fontWeight: isSelected ? 'bold' : '500' }}>{m}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </CustomModal>
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
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        padding: 20, backgroundColor: isDark ? '#1e1e1e' : '#fff', marginTop: 10, marginHorizontal: 20,
        borderRadius: 10, elevation: 2
    },
    arrowBtn: { padding: 10 },
    monthText: { fontSize: 18, fontWeight: 'bold', color: isDark ? '#fff' : '#000', marginHorizontal: 20, minWidth: 150, textAlign: 'center' },
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
