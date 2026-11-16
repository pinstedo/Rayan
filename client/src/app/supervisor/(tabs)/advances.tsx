import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdvanceModal } from "../../../components/AdvanceModal";
import { AppRefreshControl, TopRefreshLoader } from "../../../components/RefreshFeedback";
import { useTheme } from "../../../context/ThemeContext";
import { useForegroundEffect } from "../../../hooks/useForegroundEffect";
import { api } from "../../../services/api";

interface AdvanceItem {
    id: number;
    amount: number;
    date: string;
    notes?: string;
    labour_id: number;
    labour_name: string;
    labour_phone?: string;
    site_name?: string;
}

interface MonthGroup {
    month: string;
    total_amount: number;
    advances: AdvanceItem[];
}

interface AssignedLabour {
    id: number;
    name: string;
    phone?: string;
    site?: string;
}

export default function SupervisorAdvancesScreen() {
    const router = useRouter();
    const { isDark } = useTheme();
    const styles = getStyles(isDark);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [advancesData, setAdvancesData] = useState<MonthGroup[]>([]);
    const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>("all");

    // Supervisor user info
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);

    // "+ Give Advance" workflow
    const [assignedLabours, setAssignedLabours] = useState<AssignedLabour[]>([]);
    const [showLabourPicker, setShowLabourPicker] = useState(false);
    const [labourSearchQuery, setLabourSearchQuery] = useState("");
    const [selectedLabourForAdvance, setSelectedLabourForAdvance] = useState<AssignedLabour | null>(null);
    const [showAdvanceModal, setShowAdvanceModal] = useState(false);

    const fetchAdvances = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const userDataStr = await AsyncStorage.getItem("userData");
            if (!userDataStr) {
                Alert.alert("Error", "User session not found. Please log in again.");
                return;
            }

            const user = JSON.parse(userDataStr);
            setCurrentUserId(user.id);

            // Fetch advances given by this supervisor
            const res = await api.get(`/auth/supervisors/${user.id}/advances`);
            if (res.ok) {
                const data: MonthGroup[] = await res.json();
                setAdvancesData(data);
                // Expand the first (latest) month by default
                if (data.length > 0) {
                    setExpandedMonths({ [data[0].month]: true });
                }
            } else {
                const err = await res.json();
                console.error("Failed to fetch advances:", err);
            }

            // Also fetch assigned labours for quick "+ Give Advance" action
            const laboursRes = await api.get(`/labours?supervisor_id=${user.id}`);
            if (laboursRes.ok) {
                const laboursData = await laboursRes.json();
                setAssignedLabours(laboursData);
            }
        } catch (error) {
            console.error("Fetch supervisor advances error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchAdvances();
        }, [fetchAdvances])
    );

    useForegroundEffect(() => {
        fetchAdvances();
    });

    const onRefresh = () => {
        fetchAdvances(true);
    };

    const toggleMonth = (month: string) => {
        setExpandedMonths((prev) => ({
            ...prev,
            [month]: !prev[month],
        }));
    };

    const handlePrevYear = () => {
        setSelectedYear((prev) => (parseInt(prev, 10) - 1).toString());
        setSelectedMonthFilter("all");
    };

    const handleNextYear = () => {
        setSelectedYear((prev) => (parseInt(prev, 10) + 1).toString());
        setSelectedMonthFilter("all");
    };

    const currentYearVal = new Date().getFullYear();
    const isNextDisabled = parseInt(selectedYear, 10) >= currentYearVal;

    // Filter month groups by year
    const yearGroups = useMemo(() => {
        return advancesData.filter((group) => group.month.endsWith(selectedYear));
    }, [advancesData, selectedYear]);

    // Available months in selected year
    const availableMonths = useMemo(() => {
        return yearGroups.map((g) => g.month);
    }, [yearGroups]);

    // Compute metrics for the selected year
    const stats = useMemo(() => {
        const now = new Date();
        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        const currentMonthName = `${months[now.getMonth()]} ${now.getFullYear()}`;

        let yearlyTotal = 0;
        let yearlyAdvancesCount = 0;
        const uniqueLabours = new Set<number>();
        let currentMonthTotal = 0;

        for (const group of yearGroups) {
            yearlyTotal += group.total_amount;
            yearlyAdvancesCount += group.advances.length;
            for (const adv of group.advances) {
                uniqueLabours.add(adv.labour_id);
            }
            if (group.month === currentMonthName) {
                currentMonthTotal = group.total_amount;
            }
        }

        return {
            yearlyTotal,
            yearlyAdvancesCount,
            uniqueLaboursCount: uniqueLabours.size,
            currentMonthTotal,
            currentMonthLabel: months[now.getMonth()],
        };
    }, [yearGroups]);

    // Filter advances by month filter & search query
    const filteredMonthGroups = useMemo(() => {
        let groups = yearGroups;

        if (selectedMonthFilter !== "all") {
            groups = groups.filter((g) => g.month === selectedMonthFilter);
        }

        if (!searchQuery.trim()) {
            return groups;
        }

        const q = searchQuery.toLowerCase().trim();
        return groups
            .map((group) => {
                const matchedAdvances = group.advances.filter((adv) => {
                    const nameMatch = adv.labour_name?.toLowerCase().includes(q);
                    const phoneMatch = adv.labour_phone?.toLowerCase().includes(q);
                    const siteMatch = adv.site_name?.toLowerCase().includes(q);
                    const notesMatch = adv.notes?.toLowerCase().includes(q);
                    const amountMatch = adv.amount.toString().includes(q);
                    return nameMatch || phoneMatch || siteMatch || notesMatch || amountMatch;
                });

                const groupTotal = matchedAdvances.reduce((sum, a) => sum + a.amount, 0);

                return {
                    ...group,
                    total_amount: groupTotal,
                    advances: matchedAdvances,
                };
            })
            .filter((group) => group.advances.length > 0);
    }, [yearGroups, selectedMonthFilter, searchQuery]);

    const formatDate = (dateStr: string) => {
        try {
            if (!dateStr) return "";
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [y, m, d] = dateStr.split("-").map(Number);
                const localDate = new Date(y, m - 1, d);
                return localDate.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                });
            }
            return new Date(dateStr).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            });
        } catch {
            return dateStr;
        }
    };

    // Filter assigned labours in picker
    const filteredPickerLabours = useMemo(() => {
        if (!labourSearchQuery.trim()) return assignedLabours;
        const q = labourSearchQuery.toLowerCase().trim();
        return assignedLabours.filter(
            (l) => l.name.toLowerCase().includes(q) || (l.phone && l.phone.includes(q))
        );
    }, [assignedLabours, labourSearchQuery]);

    const handleSelectLabourForAdvance = (labour: AssignedLabour) => {
        setSelectedLabourForAdvance(labour);
        setShowLabourPicker(false);
        setLabourSearchQuery("");
        setShowAdvanceModal(true);
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <TopRefreshLoader visible={refreshing} />

                {/* Header Row */}
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.subtitle}>Track Advance Payments</Text>
                        <Text style={styles.title}>My Advances</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.giveAdvanceBtn}
                        onPress={() => setShowLabourPicker(true)}
                        activeOpacity={0.8}
                    >
                        <MaterialIcons name="add" size={20} color="#FFFFFF" />
                        <Text style={styles.giveAdvanceBtnText}>Give Advance</Text>
                    </TouchableOpacity>
                </View>

                {/* Year Navigation Bar */}
                <View style={styles.yearBar}>
                    <TouchableOpacity
                        style={styles.yearNavBtn}
                        onPress={handlePrevYear}
                        accessibilityLabel="Previous year"
                    >
                        <Ionicons name="chevron-back" size={20} color={isDark ? "#F1F5F9" : "#0F172A"} />
                    </TouchableOpacity>

                    <View style={styles.yearBadge}>
                        <MaterialIcons name="calendar-today" size={16} color="#3B82F6" />
                        <Text style={styles.yearText}>{selectedYear}</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.yearNavBtn, isNextDisabled && styles.yearNavBtnDisabled]}
                        onPress={handleNextYear}
                        disabled={isNextDisabled}
                        accessibilityLabel="Next year"
                    >
                        <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={isNextDisabled ? (isDark ? "#475569" : "#CBD5E1") : (isDark ? "#F1F5F9" : "#0F172A")}
                        />
                    </TouchableOpacity>
                </View>

                {/* KPI Metrics Cards */}
                <View style={styles.kpiContainer}>
                    {/* This Month's Advance */}
                    <View style={styles.kpiCard}>
                        <View style={[styles.kpiIconWrap, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5" }]}>
                            <MaterialIcons name="payments" size={22} color="#10B981" />
                        </View>
                        <Text style={styles.kpiLabel}>{stats.currentMonthLabel} Advances</Text>
                        <Text style={[styles.kpiValue, { color: isDark ? "#34D399" : "#059669" }]}>
                            ₹{stats.currentMonthTotal.toLocaleString("en-IN")}
                        </Text>
                        <Text style={styles.kpiSub}>Current month</Text>
                    </View>

                    {/* Yearly Total */}
                    <View style={styles.kpiCard}>
                        <View style={[styles.kpiIconWrap, { backgroundColor: isDark ? "rgba(59, 130, 246, 0.15)" : "#EFF6FF" }]}>
                            <MaterialIcons name="account-balance-wallet" size={22} color="#3B82F6" />
                        </View>
                        <Text style={styles.kpiLabel}>{selectedYear} Total</Text>
                        <Text style={[styles.kpiValue, { color: isDark ? "#60A5FA" : "#2563EB" }]}>
                            ₹{stats.yearlyTotal.toLocaleString("en-IN")}
                        </Text>
                        <Text style={styles.kpiSub}>{stats.yearlyAdvancesCount} records</Text>
                    </View>

                    {/* Distinct Labours */}
                    <View style={styles.kpiCard}>
                        <View style={[styles.kpiIconWrap, { backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7" }]}>
                            <MaterialIcons name="group" size={22} color="#F59E0B" />
                        </View>
                        <Text style={styles.kpiLabel}>Labours Assisted</Text>
                        <Text style={[styles.kpiValue, { color: isDark ? "#FBBF24" : "#D97706" }]}>
                            {stats.uniqueLaboursCount}
                        </Text>
                        <Text style={styles.kpiSub}>In {selectedYear}</Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={isDark ? "#94A3B8" : "#64748B"} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by labour name, site, or note..."
                        placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
                            <Ionicons name="close-circle" size={18} color={isDark ? "#94A3B8" : "#64748B"} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Month Filter Chips (if more than 1 month in year) */}
                {availableMonths.length > 1 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.monthChipsContainer}
                    >
                        <Pressable
                            style={[
                                styles.monthChip,
                                selectedMonthFilter === "all" && styles.monthChipActive,
                            ]}
                            onPress={() => setSelectedMonthFilter("all")}
                        >
                            <Text
                                style={[
                                    styles.monthChipText,
                                    selectedMonthFilter === "all" && styles.monthChipTextActive,
                                ]}
                            >
                                All Months
                            </Text>
                        </Pressable>

                        {availableMonths.map((m) => {
                            const shortMonth = m.replace(` ${selectedYear}`, "");
                            const isSelected = selectedMonthFilter === m;
                            return (
                                <Pressable
                                    key={m}
                                    style={[styles.monthChip, isSelected && styles.monthChipActive]}
                                    onPress={() => setSelectedMonthFilter(isSelected ? "all" : m)}
                                >
                                    <Text
                                        style={[
                                            styles.monthChipText,
                                            isSelected && styles.monthChipTextActive,
                                        ]}
                                    >
                                        {shortMonth}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                )}

                {/* Content Section: Monthly Accordions */}
                <View style={styles.contentSection}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#3B82F6" />
                            <Text style={styles.loadingText}>Loading your advances...</Text>
                        </View>
                    ) : advancesData.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <MaterialIcons name="account-balance-wallet" size={48} color={isDark ? "#475569" : "#CBD5E1"} />
                            <Text style={styles.emptyTitle}>No Advances Recorded</Text>
                            <Text style={styles.emptySubtitle}>
                                Advances you give to labours will appear here. Tap below to give an advance.
                            </Text>
                            <TouchableOpacity
                                style={[styles.giveAdvanceBtn, { marginTop: 16 }]}
                                onPress={() => setShowLabourPicker(true)}
                            >
                                <MaterialIcons name="add" size={20} color="#FFFFFF" />
                                <Text style={styles.giveAdvanceBtnText}>Give First Advance</Text>
                            </TouchableOpacity>
                        </View>
                    ) : filteredMonthGroups.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <MaterialIcons name="search-off" size={44} color={isDark ? "#475569" : "#CBD5E1"} />
                            <Text style={styles.emptyTitle}>No Matching Records</Text>
                            <Text style={styles.emptySubtitle}>
                                No advances found for {selectedYear}
                                {searchQuery ? ` matching "${searchQuery}"` : ""}.
                            </Text>
                        </View>
                    ) : (
                        filteredMonthGroups.map((group) => {
                            const isExpanded = !!expandedMonths[group.month];
                            return (
                                <View key={group.month} style={styles.monthCard}>
                                    {/* Month Accordion Header */}
                                    <TouchableOpacity
                                        style={styles.monthHeader}
                                        onPress={() => toggleMonth(group.month)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.monthHeaderLeft}>
                                            <View style={styles.chevronWrap}>
                                                <Ionicons
                                                    name={isExpanded ? "chevron-down" : "chevron-forward"}
                                                    size={18}
                                                    color={isDark ? "#F1F5F9" : "#0F172A"}
                                                />
                                            </View>
                                            <View>
                                                <Text style={styles.monthTitle}>{group.month}</Text>
                                                <Text style={styles.monthSub}>
                                                    {group.advances.length} payment{group.advances.length === 1 ? "" : "s"}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.monthHeaderRight}>
                                            <Text style={styles.monthTotal}>
                                                ₹{group.total_amount.toLocaleString("en-IN")}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    {/* Expanded Advance Records */}
                                    {isExpanded && (
                                        <View style={styles.advancesList}>
                                            {group.advances.map((adv, index) => (
                                                <View
                                                    key={adv.id}
                                                    style={[
                                                        styles.advanceItem,
                                                        index === group.advances.length - 1 && styles.advanceItemLast,
                                                    ]}
                                                >
                                                    {/* Left Avatar */}
                                                    <View style={styles.labourAvatar}>
                                                        <Text style={styles.labourAvatarText}>
                                                            {adv.labour_name ? adv.labour_name.charAt(0).toUpperCase() : "L"}
                                                        </Text>
                                                    </View>

                                                    {/* Middle Details */}
                                                    <View style={styles.advanceDetails}>
                                                        <Text style={styles.labourName}>{adv.labour_name}</Text>

                                                        <View style={styles.metaRow}>
                                                            <View style={styles.metaChip}>
                                                                <MaterialIcons name="location-city" size={13} color={isDark ? "#94A3B8" : "#64748B"} />
                                                                <Text style={styles.metaChipText} numberOfLines={1}>
                                                                    {adv.site_name || "Unassigned"}
                                                                </Text>
                                                            </View>

                                                            <Text style={styles.advanceDate}>
                                                                {formatDate(adv.date)}
                                                            </Text>
                                                        </View>

                                                        {adv.notes ? (
                                                            <View style={styles.notesRow}>
                                                                <MaterialIcons name="notes" size={13} color={isDark ? "#94A3B8" : "#64748B"} />
                                                                <Text style={styles.advanceNotes} numberOfLines={2}>
                                                                    {adv.notes}
                                                                </Text>
                                                            </View>
                                                        ) : null}
                                                    </View>

                                                    {/* Right Amount */}
                                                    <View style={styles.amountContainer}>
                                                        <Text style={styles.advanceAmount}>
                                                            ₹{adv.amount.toLocaleString("en-IN")}
                                                        </Text>
                                                    </View>
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

            {/* Modal to Select Labour for Giving Advance */}
            <Modal
                visible={showLabourPicker}
                animationType="slide"
                transparent
                onRequestClose={() => setShowLabourPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Labour</Text>
                            <Pressable onPress={() => setShowLabourPicker(false)}>
                                <Ionicons name="close" size={24} color={isDark ? "#F1F5F9" : "#0F172A"} />
                            </Pressable>
                        </View>

                        <View style={styles.modalSearchBox}>
                            <Ionicons name="search" size={18} color={isDark ? "#94A3B8" : "#64748B"} style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.modalSearchInput}
                                placeholder="Search assigned labour..."
                                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                                value={labourSearchQuery}
                                onChangeText={setLabourSearchQuery}
                            />
                        </View>

                        {assignedLabours.length === 0 ? (
                            <View style={styles.emptyPicker}>
                                <Text style={styles.emptyPickerText}>No labours assigned to your sites.</Text>
                            </View>
                        ) : filteredPickerLabours.length === 0 ? (
                            <View style={styles.emptyPicker}>
                                <Text style={styles.emptyPickerText}>No labours match "{labourSearchQuery}".</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={filteredPickerLabours}
                                keyExtractor={(item) => item.id.toString()}
                                style={styles.labourList}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.labourItem}
                                        onPress={() => handleSelectLabourForAdvance(item)}
                                    >
                                        <View style={styles.labourItemAvatar}>
                                            <Text style={styles.labourAvatarText}>
                                                {item.name ? item.name.charAt(0).toUpperCase() : "L"}
                                            </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.labourItemName}>{item.name}</Text>
                                            <Text style={styles.labourItemSub}>
                                                {item.site ? `${item.site} • ` : ""}{item.phone || "No phone"}
                                            </Text>
                                        </View>
                                        <MaterialIcons name="add-circle-outline" size={24} color="#10B981" />
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* AdvanceModal to input amount and record advance */}
            {selectedLabourForAdvance && (
                <AdvanceModal
                    visible={showAdvanceModal}
                    onClose={() => {
                        setShowAdvanceModal(false);
                        setSelectedLabourForAdvance(null);
                    }}
                    onSuccess={() => {
                        fetchAdvances(true);
                    }}
                    labour={selectedLabourForAdvance}
                    currentUserId={currentUserId}
                />
            )}
        </SafeAreaView>
    );
}

const getStyles = (isDark: boolean) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
        },
        scrollContent: {
            paddingBottom: 40,
        },
        headerRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: Platform.OS === "web" ? 32 : 16,
            paddingBottom: 16,
        },
        subtitle: {
            fontSize: 13,
            fontWeight: "500",
            color: isDark ? "#94A3B8" : "#64748B",
            marginBottom: 2,
        },
        title: {
            fontSize: 28,
            fontWeight: "800",
            color: isDark ? "#F1F5F9" : "#0F172A",
        },
        giveAdvanceBtn: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#10B981",
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 20,
            gap: 6,
            shadowColor: "#10B981",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 3,
        },
        giveAdvanceBtnText: {
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: "700",
        },
        yearBar: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 20,
            marginBottom: 16,
        },
        yearBadge: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            gap: 8,
            borderWidth: 1,
            borderColor: isDark ? "#334155" : "#E2E8F0",
        },
        yearText: {
            fontSize: 16,
            fontWeight: "700",
            color: isDark ? "#F1F5F9" : "#0F172A",
        },
        yearNavBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: isDark ? "#334155" : "#E2E8F0",
        },
        yearNavBtnDisabled: {
            opacity: 0.4,
        },
        kpiContainer: {
            flexDirection: "row",
            paddingHorizontal: 20,
            gap: 10,
            marginBottom: 20,
        },
        kpiCard: {
            flex: 1,
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            borderRadius: 18,
            padding: 12,
            alignItems: "flex-start",
            borderWidth: 1,
            borderColor: isDark ? "#334155" : "#E2E8F0",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.2 : 0.04,
            shadowRadius: 6,
            elevation: 2,
        },
        kpiIconWrap: {
            width: 36,
            height: 36,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
        },
        kpiLabel: {
            fontSize: 11,
            fontWeight: "600",
            color: isDark ? "#94A3B8" : "#64748B",
            marginBottom: 4,
        },
        kpiValue: {
            fontSize: 17,
            fontWeight: "800",
            marginBottom: 2,
        },
        kpiSub: {
            fontSize: 10,
            color: isDark ? "#64748B" : "#94A3B8",
        },
        searchContainer: {
            flexDirection: "row",
            alignItems: "center",
            marginHorizontal: 20,
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: isDark ? "#334155" : "#E2E8F0",
            marginBottom: 14,
        },
        searchInput: {
            flex: 1,
            fontSize: 14,
            color: isDark ? "#F1F5F9" : "#0F172A",
            padding: 0,
        },
        monthChipsContainer: {
            paddingHorizontal: 20,
            gap: 8,
            marginBottom: 16,
        },
        monthChip: {
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 16,
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            borderWidth: 1,
            borderColor: isDark ? "#334155" : "#E2E8F0",
        },
        monthChipActive: {
            backgroundColor: "#3B82F6",
            borderColor: "#3B82F6",
        },
        monthChipText: {
            fontSize: 13,
            fontWeight: "600",
            color: isDark ? "#94A3B8" : "#64748B",
        },
        monthChipTextActive: {
            color: "#FFFFFF",
        },
        contentSection: {
            paddingHorizontal: 20,
        },
        loadingContainer: {
            alignItems: "center",
            paddingVertical: 40,
        },
        loadingText: {
            fontSize: 14,
            color: isDark ? "#94A3B8" : "#64748B",
            marginTop: 12,
        },
        emptyCard: {
            alignItems: "center",
            padding: 36,
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            borderRadius: 20,
            borderWidth: 1,
            borderColor: isDark ? "#334155" : "#E2E8F0",
            borderStyle: "dashed",
            marginTop: 8,
        },
        emptyTitle: {
            fontSize: 17,
            fontWeight: "700",
            color: isDark ? "#F1F5F9" : "#0F172A",
            marginTop: 14,
        },
        emptySubtitle: {
            fontSize: 13,
            color: isDark ? "#94A3B8" : "#64748B",
            marginTop: 6,
            textAlign: "center",
            lineHeight: 18,
        },
        monthCard: {
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            borderRadius: 20,
            marginBottom: 14,
            borderWidth: 1,
            borderColor: isDark ? "#334155" : "#E2E8F0",
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.2 : 0.04,
            shadowRadius: 6,
            elevation: 2,
        },
        monthHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: isDark ? "rgba(30, 41, 59, 0.7)" : "#FFFFFF",
        },
        monthHeaderLeft: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
        },
        chevronWrap: {
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: isDark ? "#334155" : "#F1F5F9",
            alignItems: "center",
            justifyContent: "center",
        },
        monthTitle: {
            fontSize: 16,
            fontWeight: "700",
            color: isDark ? "#F1F5F9" : "#0F172A",
        },
        monthSub: {
            fontSize: 12,
            color: isDark ? "#94A3B8" : "#64748B",
            marginTop: 1,
        },
        monthHeaderRight: {
            alignItems: "flex-end",
        },
        monthTotal: {
            fontSize: 17,
            fontWeight: "800",
            color: isDark ? "#34D399" : "#059669",
        },
        advancesList: {
            borderTopWidth: 1,
            borderTopColor: isDark ? "#334155" : "#F1F5F9",
            backgroundColor: isDark ? "#162032" : "#F8FAFC",
            paddingHorizontal: 16,
            paddingVertical: 8,
        },
        advanceItem: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? "#1E293B" : "#EDF2F7",
        },
        advanceItemLast: {
            borderBottomWidth: 0,
        },
        labourAvatar: {
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: isDark ? "#334155" : "#E2E8F0",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
        },
        labourAvatarText: {
            fontSize: 15,
            fontWeight: "700",
            color: isDark ? "#60A5FA" : "#2563EB",
        },
        advanceDetails: {
            flex: 1,
        },
        labourName: {
            fontSize: 15,
            fontWeight: "700",
            color: isDark ? "#F1F5F9" : "#0F172A",
            marginBottom: 4,
        },
        metaRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
        },
        metaChip: {
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            backgroundColor: isDark ? "#1E293B" : "#E2E8F0",
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            maxWidth: 140,
        },
        metaChipText: {
            fontSize: 11,
            color: isDark ? "#94A3B8" : "#475569",
        },
        advanceDate: {
            fontSize: 12,
            color: isDark ? "#94A3B8" : "#64748B",
        },
        notesRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginTop: 4,
        },
        advanceNotes: {
            fontSize: 12,
            fontStyle: "italic",
            color: isDark ? "#94A3B8" : "#64748B",
            flex: 1,
        },
        amountContainer: {
            alignItems: "flex-end",
            marginLeft: 10,
        },
        advanceAmount: {
            fontSize: 16,
            fontWeight: "800",
            color: isDark ? "#34D399" : "#059669",
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "flex-end",
        },
        modalContent: {
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "80%",
            padding: 20,
        },
        modalHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
        },
        modalTitle: {
            fontSize: 20,
            fontWeight: "700",
            color: isDark ? "#F1F5F9" : "#0F172A",
        },
        modalSearchBox: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: isDark ? "#0F172A" : "#F1F5F9",
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginBottom: 14,
        },
        modalSearchInput: {
            flex: 1,
            fontSize: 14,
            color: isDark ? "#F1F5F9" : "#0F172A",
        },
        labourList: {
            maxHeight: 360,
        },
        labourItem: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? "#334155" : "#F1F5F9",
        },
        labourItemAvatar: {
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: isDark ? "#334155" : "#E2E8F0",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
        },
        labourItemName: {
            fontSize: 15,
            fontWeight: "600",
            color: isDark ? "#F1F5F9" : "#0F172A",
        },
        labourItemSub: {
            fontSize: 12,
            color: isDark ? "#94A3B8" : "#64748B",
            marginTop: 2,
        },
        emptyPicker: {
            padding: 30,
            alignItems: "center",
        },
        emptyPickerText: {
            fontSize: 14,
            color: isDark ? "#94A3B8" : "#64748B",
            textAlign: "center",
        },
    });
