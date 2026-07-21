import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CustomModal } from '../../../components/CustomModal';
import { AppRefreshControl, TopRefreshLoader } from '../../../components/RefreshFeedback';
import { useTheme } from '../../../context/ThemeContext';
import { api } from '../../../services/api';

export default function BonusAttendanceReportScreen() {
    const router = useRouter();
    const { isDark } = useTheme();
    const local = getStyles(isDark);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [reportData, setReportData] = useState<any[]>([]);

    const [generatingPdf, setGeneratingPdf] = useState(false);

    // Date Selection
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    // Format YYYY-MM-DD
    const formatDateStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const [startDate, setStartDate] = useState(formatDateStr(firstDay));
    const [endDate, setEndDate] = useState(formatDateStr(today));
    const [showMonthPicker, setShowMonthPicker] = useState<'start' | 'end' | null>(null);
    const [pickerYear, setPickerYear] = useState(today.getFullYear());

    const isValidDate = (d: string) => {
        return /^\d{4}-\d{2}-\d{2}$/.test(d);
    };

    // Dynamic Months calculation
    const getMonthsList = () => {
        if (!isValidDate(startDate) || !isValidDate(endDate)) return [];
        const months = [];
        const start = new Date(startDate);
        start.setDate(1); // avoid end of month shifting
        const end = new Date(endDate);
        end.setDate(1);

        const current = new Date(start);
        while (current <= end) {
            const yyyy = current.getFullYear();
            const mm = String(current.getMonth() + 1).padStart(2, '0');
            months.push(`${yyyy}-${mm}`);
            current.setMonth(current.getMonth() + 1);
        }
        return months;
    };

    const monthsList = getMonthsList();

    const formatMonthAbbr = (yyyy_mm: string) => {
        const [y, m] = yyyy_mm.split('-');
        const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    };

    useEffect(() => {
        if (isValidDate(startDate) && isValidDate(endDate)) {
            fetchReport();
        }
    }, [startDate, endDate]);

    const fetchReport = async (isRefresh = false) => {
        if (!isValidDate(startDate) || !isValidDate(endDate)) return;

        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            const res = await api.post(`/reports/bonus-attendance-range`, { startDate, endDate });
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

    const formatCurrency = (val: number | undefined) => {
        return (val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    };

    const getCellColor = (monthData: any) => {
        if (!monthData) return 'transparent';
        const { bonus_amount, has_increment } = monthData;
        if (bonus_amount > 0 && has_increment) return '#66bb6a'; // Green (Both)
        if (has_increment) return '#4da6ff'; // Blue (Increment only)
        if (bonus_amount > 0) return '#ffb74d'; // Orange (Bonus only)
        return 'transparent';
    };

    const getCellColorPDF = (monthData: any) => {
        if (!monthData) return '';
        const { bonus_amount, has_increment } = monthData;
        if (bonus_amount > 0 && has_increment) return 'background-color: #66bb6a; color: #fff;';
        if (has_increment) return 'background-color: #4da6ff; color: #fff;';
        if (bonus_amount > 0) return 'background-color: #ffb74d; color: #fff;';
        return '';
    };

    const getMonthMarkers = (monthData: any) => {
        if (!monthData) return [];
        const markers = [];
        if (monthData.bonus_amount > 0) {
            markers.push({ label: 'BONUS', detail: formatCurrency(monthData.bonus_amount), type: 'bonus' });
        }
        if (monthData.has_increment) {
            markers.push({ label: 'INC', detail: '', type: 'increment' });
        }
        return markers;
    };

    const getCellLabel = (monthData: any) => {
        const markers = getMonthMarkers(monthData);
        if (markers.length === 0) return '';
        return markers.map(marker => marker.label).join(' + ');
    };

    const generatePDF = async () => {
        if (generatingPdf) return;
        setGeneratingPdf(true);

        try {
            const res = await api.post(`/reports/bonus-attendance-range`, { startDate, endDate });
            const pdfData = await res.json();
            
            if (!res.ok) {
                throw new Error(pdfData.error || "Failed to fetch data for PDF");
            }

            if (!Array.isArray(pdfData) || pdfData.length === 0) {
                Alert.alert("No Data", "No data to generate report");
                return;
            }

            const escapeHtml = (unsafe: string) => {
                return (unsafe || '').replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            };

            let tableHeaders = `<th class="text-left">Name</th>`;
            monthsList.forEach(m => {
                tableHeaders += `<th>${formatMonthAbbr(m)}</th>`;
            });
            tableHeaders += `
                <th>TOTAL</th>
                <th>Bonus M.</th>
                <th>Incr M.</th>
            `;

            let tableRows = '';

            pdfData.forEach((item: any) => {
                let rowHtml = `<tr><td class="text-left">${escapeHtml(item.name)}</td>`;

                monthsList.forEach(m => {
                    const mData = item.monthly_data?.[m];
                    const att = mData ? mData.attendance : 0;
                    const style = getCellColorPDF(mData);
                    const markers = getMonthMarkers(mData);
                    const markerHtml = markers.map(marker =>
                        `<div class="marker marker-${marker.type}">${marker.label}${marker.detail ? ` ${marker.detail}` : ''}</div>`
                    ).join('');
                    rowHtml += `
                        <td style="${style}" class="${markers.length > 0 ? 'event-cell' : ''}">
                            <div class="attendance">${att > 0 ? att : ''}</div>
                            ${markerHtml}
                        </td>`;
                });

                rowHtml += `
                    <td><strong>${item.total_working_days}</strong></td>
                    <td>${item.total_bonus_months > 0 ? item.total_bonus_months : 0}</td>
                    <td>${item.total_increment_months > 0 ? item.total_increment_months : 0}</td>
                </tr>`;

                tableRows += rowHtml;
            });

            const html = `
            <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                    <style>
                        @page { size: landscape; margin: 16px; }
                        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        body {
                            margin: 0;
                            font-family: 'Helvetica', sans-serif;
                            background: ${isDark ? '#121212' : '#f5f5f5'};
                            color: ${isDark ? '#fff' : '#111'};
                        }
                        .topbar {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            padding: 14px 18px;
                            background: ${isDark ? '#1e1e1e' : '#fff'};
                            border-bottom: 1px solid ${isDark ? '#333' : '#eee'};
                        }
                        .back { color: ${isDark ? '#4da6ff' : '#0a84ff'}; font-size: 13px; }
                        h1 { margin: 0; font-size: 20px; text-align: center; }
                        .screen { padding: 18px 22px 22px; }
                        .controls {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 12px;
                            padding: 16px;
                            background: ${isDark ? '#1e1e1e' : '#fff'};
                            border: 1px solid ${isDark ? '#333' : '#eee'};
                            border-radius: 10px;
                            margin-bottom: 14px;
                        }
                        .date-label { font-size: 12px; color: ${isDark ? '#aaa' : '#666'}; margin-bottom: 6px; }
                        .date-input {
                            background: ${isDark ? '#333' : '#f0f0f0'};
                            border-radius: 8px;
                            padding: 10px;
                            text-align: center;
                            color: ${isDark ? '#fff' : '#000'};
                            font-size: 14px;
                            font-weight: 600;
                        }
                        .legend { display: flex; justify-content: center; gap: 15px; margin: 0 0 10px; font-size: 12px; }
                        .legend-item { display: flex; align-items: center; gap: 6px; color: ${isDark ? '#ddd' : '#444'}; }
                        .box { width: 14px; height: 14px; border-radius: 3px; border: 1px solid ${isDark ? '#555' : '#ccc'}; }
                        .table-wrapper {
                            background: ${isDark ? '#1e1e1e' : '#fff'};
                            border: 1px solid ${isDark ? '#333' : '#eee'};
                            border-radius: 8px;
                            overflow: hidden;
                        }
                        table { width: 100%; border-collapse: collapse; font-size: 10px; }
                        th, td {
                            border-right: 1px solid ${isDark ? '#444' : '#eee'};
                            border-bottom: 1px solid ${isDark ? '#444' : '#eee'};
                            padding: 8px;
                            text-align: center;
                            vertical-align: middle;
                            color: ${isDark ? '#ddd' : '#333'};
                        }
                        th {
                            background-color: ${isDark ? '#333' : '#e0e0e0'};
                            color: ${isDark ? '#fff' : '#333'};
                            font-weight: 800;
                        }
                        .text-left { text-align: left; }
                        .event-cell { min-width: 58px; font-weight: bold; }
                        .attendance { font-size: 11px; min-height: 12px; }
                        .marker { margin-top: 2px; padding: 2px 3px; border-radius: 3px; font-size: 8px; line-height: 1.1; color: #111; background: rgba(255,255,255,0.85); border: 1px solid rgba(0,0,0,0.15); }
                        .marker-bonus { color: #7a3d00; }
                        .marker-increment { color: #004c8c; }
                        .generated { margin-top: 14px; text-align: center; font-size: 11px; color: ${isDark ? '#888' : '#777'}; }
                    </style>
                </head>
                <body>
                    <div class="topbar">
                        <div class="back">Back</div>
                        <h1>Bonus & Increment Report</h1>
                        <div style="width: 32px;"></div>
                    </div>

                    <div class="screen">
                        <div class="controls">
                            <div>
                                <div class="date-label">Start Month</div>
                                <div class="date-input">${new Date(startDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</div>
                            </div>
                            <div>
                                <div class="date-label">End Month</div>
                                <div class="date-input">${new Date(endDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</div>
                            </div>
                        </div>

                        <div class="legend">
                            <div class="legend-item"><div class="box" style="background-color: #4da6ff;"></div> Increment</div>
                            <div class="legend-item"><div class="box" style="background-color: #ffb74d;"></div> Bonus</div>
                            <div class="legend-item"><div class="box" style="background-color: #66bb6a;"></div> Both</div>
                        </div>

                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>${tableHeaders}</tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        </div>

                        <div class="generated">Generated on ${new Date().toLocaleDateString()}</div>
                    </div>
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

    return (
        <View style={local.container}>
            <View style={local.headerRow}>
                <TouchableOpacity onPress={() => router.back()} style={local.backBtn}>
                    <Text style={local.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={local.headerTitle}>Bonus & Increment Report</Text>
                <View style={{ width: 50 }} />
            </View>

            <View style={local.controls}>
                <View style={local.dateInputContainer}>
                    <Text style={local.dateLabel}>Start Month</Text>
                    <TouchableOpacity
                        style={local.dateInput}
                        onPress={() => { setPickerYear(new Date(startDate).getFullYear()); setShowMonthPicker('start'); }}
                    >
                        <Text style={{ color: isDark ? '#fff' : '#000', textAlign: 'center' }}>
                            {new Date(startDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                        </Text>
                    </TouchableOpacity>
                </View>
                <View style={local.dateInputContainer}>
                    <Text style={local.dateLabel}>End Month</Text>
                    <TouchableOpacity
                        style={local.dateInput}
                        onPress={() => { setPickerYear(new Date(endDate).getFullYear()); setShowMonthPicker('end'); }}
                    >
                        <Text style={{ color: isDark ? '#fff' : '#000', textAlign: 'center' }}>
                            {new Date(endDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#0a84ff" style={{ marginTop: 20 }} />
            ) : (
                <View style={{ flex: 1, paddingHorizontal: 20 }}>
                    <TouchableOpacity
                        style={[local.pdfBtn, generatingPdf && local.disabledBtn]}
                        onPress={generatePDF}
                        disabled={generatingPdf || !isValidDate(startDate) || !isValidDate(endDate)}
                    >
                        {generatingPdf ? (
                            <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />
                        ) : (
                            <MaterialIcons name="print" size={24} color="#fff" />
                        )}
                        <Text style={local.btnText}>
                            {generatingPdf ? "Generating..." : "Generate"}
                        </Text>
                    </TouchableOpacity>

                    <View style={local.legend}>
                        <View style={local.legendItem}><View style={[local.box, { backgroundColor: '#4da6ff' }]} /><Text style={local.legendText}>Increment</Text></View>
                        <View style={local.legendItem}><View style={[local.box, { backgroundColor: '#ffb74d' }]} /><Text style={local.legendText}>Bonus</Text></View>
                        <View style={local.legendItem}><View style={[local.box, { backgroundColor: '#66bb6a' }]} /><Text style={local.legendText}>Both</Text></View>
                    </View>

                    <View style={local.tableWrapper}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ flexDirection: 'column' }}>
                            <ScrollView showsVerticalScrollIndicator={true} refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                                <TopRefreshLoader visible={refreshing} />
                                <View style={local.tableHeaderRow}>
                                    <View style={[local.tableHeaderCell, local.nameColumn]}><Text style={local.tableHeaderText}>NAME</Text></View>
                                    {monthsList.map(m => (
                                        <View key={m} style={[local.tableHeaderCell, local.monthColumn]}>
                                            <Text style={local.tableHeaderText}>{formatMonthAbbr(m)}</Text>
                                        </View>
                                    ))}
                                    <View style={[local.tableHeaderCell, local.totalColumn]}><Text style={local.tableHeaderText}>TOTAL</Text></View>
                                    <View style={[local.tableHeaderCell, local.totalColumn]}><Text style={local.tableHeaderText}>Bonus M.</Text></View>
                                    <View style={[local.tableHeaderCell, local.totalColumn]}><Text style={local.tableHeaderText}>Incr M.</Text></View>
                                </View>

                                {reportData.map((item, index) => (
                                    <View key={item.id.toString() + index} style={local.tableRow}>
                                        <View style={[local.tableCell, local.nameColumn]}>
                                            <Text style={local.tableCellText} numberOfLines={1}>{item.name}</Text>
                                        </View>

                                        {monthsList.map(m => {
                                            const mData = item.monthly_data?.[m];
                                            const bgColor = getCellColor(mData);
                                            const att = mData ? mData.attendance : 0;
                                            const label = getCellLabel(mData);
                                            return (
                                                <View key={m} style={[local.tableCell, local.monthColumn, { backgroundColor: bgColor }]}>
                                                    <Text style={[local.tableCellText, bgColor !== 'transparent' && { color: '#fff', fontWeight: 'bold' }]}>
                                                        {att > 0 ? att : ''}
                                                    </Text>
                                                    {label ? (
                                                        <Text style={local.monthMarkerText} numberOfLines={2}>
                                                            {label}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                            );
                                        })}

                                        <View style={[local.tableCell, local.totalColumn]}>
                                            <Text style={[local.tableCellText, { fontWeight: 'bold' }]}>{item.total_working_days}</Text>
                                        </View>
                                        <View style={[local.tableCell, local.totalColumn]}>
                                            <Text style={local.tableCellText}>{item.total_bonus_months || 0}</Text>
                                        </View>
                                        <View style={[local.tableCell, local.totalColumn]}>
                                            <Text style={local.tableCellText}>{item.total_increment_months || 0}</Text>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>
                        </ScrollView>
                    </View>
                </View>
            )}

            <CustomModal
                visible={!!showMonthPicker}
                onClose={() => setShowMonthPicker(null)}
                title={showMonthPicker === 'start' ? "Select Start Month" : "Select End Month"}
                actions={[
                    { text: "Cancel", onPress: () => setShowMonthPicker(null), style: "cancel" }
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
                            const isSelected = showMonthPicker === 'start'
                                ? new Date(startDate).getMonth() === i && new Date(startDate).getFullYear() === pickerYear
                                : new Date(endDate).getMonth() === i && new Date(endDate).getFullYear() === pickerYear;
                            return (
                                <TouchableOpacity
                                    key={m}
                                    style={{
                                        paddingVertical: 12, width: '28%', alignItems: 'center',
                                        backgroundColor: isSelected ? '#0a84ff' : (isDark ? '#333' : '#eee'),
                                        borderRadius: 8
                                    }}
                                    onPress={() => {
                                        if (showMonthPicker === 'start') {
                                            const d = new Date(pickerYear, i, 1);
                                            setStartDate(formatDateStr(d));
                                        } else {
                                            const d = new Date(pickerYear, i + 1, 0); // Last day
                                            setEndDate(formatDateStr(d));
                                        }
                                        setShowMonthPicker(null);
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
    container: { flex: 1, backgroundColor: isDark ? '#121212' : '#f5f5f5' },
    headerRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 15, backgroundColor: isDark ? '#1e1e1e' : '#fff',
        borderBottomWidth: 1, borderBottomColor: isDark ? '#333' : '#eee'
    },
    backBtn: { padding: 5 },
    backText: { color: isDark ? '#4da6ff' : '#0a84ff', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: isDark ? '#fff' : '#000' },
    controls: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, backgroundColor: isDark ? '#1e1e1e' : '#fff', marginTop: 10, marginHorizontal: 20,
        borderRadius: 10, elevation: 2, marginBottom: 15
    },
    dateInputContainer: { flex: 1, marginHorizontal: 5 },
    dateLabel: { fontSize: 12, color: isDark ? '#aaa' : '#666', marginBottom: 5 },
    dateInput: {
        backgroundColor: isDark ? '#333' : '#f0f0f0',
        color: isDark ? '#fff' : '#000',
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        textAlign: 'center'
    },
    pdfBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#0a84ff', padding: 12, borderRadius: 12, marginBottom: 15,
        elevation: 2
    },
    disabledBtn: { opacity: 0.7 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 10 },

    legend: { flexDirection: 'row', justifyContent: 'center', gap: 15, marginBottom: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    box: { width: 14, height: 14, borderRadius: 3, borderWidth: 1, borderColor: isDark ? '#555' : '#ccc' },
    legendText: { fontSize: 12, color: isDark ? '#ddd' : '#444' },

    tableWrapper: {
        flex: 1,
        backgroundColor: isDark ? '#1e1e1e' : '#fff',
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isDark ? '#333' : '#eee',
        marginBottom: 20
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: isDark ? '#333' : '#e0e0e0',
        borderBottomWidth: 1,
        borderBottomColor: isDark ? '#555' : '#ccc'
    },
    tableHeaderCell: {
        paddingVertical: 10,
        paddingHorizontal: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 1,
        borderRightColor: isDark ? '#555' : '#ccc'
    },
    tableHeaderText: {
        fontWeight: 'bold',
        fontSize: 12,
        color: isDark ? '#fff' : '#333',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: isDark ? '#444' : '#eee',
    },
    tableCell: {
        paddingVertical: 8,
        paddingHorizontal: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 1,
        borderRightColor: isDark ? '#444' : '#eee',
    },
    tableCellText: {
        fontSize: 12,
        color: isDark ? '#ddd' : '#333',
    },
    nameColumn: { width: 150, alignItems: 'flex-start' },
    monthColumn: { width: 64, minHeight: 44 },
    totalColumn: { width: 60 },
    monthMarkerText: {
        marginTop: 3,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.88)',
        color: '#111',
        fontSize: 8,
        fontWeight: '800',
        textAlign: 'center',
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContainer: {
        width: '90%',
        maxWidth: 400,
        alignSelf: 'center',
        backgroundColor: isDark ? '#1e1e1e' : '#fff',
        padding: 20,
        borderRadius: 12,
        elevation: 5
    },
    closeBtn: {
        backgroundColor: '#0a84ff',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10
    }
});
