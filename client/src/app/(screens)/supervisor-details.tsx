import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";

export default function SupervisorDetailsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { isDark } = useTheme();
    const local = getStyles(isDark);

    const [id] = useState(params.id);
    const [name, setName] = useState(params.name as string || "");
    const [phone, setPhone] = useState(params.phone as string || "");
    const [role, setRole] = useState(params.role as string || "");
    const [loadingDetails, setLoadingDetails] = useState(false);

    interface AdvanceItem {
        id: number;
        amount: number;
        date: string;
        notes?: string;
        labour_id: number;
        labour_name: string;
    }

    interface MonthGroup {
        month: string;
        total_amount: number;
        advances: AdvanceItem[];
    }

    const [advancesData, setAdvancesData] = useState<MonthGroup[]>([]);
    const [loadingAdvances, setLoadingAdvances] = useState(false);
    const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

    const fetchSupervisorDetails = useCallback(async () => {
        setLoadingDetails(true);
        try {
            const response = await api.get(`/auth/supervisors/${id}`);
            const data = await response.json();
            if (response.ok) {
                setName(data.name);
                setPhone(data.phone);
                setRole(data.role);
            } else {
                console.error("Failed to fetch supervisor details:", data);
            }
        } catch (error) {
            console.error("Fetch supervisor details error:", error);
        } finally {
            setLoadingDetails(false);
        }
    }, [id]);

    const fetchAdvances = useCallback(async () => {
        setLoadingAdvances(true);
        try {
            const response = await api.get(`/auth/supervisors/${id}/advances`);
            const data = await response.json();
            if (response.ok) {
                setAdvancesData(data);
                // Expand first month by default
                if (data.length > 0) {
                    setExpandedMonths({ [data[0].month]: true });
                }
            } else {
                console.error("Failed to fetch supervisor advances:", data);
            }
        } catch (error) {
            console.error("Fetch supervisor advances error:", error);
        } finally {
            setLoadingAdvances(false);
        }
    }, [id]);

    useFocusEffect(
        useCallback(() => {
            fetchSupervisorDetails();
            fetchAdvances();
        }, [fetchSupervisorDetails, fetchAdvances])
    );

    const toggleMonth = (month: string) => {
        setExpandedMonths(prev => ({
            ...prev,
            [month]: !prev[month]
        }));
    };

    const handlePrevYear = () => {
        setSelectedYear(prev => (parseInt(prev, 10) - 1).toString());
    };

    const handleNextYear = () => {
        setSelectedYear(prev => (parseInt(prev, 10) + 1).toString());
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };



    const filteredAdvances = advancesData.filter(group => group.month.endsWith(selectedYear));
    const currentYearVal = new Date().getFullYear();
    const isNextDisabled = parseInt(selectedYear, 10) >= currentYearVal;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={local.container}
            enabled={Platform.OS !== "web"}
        >
            <ScrollView contentContainerStyle={local.scrollContent}>
                <View style={local.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', }}>
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={local.backButton}
                        >
                            <Ionicons name="arrow-back" size={24} color={isDark ? "#fff" : "#333"} />
                        </TouchableOpacity>
                        <Text style={local.title}>Supervisor Details</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.push({
                            pathname: "/(screens)/edit-supervisor",
                            params: { id, name, phone, role }
                        })}
                        style={local.settingsButton}
                    >
                        <Ionicons name="settings-outline" size={24} color={isDark ? "#fff" : "#333"} />
                    </TouchableOpacity>
                </View>

                {/* Profile Card */}
                {loadingDetails ? (
                    <ActivityIndicator size="small" color="#0a84ff" style={{ marginVertical: 40 }} />
                ) : (
                    <View style={local.profileCard}>
                        <View style={local.avatarContainer}>
                            <View style={local.avatar}>
                                <Text style={local.avatarText}>
                                    {name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : ""}
                                </Text>
                            </View>
                        </View>
                        <Text style={local.profileName}>{name}</Text>
                        <View style={local.infoRow}>
                            <Ionicons name="call" size={16} color={isDark ? "#aaa" : "#666"} style={{ marginRight: 6 }} />
                            <Text style={local.profilePhone}>{phone}</Text>
                        </View>
                        {role ? (
                            <View style={local.badge}>
                                <Text style={local.badgeText}>
                                    {role === 'special_supervisor' ? 'SPECIAL SUPERVISOR' : 'SUPERVISOR'}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                )}

                {/* Advances list section */}
                <View style={local.advancesContainer}>
                    <Text style={local.sectionTitle}>Advances Given</Text>

                    {/* Year Selector with Left/Right Arrows */}
                    {!loadingAdvances && advancesData.length > 0 && (
                        <View style={local.yearSelectorContainer}>
                            <TouchableOpacity
                                style={local.arrowButton}
                                onPress={handlePrevYear}
                            >
                                <Ionicons name="chevron-back" size={20} color={isDark ? "#fff" : "#333"} />
                            </TouchableOpacity>
                            
                            <Text style={local.yearText}>{selectedYear}</Text>
                            
                            <TouchableOpacity
                                style={[local.arrowButton, isNextDisabled && local.disabledArrow]}
                                onPress={handleNextYear}
                                disabled={isNextDisabled}
                            >
                                <Ionicons 
                                    name="chevron-forward" 
                                    size={20} 
                                    color={isNextDisabled ? (isDark ? "#555" : "#ccc") : (isDark ? "#fff" : "#333")} 
                                />
                            </TouchableOpacity>
                        </View>
                    )}
                    
                    {loadingAdvances ? (
                        <ActivityIndicator size="small" color="#0a84ff" style={{ marginVertical: 20 }} />
                    ) : advancesData.length === 0 ? (
                        <View style={local.emptyState}>
                            <Ionicons name="cash-outline" size={32} color={isDark ? "#555" : "#ccc"} style={{ marginBottom: 6 }} />
                            <Text style={local.emptyText}>No advances recorded by this supervisor.</Text>
                        </View>
                    ) : filteredAdvances.length === 0 ? (
                        <View style={local.emptyState}>
                            <Ionicons name="cash-outline" size={32} color={isDark ? "#555" : "#ccc"} style={{ marginBottom: 6 }} />
                            <Text style={local.emptyText}>No advances found for year {selectedYear}.</Text>
                        </View>
                    ) : (
                        filteredAdvances.map((group) => {
                            const isExpanded = !!expandedMonths[group.month];
                            return (
                                <View key={group.month} style={local.monthGroup}>
                                    <TouchableOpacity
                                        style={local.monthHeader}
                                        onPress={() => toggleMonth(group.month)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={local.monthHeaderLeft}>
                                            <Ionicons
                                                name={isExpanded ? "chevron-down" : "chevron-forward"}
                                                size={18}
                                                color={isDark ? "#fff" : "#333"}
                                                style={{ marginRight: 8 }}
                                            />
                                            <Text style={local.monthName}>{group.month}</Text>
                                        </View>
                                        <Text style={local.monthTotal}>₹{group.total_amount.toLocaleString('en-IN')}</Text>
                                    </TouchableOpacity>

                                    {isExpanded && (
                                        <View style={local.monthBody}>
                                            {group.advances.map((adv) => (
                                                <View key={adv.id} style={local.advanceRow}>
                                                    <View style={local.advanceLeft}>
                                                        <Text style={local.labourName}>{adv.labour_name}</Text>
                                                        <Text style={local.advanceDate}>{formatDate(adv.date)}</Text>
                                                        {adv.notes ? (
                                                            <Text style={local.advanceNotes} numberOfLines={1}>
                                                                {adv.notes}
                                                            </Text>
                                                        ) : null}
                                                    </View>
                                                    <Text style={local.advanceAmount}>₹{adv.amount.toLocaleString('en-IN')}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: isDark ? "#121212" : "#f5f6fa",
    },
    scrollContent: {
        flexGrow: 1,
        padding: 20,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent:"space-between",
        marginBottom: 30,
        marginTop: 10,
    },
    backButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        marginRight: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    title: {
        fontSize: 24,
        fontWeight: "700",
        color: isDark ? "#fff" : "#2d3436",
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: isDark ? "#aaa" : "#636e72",
        marginBottom: 20,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    settingsButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        marginRight: 0,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    profileCard: {
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        borderRadius: 16,
        padding: 24,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.05,
        shadowRadius: 8,
        elevation: 3,
        marginBottom: 20,
    },
    avatarContainer: {
        marginBottom: 16,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "#0a84ff",
        justifyContent: "center",
        alignItems: "center",
    },
    avatarText: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#fff",
    },
    profileName: {
        fontSize: 22,
        fontWeight: "700",
        color: isDark ? "#fff" : "#2d3436",
        marginBottom: 8,
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    profilePhone: {
        fontSize: 16,
        color: isDark ? "#aaa" : "#636e72",
    },
    badge: {
        backgroundColor: isDark ? "#172d42" : "#e3f2fd",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isDark ? "#1d4469" : "#bbdefb",
    },
    badgeText: {
        color: "#0a84ff",
        fontSize: 12,
        fontWeight: "600",
        letterSpacing: 0.5,
    },
    advancesContainer: {
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        borderRadius: 16,
        padding: 20,
        marginTop: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.05,
        shadowRadius: 8,
        elevation: 3,
        marginBottom: 20,
    },
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 30,
    },
    emptyText: {
        fontSize: 14,
        color: isDark ? "#888" : "#8a8a8f",
        marginTop: 10,
        textAlign: "center",
    },
    monthGroup: {
        marginBottom: 12,
        borderWidth: 1,
        borderColor: isDark ? "#333" : "#e1e1e1",
        borderRadius: 12,
        overflow: "hidden",
    },
    monthHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: isDark ? "#2a2a2a" : "#f5f6fa",
    },
    monthHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    monthName: {
        fontSize: 16,
        fontWeight: "600",
        color: isDark ? "#fff" : "#2d3436",
    },
    monthTotal: {
        fontSize: 16,
        fontWeight: "700",
        color: isDark ? "#ef9a9a" : "#c62828",
    },
    monthBody: {
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    advanceRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: isDark ? "#333" : "#e1e1e1",
    },
    advanceLeft: {
        flex: 1,
        marginRight: 10,
    },
    labourName: {
        fontSize: 15,
        fontWeight: "600",
        color: isDark ? "#fff" : "#2d3436",
        marginBottom: 2,
    },
    advanceDate: {
        fontSize: 13,
        color: isDark ? "#aaa" : "#636e72",
        marginBottom: 2,
    },
    advanceNotes: {
        fontSize: 12,
        color: isDark ? "#888" : "#8a8a8f",
        fontStyle: "italic",
    },
    advanceAmount: {
        fontSize: 15,
        fontWeight: "600",
        color: isDark ? "#ef9a9a" : "#c62828",
    },
    yearSelectorContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 15,
        backgroundColor: isDark ? "#2a2a2a" : "#f5f6fa",
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        alignSelf: "center",
        borderWidth: 1,
        borderColor: isDark ? "#333" : "#e1e1e1",
    },
    arrowButton: {
        padding: 6,
    },
    disabledArrow: {
        opacity: 0.3,
    },
    yearText: {
        fontSize: 16,
        fontWeight: "700",
        color: isDark ? "#fff" : "#2d3436",
        marginHorizontal: 25,
        minWidth: 50,
        textAlign: "center",
    },
});
