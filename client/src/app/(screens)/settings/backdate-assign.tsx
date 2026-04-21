import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from 'expo-haptics';
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { Calendar } from "../../../components/Calendar";
import { CustomModal } from "../../../components/CustomModal";
import { SearchBar } from "../../../components/list";
import { useTheme } from "../../../context/ThemeContext";
import { useListManager } from "../../../hooks/useListManager";
import { api } from "../../../services/api";
import { sortByName } from "../../../utils/sort";

interface Site {
    id: number;
    name: string;
}

interface Labour {
    id: number;
    name: string;
    phone: string;
    site?: string;
    site_id?: number;
    status?: string;
}

export default function BackdateAssign() {
    const router = useRouter();
    const { isDark } = useTheme();
    const styles = getStyles(isDark);

    const [date, setDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1); // Default to yesterday
        return d;
    });
    const [showCalendar, setShowCalendar] = useState(false);

    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSite, setSelectedSite] = useState<Site | null>(null);
    const [showSitePicker, setShowSitePicker] = useState(false);

    const [labours, setLabours] = useState<Labour[]>([]);
    const [selectedLabourIds, setSelectedLabourIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successCount, setSuccessCount] = useState(0);
    const [successSite, setSuccessSite] = useState("");

    const listManager = useListManager<Labour>({
        initialData: labours,
        initialConfig: {
            search: { text: "", fields: ["name", "phone", "site"] },
            sort: [{ field: "name", order: "asc", type: "string" }]
        }
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [sitesRes, laboursRes] = await Promise.all([
                api.get('/sites?status=active'),
                api.get('/labours')
            ]);

            if (sitesRes.ok) {
                const sData = await sitesRes.json();
                setSites(sortByName(sData));
            }
            if (laboursRes.ok) {
                const lData = await laboursRes.json();
                // We show all labours except pending/deleted
                const filtered = lData.filter((l: Labour) => l.status !== 'pending');
                setLabours(filtered);
            }
        } catch (error) {
            console.error("Fetch Data Error:", error);
            Alert.alert("Error", "Unable to fetch data");
        } finally {
            setLoading(false);
        }
    };

    const handleDateSelect = (selectedDate: Date) => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (selectedDate > today) {
            Alert.alert("Validation Error", "Cannot select a future date.");
            return;
        }
        setDate(selectedDate);
        setShowCalendar(false);
    };

    const toggleLabourSelection = (id: number) => {
        try {
            if (Platform.OS !== 'web') Haptics.selectionAsync();
        } catch (e) { }
        setSelectedLabourIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        try {
            if (Platform.OS !== 'web') Haptics.selectionAsync();
        } catch (e) { }
        if (selectedLabourIds.size === listManager.data.length && listManager.data.length > 0) {
            setSelectedLabourIds(new Set());
        } else {
            const allIds = listManager.data.map(l => l.id);
            setSelectedLabourIds(new Set(allIds));
        }
    };

    const handleSubmit = async () => {
        if (!selectedSite) {
            Alert.alert("Error", "Please select a site to assign labours to.");
            return;
        }
        if (selectedLabourIds.size === 0) {
            Alert.alert("Error", "Please select at least one labour.");
            return;
        }

        try {
            setSubmitting(true);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const response = await api.post('/labours/backdate-assign', {
                from_date: dateStr,
                site_id: selectedSite.id,
                labour_ids: Array.from(selectedLabourIds)
            });

            if (response.ok) {
                try {
                    if (Platform.OS !== 'web') {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                } catch (e) {
                    // Ignore haptics errors on unsupported platforms
                }

                // Show success popup before clearing state
                setSuccessCount(selectedLabourIds.size);
                setSuccessSite(selectedSite?.name ?? "");
                setShowSuccessModal(true);
            } else {
                const data = await response.json();
                Alert.alert("Error", data.error || "Failed to make backdated assignment.");
            }
        } catch (error) {
            console.error("Backdate assign error:", error);
            Alert.alert("Error", "Unable to connect to server.");
        } finally {
            setSubmitting(false);
        }
    };

    const renderLabour = ({ item }: { item: Labour }) => {
        const isSelected = selectedLabourIds.has(item.id);
        const statusText = item.status === 'unassigned' ? 'Unassigned' : item.site || 'Unknown';

        return (
            <TouchableOpacity
                style={[styles.labourCard, isSelected && styles.labourCardSelected]}
                onPress={() => toggleLabourSelection(item.id)}
                activeOpacity={0.7}
            >
                <View style={styles.labourInfo}>
                    <Text style={[styles.labourName, isSelected && styles.labourNameSelected]}>{item.name}</Text>
                    <Text style={styles.labourPhone}>{item.phone}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{statusText}</Text>
                    </View>
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <MaterialIcons name="check" size={16} color="#fff" />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={isDark ? "#F1F5F9" : "#0F172A"} />
                </Pressable>
                <Text style={styles.title}>Historic Assignment</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.listSection}>
                {loading ? (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color="#3B82F6" />
                    </View>
                ) : (
                    <FlatList
                        ListHeaderComponent={
                            <View style={{ paddingBottom: 8 }}>
                                <View style={styles.infoBox}>
                                    <MaterialIcons name="info-outline" size={20} color={isDark ? "#93C5FD" : "#2563EB"} />
                                    <Text style={styles.infoText}>
                                        Use this tool to assign a set of labours to a site from a past date. This closes their existing site assignment from the selected date.
                                    </Text>
                                </View>

                                <View style={styles.formRow}>
                                    <View style={styles.halfWidth}>
                                        <Text style={styles.label}>Assignment Date</Text>
                                        <TouchableOpacity style={styles.picker} onPress={() => setShowCalendar(true)}>
                                            <MaterialIcons name="event" size={20} color={isDark ? "#94A3B8" : "#64748B"} />
                                            <Text style={styles.pickerText}>{date.toLocaleDateString()}</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.halfWidth}>
                                        <Text style={styles.label}>Destination Site</Text>
                                        <TouchableOpacity style={styles.picker} onPress={() => setShowSitePicker(true)}>
                                            <MaterialIcons name="location-city" size={20} color={isDark ? "#94A3B8" : "#64748B"} />
                                            <Text style={styles.pickerText} numberOfLines={1}>
                                                {selectedSite ? selectedSite.name : "Select Site..."}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.listHeaderWrapper}>
                                    <View style={styles.listHeader}>
                                        <Text style={styles.sectionTitle}>Select Labours</Text>
                                        <TouchableOpacity onPress={handleSelectAll}>
                                            <Text style={styles.selectAllText}>
                                                {selectedLabourIds.size === listManager.data.length && listManager.data.length > 0 ? "Deselect All" : "Select All"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    <SearchBar
                                        value={listManager.searchText}
                                        onChangeText={listManager.setSearchText}
                                        placeholder="Search visible list..."
                                        style={{ marginBottom: 12 }}
                                    />
                                </View>
                            </View>
                        }
                        data={listManager.data}
                        keyExtractor={item => item.id.toString()}
                        renderItem={renderLabour}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                        ListEmptyComponent={<Text style={styles.emptyText}>No labours found.</Text>}
                    />
                )}
            </View>

            {selectedLabourIds.size > 0 && (
                <View style={styles.floatingFooter}>
                    <TouchableOpacity
                        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.submitBtnText}>
                                Assign {selectedLabourIds.size} Labour{selectedLabourIds.size !== 1 && 's'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* Success Modal */}
            <CustomModal
                visible={showSuccessModal}
                onClose={() => {
                    setShowSuccessModal(false);
                    setSelectedLabourIds(new Set());
                    setSelectedSite(null);
                    fetchData();
                }}
                title="Assignment Successful"
                actions={[
                    {
                        text: "Done",
                        onPress: () => {
                            setShowSuccessModal(false);
                            setSelectedLabourIds(new Set());
                            setSelectedSite(null);
                            fetchData();
                        }
                    }
                ]}
            >
                <View style={styles.successContent}>
                    <View style={styles.successIconWrap}>
                        <MaterialIcons name="check-circle" size={56} color="#22C55E" />
                    </View>
                    <Text style={styles.successTitle}>All Done!</Text>
                    <Text style={styles.successMsg}>
                        {successCount} labour{successCount !== 1 ? 's have' : ' has'} been successfully assigned to{" "}
                        <Text style={styles.successSiteName}>{successSite}</Text>.
                    </Text>
                </View>
            </CustomModal>

            {/* Calendar Modal */}
            <CustomModal
                visible={showCalendar}
                onClose={() => setShowCalendar(false)}
                title="Select Assignment Date"
                actions={[
                    { text: "Cancel", onPress: () => setShowCalendar(false), style: "cancel" }
                ]}
            >
                <Calendar
                    selectedDate={date}
                    onDateSelect={handleDateSelect}
                    markedDates={[]}
                    onMonthChange={() => { }}
                />
            </CustomModal>

            {/* Site Picker Modal */}
            <CustomModal
                visible={showSitePicker}
                onClose={() => setShowSitePicker(false)}
                title="Select Site"
                actions={[
                    { text: 'Cancel', onPress: () => setShowSitePicker(false), style: 'cancel' }
                ]}
            >
                <FlatList
                    data={sites}
                    style={{ maxHeight: 300, width: '100%' }}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.siteOption}
                            onPress={() => {
                                setSelectedSite(item);
                                setShowSitePicker(false);
                            }}
                        >
                            <MaterialIcons name="location-city" size={20} color={selectedSite?.id === item.id ? "#3B82F6" : (isDark ? "#94A3B8" : "#64748B")} />
                            <Text style={[styles.siteOptionText, selectedSite?.id === item.id && styles.siteOptionTextSelected]}>
                                {item.name}
                            </Text>
                            {selectedSite?.id === item.id && <MaterialIcons name="check" size={20} color="#3B82F6" />}
                        </TouchableOpacity>
                    )}
                />
            </CustomModal>
        </View>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: isDark ? "#334155" : "#E2E8F0",
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        color: isDark ? "#F1F5F9" : "#0F172A",
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: isDark ? "#334155" : "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
    },
    infoBox: {
        marginVertical: 16,
        padding: 16,
        backgroundColor: isDark ? "rgba(59, 130, 246, 0.15)" : "#EFF6FF",
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
    },
    infoText: {
        flex: 1,
        marginLeft: 12,
        fontSize: 13,
        color: isDark ? "#93C5FD" : "#2563EB",
        lineHeight: 18,
    },
    formRow: {
        flexDirection: "row",
        gap: 16,
        marginBottom: 16,
    },
    halfWidth: {
        flex: 1,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: isDark ? "#94A3B8" : "#64748B",
        marginBottom: 8,
    },
    picker: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
        borderWidth: 1,
        borderColor: isDark ? "#334155" : "#E2E8F0",
        borderRadius: 12,
        gap: 8,
    },
    pickerText: {
        fontSize: 14,
        fontWeight: "500",
        color: isDark ? "#F1F5F9" : "#1E293B",
        flex: 1,
    },
    listSection: {
        flex: 1,
        backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
    },
    listHeaderWrapper: {
        paddingBottom: 8,
    },
    listHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: isDark ? "#F1F5F9" : "#0F172A",
    },
    selectAllText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#3B82F6",
    },
    labourCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: isDark ? "#334155" : "#E2E8F0",
    },
    labourCardSelected: {
        backgroundColor: isDark ? "rgba(59, 130, 246, 0.2)" : "#EFF6FF",
        borderColor: "#3B82F6",
    },
    labourInfo: {
        flex: 1,
    },
    labourName: {
        fontSize: 16,
        fontWeight: "600",
        color: isDark ? "#F1F5F9" : "#0F172A",
        marginBottom: 4,
    },
    labourNameSelected: {
        color: "#3B82F6",
    },
    labourPhone: {
        fontSize: 14,
        color: isDark ? "#94A3B8" : "#64748B",
        marginBottom: 6,
    },
    badge: {
        alignSelf: "flex-start",
        paddingHorizontal: 8,
        paddingVertical: 2,
        backgroundColor: isDark ? "#334155" : "#E2E8F0",
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: "600",
        color: isDark ? "#CBD5E1" : "#475569",
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: isDark ? "#475569" : "#CBD5E1",
        justifyContent: "center",
        alignItems: "center",
    },
    checkboxSelected: {
        backgroundColor: "#3B82F6",
        borderColor: "#3B82F6",
    },
    centerBox: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    emptyText: {
        textAlign: "center",
        color: isDark ? "#94A3B8" : "#64748B",
        marginTop: 20,
    },
    floatingFooter: {
        position: 'absolute',
        bottom: 24,
        left: 16,
        right: 16,
        backgroundColor: 'transparent',
    },
    footer: {
        padding: 16,
        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
        borderTopWidth: 1,
        borderTopColor: isDark ? "#334155" : "#E2E8F0",
    },
    submitBtn: {
        backgroundColor: "#3B82F6",
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
    },
    submitBtnDisabled: {
        backgroundColor: isDark ? "#475569" : "#94A3B8",
    },
    submitBtnText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
    },
    siteOption: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? "#334155" : "#F1F5F9",
        gap: 12,
    },
    siteOptionText: {
        fontSize: 16,
        color: isDark ? "#F1F5F9" : "#1E293B",
        flex: 1,
    },
    siteOptionTextSelected: {
        color: "#3B82F6",
        fontWeight: "600",
    },
    successContent: {
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    successIconWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: isDark ? "rgba(34,197,94,0.15)" : "#F0FDF4",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    successTitle: {
        fontSize: 22,
        fontWeight: "700",
        color: isDark ? "#F1F5F9" : "#0F172A",
        marginBottom: 8,
    },
    successMsg: {
        fontSize: 15,
        color: isDark ? "#94A3B8" : "#64748B",
        textAlign: "center",
        lineHeight: 22,
    },
    successSiteName: {
        fontWeight: "700",
        color: isDark ? "#60A5FA" : "#2563EB",
    },
});
