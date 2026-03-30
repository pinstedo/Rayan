import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform, Modal } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { api } from '../../../services/api';
import { Calendar } from '../../../components/Calendar';

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
    const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(formatDateStr(firstDay));
    const [endDate, setEndDate] = useState(formatDateStr(today));
    const [showCalendar, setShowCalendar] = useState<'start' | 'end' | null>(null);

    useEffect(() => {
        if (isValidDate(startDate) && isValidDate(endDate)) {
            fetchReport();
        }
    }, [startDate, endDate]);

    const isValidDate = (d: string) => {
        return /^\d{4}-\d{2}-\d{2}$/.test(d);
    };

    const fetchReport = async (isRefresh = false) => {
        if (!isValidDate(startDate) || !isValidDate(endDate)) return;
        
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            const res = await api.get(`/reports/bonus-attendance-range?startDate=${startDate}&endDate=${endDate}`);
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

    const generatePDF = async () => {
        if (reportData.length === 0) {
            Alert.alert("No Data", "No data to generate report");
            return;
        }

        setGeneratingPdf(true);

        try {
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
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                        th { background-color: #f2f2f2; text-align: center; }
                        .text-left { text-align: left; }
                        .bonus-cell { color: #2e7d32; font-weight: bold; } /* Green */
                        .salary-cell { color: #1565c0; font-weight: bold; } /* Blue */
                        .total-row { font-weight: bold; background-color: #e6e6e6; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Bonus & Attendance Report</h1>
                        <h3>Date Range: ${startDate} to ${endDate}</h3>
                        <p>Generated on: ${new Date().toLocaleDateString()}</p>
                    </div>
    
                    <table>
                        <thead>
                            <tr>
                                <th class="text-left">Name</th>
                                <th>Total Days</th>
                                <th>Full Days</th>
                                <th>Half Days</th>
                                <th>Absent</th>
                                <th>Bonus Awarded</th>
                                <th>Salary Increased?</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.map(item => `
                                <tr>
                                    <td class="text-left">${escapeHtml(item.name)}</td>
                                    <td>${item.total_working_days}</td>
                                    <td>${item.full_days}</td>
                                    <td>${item.half_days}</td>
                                    <td>${item.absent_days}</td>
                                    <td class="${item.bonus_amount > 0 ? 'bonus-cell' : ''}">${item.bonus_amount > 0 ? '₹' + formatCurrency(item.bonus_amount) : '-'}</td>
                                    <td class="${item.salary_increased ? 'salary-cell' : ''}">${item.salary_increased ? 'Yes (₹'+formatCurrency(item.new_rate_details)+')' : 'No'}</td>
                                </tr>
                            `).join('')}
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
            Alert.alert("Print Error", error.message || "Failed to initiate print/save dialog.");
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
                <Text style={local.headerTitle}>Bonus & Attendance</Text>
                <View style={{ width: 50 }} />
            </View>

            <View style={local.controls}>
                <View style={local.dateInputContainer}>
                    <Text style={local.dateLabel}>Start Date</Text>
                    <TouchableOpacity
                        style={local.dateInput}
                        onPress={() => setShowCalendar('start')}
                    >
                        <Text style={{color: isDark ? '#fff' : '#000', textAlign: 'center'}}>{startDate}</Text>
                    </TouchableOpacity>
                </View>
                <View style={local.dateInputContainer}>
                    <Text style={local.dateLabel}>End Date</Text>
                    <TouchableOpacity
                        style={local.dateInput}
                        onPress={() => setShowCalendar('end')}
                    >
                        <Text style={{color: isDark ? '#fff' : '#000', textAlign: 'center'}}>{endDate}</Text>
                    </TouchableOpacity>
                </View>
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
                            {generatingPdf ? "Preparing Print..." : "Print / Save PDF Report"}
                        </Text>
                    </TouchableOpacity>

                    <Text style={local.note}>
                        * Ensure dates are in YYYY-MM-DD format.
                    </Text>

                    <Text style={[local.summaryTitle, { marginTop: 20 }]}>Labour Details</Text>
                    {reportData.map((item, index) => (
                        <View key={item.id.toString() + index} style={local.labourCard}>
                            <View style={local.labourRow}>
                                <Text style={local.labourName}>{item.name}</Text>
                                <View style={local.balanceBadge}>
                                    <Text style={local.balanceLabel}>Total Days</Text>
                                    <Text style={local.balanceValue}>{item.total_working_days}</Text>
                                </View>
                            </View>
                            <View style={[local.labourRow, { marginTop: 10 }]}>
                                <View>
                                    <Text style={local.smallLabel}>Present: <Text style={{ color: isDark ? '#fff' : '#000', fontWeight: 'bold' }}>{item.full_days} (Full) / {item.half_days} (Half)</Text></Text>
                                    <Text style={local.smallLabel}>Absent: <Text style={{ color: isDark ? '#E57373' : '#D32F2F', fontWeight: 'bold' }}>{item.absent_days}</Text></Text>
                                </View>
                                <View style={{ alignItems: 'flex-end'}}>
                                    <Text style={local.smallLabel}>Bonus: <Text style={{ color: isDark ? '#81C784' : '#388E3C', fontWeight: 'bold' }}>{item.bonus_amount > 0 ? '₹' + formatCurrency(item.bonus_amount) : 'None'}</Text></Text>
                                    <Text style={local.smallLabel}>Salary Increased?: <Text style={{ color: isDark ? '#64b5f6' : '#1976d2', fontWeight: 'bold' }}>{item.salary_increased ? 'Yes' : 'No'}</Text></Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}

            <Modal visible={!!showCalendar} transparent={true} animationType="fade">
                <View style={local.modalOverlay}>
                    <View style={local.modalContainer}>
                        <Calendar 
                            selectedDate={showCalendar === 'start' ? new Date(startDate) : showCalendar === 'end' ? new Date(endDate) : new Date()}
                            onDateSelect={(date) => {
                                const dateStr = formatDateStr(date);
                                if (showCalendar === 'start') setStartDate(dateStr);
                                else if (showCalendar === 'end') setEndDate(dateStr);
                                setShowCalendar(null);
                            }}
                            markedDates={[]}
                            onMonthChange={() => {}}
                        />
                        <TouchableOpacity style={local.closeBtn} onPress={() => setShowCalendar(null)}>
                            <Text style={local.btnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, backgroundColor: isDark ? '#1e1e1e' : '#fff', marginTop: 10, marginHorizontal: 20,
        borderRadius: 10, elevation: 2
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
    content: { padding: 20 },
    summaryTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: isDark ? '#fff' : '#333' },
    pdfBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#0a84ff', padding: 16, borderRadius: 12, marginBottom: 15,
        elevation: 2
    },
    disabledBtn: {
        opacity: 0.7
    },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 10 },
    note: { textAlign: 'center', color: isDark ? '#777' : '#888', fontStyle: 'italic', marginTop: 10 },
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
