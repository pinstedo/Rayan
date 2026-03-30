import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import { api } from "../../../services/api";
import { Calendar } from "../../../components/Calendar";
import { CustomModal } from "../../../components/CustomModal";

interface SiteReport {
    site_id: number;
    site_name: string;
    total_labourers: number;
    present_count: number;
    absent_count: number;
    is_submitted: number; // 0 or 1
}

export default function SiteAttendanceReport() {
    const router = useRouter();
    const { isDark } = useTheme();
    const local = getStyles(isDark);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(new Date());
    const [showCalendar, setShowCalendar] = useState(false);
    const [reports, setReports] = useState<SiteReport[]>([]);

    const fetchReports = async (selectedDate: Date) => {
        setLoading(true);
        try {
            const dateStr = selectedDate.toISOString().split("T")[0];
            const response = await api.get(`/reports/site-attendance?date=${dateStr}`);
            if (response.ok) {
                const data = await response.json();
                setReports(data);
            } else {
                Alert.alert("Error", "Failed to load reports");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "An error occurred while fetching reports");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports(date);
    }, [date]);

    const handleDateChange = (selectedDate: Date) => {
        setShowCalendar(false);
        if (selectedDate) {
            setDate(selectedDate);
        }
    };

    const formatDate = (d: Date) => {
        return d.toLocaleDateString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    const changeDate = (days: number) => {
        const newDate = new Date(date);
        newDate.setDate(newDate.getDate() + days);
        setDate(newDate);
    };

    return (
        <View style={local.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={local.headerRow}>
                <TouchableOpacity onPress={() => router.back()} style={local.backBtnText}>
                    <Ionicons name="arrow-back" size={20} color={isDark ? "#4da6ff" : "#0a84ff"} />
                    <Text style={local.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={local.headerTitle}>Site Attendance Report</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={local.header}>
                <TouchableOpacity onPress={() => changeDate(-1)} style={local.arrowBtn}>
                    <Ionicons name="chevron-back" size={24} color={isDark ? "#fff" : "#333"} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowCalendar(true)} style={local.dateDisplay}>
                    <Ionicons name="calendar-outline" size={20} color={isDark ? "#aaa" : "#555"} style={{ marginRight: 8 }} />
                    <Text style={local.dateText}>{formatDate(date)}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => changeDate(1)} style={local.arrowBtn}>
                    <Ionicons name="chevron-forward" size={24} color={isDark ? "#fff" : "#333"} />
                </TouchableOpacity>
            </View>

            <CustomModal
                visible={showCalendar}
                onClose={() => setShowCalendar(false)}
                title="Select Date"
                actions={[
                    { text: "Cancel", onPress: () => setShowCalendar(false), style: "cancel" }
                ]}
            >
                <Calendar
                    selectedDate={date}
                    onDateSelect={handleDateChange}
                    markedDates={[]}
                    onMonthChange={() => {}}
                />
            </CustomModal>

            {loading ? (
                <ActivityIndicator size="large" color="#eb9834" style={{ marginTop: 40 }} />
            ) : (
                <ScrollView contentContainerStyle={local.scrollContent}>
                    {reports.map((site) => (
                        <TouchableOpacity
                            key={site.site_id}
                            style={local.card}
                            activeOpacity={0.7}
                            onPress={() => router.push(`/(screens)/attendance?siteId=${site.site_id}&siteName=${encodeURIComponent(site.site_name)}&dateStr=${date.toISOString()}` as any)}
                        >
                            <View style={local.cardHeader}>
                                <Text style={local.siteName}>{site.site_name}</Text>
                                {site.is_submitted ? (
                                    <View style={[local.badge, local.badgeSubmitted]}>
                                        <Ionicons name="checkmark-circle" size={14} color={isDark ? "#4caf50" : "#155724"} />
                                        <Text style={local.badgeTextSubmitted}>Submitted</Text>
                                    </View>
                                ) : (
                                    <View style={[local.badge, local.badgePending]}>
                                        <Ionicons name="time" size={14} color={isDark ? "#ffb300" : "#856404"} />
                                        <Text style={local.badgeTextPending}>Pending</Text>
                                    </View>
                                )}
                            </View>

                            <View style={local.divider} />

                            <View style={local.statsRow}>
                                <View style={local.statItem}>
                                    <Text style={local.statLabel}>Present</Text>
                                    <Text style={[local.statValue, { color: isDark ? '#4caf50' : '#28a745' }]}>{site.present_count}</Text>
                                </View>
                                <View style={local.statItem}>
                                    <Text style={local.statLabel}>Absent</Text>
                                    <Text style={[local.statValue, { color: isDark ? '#ef5350' : '#dc3545' }]}>{site.absent_count}</Text>
                                </View>
                                <View style={local.statItem}>
                                    <Text style={local.statLabel}>Total</Text>
                                    <Text style={local.statValue}>{site.total_labourers}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}

                    {reports.length === 0 && (
                        <Text style={local.emptyText}>No sites found.</Text>
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: isDark ? "#121212" : "#f4f6f8",
        paddingTop: 40,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingBottom: 15,
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        borderBottomWidth: 1,
        borderBottomColor: isDark ? "#333" : "#e0e0e0",
    },
    backBtnText: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    backText: {
        color: isDark ? "#4da6ff" : "#0a84ff",
        fontSize: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: isDark ? "#fff" : "#333",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 15,
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        borderBottomWidth: 1,
        borderBottomColor: isDark ? "#333" : "#e0e0e0",
    },
    arrowBtn: {
        padding: 10,
    },
    dateDisplay: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: isDark ? "#333" : "#f0f0f0",
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    dateText: {
        fontSize: 16,
        fontWeight: "600",
        color: isDark ? "#fff" : "#333",
    },
    scrollContent: {
        padding: 15,
    },
    card: {
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        borderRadius: 12,
        marginBottom: 15,
        padding: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    siteName: {
        fontSize: 18,
        fontWeight: "bold",
        color: isDark ? "#fff" : "#222",
    },
    badge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    badgeSubmitted: {
        backgroundColor: isDark ? "#1b4323" : "#d4edda",
    },
    badgePending: {
        backgroundColor: isDark ? "#403107" : "#fff3cd",
    },
    badgeTextSubmitted: {
        fontSize: 12,
        fontWeight: "bold",
        color: isDark ? "#4caf50" : "#155724",
    },
    badgeTextPending: {
        fontSize: 12,
        fontWeight: "bold",
        color: isDark ? "#ffb300" : "#856404",
    },
    divider: {
        height: 1,
        backgroundColor: isDark ? "#333" : "#eee",
        marginVertical: 10,
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-around",
    },
    statItem: {
        alignItems: "center",
    },
    statLabel: {
        fontSize: 12,
        color: isDark ? "#aaa" : "#666",
        marginBottom: 4,
    },
    statValue: {
        fontSize: 18,
        fontWeight: "bold",
        color: isDark ? "#fff" : "#333",
    },
    emptyText: {
        textAlign: "center",
        color: isDark ? "#aaa" : "#999",
        marginTop: 50,
        fontSize: 16,
    },
});
