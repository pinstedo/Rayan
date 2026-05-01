import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { FilterOption, FilterPanel, SearchBar, SortOption, SortSelector } from "../../components/list";
import { Calendar } from "../../components/Calendar";
import { useTheme } from "../../context/ThemeContext";
import { useListManager } from "../../hooks/useListManager";
import { api } from "../../services/api";
import { LabourCard } from "../components/LabourCard";

interface Labour {
    id: number;
    name: string;
    phone: string;
    rate?: number;
    site: string;
    site_id?: number;
    status?: 'active' | 'unassigned';
}

const sortOptions: SortOption[] = [
    { label: "Name", field: "name", type: "string" },
    { label: "Site", field: "site", type: "string" }
];

const filterOptions: FilterOption[] = [];

export default function Advance() {
    const router = useRouter();
    const { isDark } = useTheme();
    const local = getStyles(isDark);
    const { supervisorId } = useLocalSearchParams();
    const [allLabours, setAllLabours] = useState<Labour[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);

    const listManager = useListManager<Labour>({
        initialData: allLabours,
        initialConfig: {
            search: { text: "", fields: ["name", "phone", "site"] },
            sort: [{ field: "name", order: "asc", type: "string" }]
        }
    });

    // Advance Modal State
    const [showAdvanceModal, setShowAdvanceModal] = useState(false);
    const [selectedLabour, setSelectedLabour] = useState<Labour | null>(null);
    const [amount, setAmount] = useState("");
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    const formatDate = (d: Date) => {
        return d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    useFocusEffect(
        useCallback(() => {
            checkRoleAndFetch();
        }, [supervisorId])
    );

    const [refreshing, setRefreshing] = useState(false);

    const checkRoleAndFetch = async () => {
        try {
            const userDataStr = await AsyncStorage.getItem("userData");
            if (userDataStr) {
                const userData = JSON.parse(userDataStr);
                setIsAdmin(userData.role === "admin");
                setCurrentUserId(userData.id);
                fetchLabours(userData.role === "supervisor" ? userData.id : supervisorId);
            }
        } catch (error) {
            console.error("Error loading user role:", error);
        }
    };

    const fetchLabours = async (supId?: string | string[], isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            }
            let queryString = '?status=active';
            if (supId) queryString += `&supervisor_id=${supId}`;
            const response = await api.get(`/labours${queryString}`);
            const data = await response.json();
            if (response.ok) {
                setAllLabours(data);
            }
        } catch (error) {
            console.error("Failed to fetch labours", error);
        } finally {
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        checkRoleAndFetch();
    };

    const handleOpenAdvance = (labour: Labour) => {
        setSelectedLabour(labour);
        setAmount("");
        setNotes("");
        setDate(new Date());
        setShowAdvanceModal(true);
    };

    const handleSubmitAdvance = async () => {
        if (!selectedLabour || !amount) {
            Alert.alert("Error", "Please enter an amount");
            return;
        }

        if (isNaN(Number(amount)) || Number(amount) <= 0) {
            Alert.alert("Error", "Please enter a valid amount");
            return;
        }

        try {
            setSubmitting(true);
            const response = await api.post(`/labours/${selectedLabour.id}/advance`, {
                amount: Number(amount),
                date: date.toISOString(), // Use selected date
                notes: notes,
                created_by: currentUserId
            });

            const data = await response.json();

            if (response.ok) {
                Alert.alert("Success", `Added advance of ₹${amount} to ${selectedLabour.name}`);
                setShowAdvanceModal(false);
            } else {
                Alert.alert("Error", data.error || "Failed to add advance");
            }
        } catch (error) {
            console.error("Advance error:", error);
            Alert.alert("Error", "Unable to connect to server");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ScrollView style={local.container}>
            <View style={local.headerRow}>
                <Pressable onPress={() => router.back()} style={local.backBtn}>
                    <Text style={local.backText}>← Back</Text>
                </Pressable>
                <Text style={local.header}>Manage Advances</Text>
                <View style={{ width: 50 }} />
            </View>

            <View style={local.controlsRow}>
                <SearchBar
                    value={listManager.searchText}
                    onChangeText={listManager.setSearchText}
                    placeholder="Search by name, phone..."
                    style={local.searchBar}
                />
                <View style={local.actionRow}>
                    <FilterPanel
                        availableFilters={filterOptions}
                        activeFilters={listManager.config.filters || []}
                        onApplyFilter={listManager.addFilter}
                        onRemoveFilter={listManager.removeFilter}
                    />
                    <SortSelector
                        options={sortOptions}
                        currentSort={listManager.config.sort?.[0]}
                        onSortChange={listManager.toggleSort}
                    />
                </View>
            </View>

            <FlatList
                data={listManager.data}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <LabourCard
                        labour={item}
                        hideRate={!isAdmin}
                        onAdvance={handleOpenAdvance}
                    />
                )}
                contentContainerStyle={local.listContent}
                ListEmptyComponent={
                    <Text style={local.emptyText}>No results found.</Text>
                }
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0a84ff']} />
                }
            />

            {/* Advance Modal */}
            <Modal visible={showAdvanceModal} transparent animationType="slide">
                <View style={local.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={local.keyboardView}
                        enabled={Platform.OS !== "web"}
                    >
                        <View style={local.modalContent}>
                            <View style={local.modalHeader}>
                                <Text style={local.modalTitle}>
                                    Add Advance for {selectedLabour?.name}
                                </Text>
                                <TouchableOpacity onPress={() => setShowAdvanceModal(false)}>
                                    <MaterialIcons name="close" size={24} color={isDark ? "#fff" : "#333"} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView>
                                <View style={local.inputGroup}>
                                    <Text style={local.label}>Date</Text>
                                    <TouchableOpacity style={[local.input, { justifyContent: 'center' }]} onPress={() => setShowDatePicker(!showDatePicker)}>
                                        <Text style={{ color: isDark ? "#fff" : "#333", fontSize: 16 }}>
                                            {formatDate(date)}
                                        </Text>
                                    </TouchableOpacity>
                                    {showDatePicker && (
                                        <View style={{ marginTop: 10 }}>
                                            <Calendar 
                                                selectedDate={date}
                                                onDateSelect={(d) => {
                                                    setDate(d);
                                                    setShowDatePicker(false);
                                                }}
                                                markedDates={[]}
                                                onMonthChange={() => {}}
                                            />
                                        </View>
                                    )}
                                </View>

                                <View style={local.inputGroup}>
                                    <Text style={local.label}>Amount (₹)</Text>
                                    <TextInput
                                        style={local.input}
                                        keyboardType="numeric"
                                        placeholder="Enter amount"
                                        value={amount}
                                        onChangeText={setAmount}
                                        placeholderTextColor={isDark ? "#888" : "#999"}
                                    />
                                </View>

                                <View style={local.inputGroup}>
                                    <Text style={local.label}>Notes (Optional)</Text>
                                    <TextInput
                                        style={[local.input, local.textArea]}
                                        placeholder="Enter notes"
                                        value={notes}
                                        onChangeText={setNotes}
                                        multiline
                                        numberOfLines={3}
                                        placeholderTextColor={isDark ? "#888" : "#999"}
                                    />
                                </View>

                                <TouchableOpacity
                                    style={[local.submitBtn, submitting && local.disabledBtn]}
                                    onPress={handleSubmitAdvance}
                                    disabled={submitting}
                                >
                                    <Text style={local.submitBtnText}>
                                        {submitting ? "Saving..." : "Save Advance"}
                                    </Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </ScrollView>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 40,
        backgroundColor: isDark ? "#121212" : "#f5f5f5",
    },
    headerRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        borderBottomWidth: 1,
        borderBottomColor: isDark ? "#333" : "#eee",
    },
    backBtn: { paddingVertical: 6, paddingHorizontal: 8 },
    backText: { color: isDark ? "#4da6ff" : "#0a84ff", fontWeight: "600", fontSize: 16 },
    header: { fontSize: 20, fontWeight: "700", color: isDark ? "#fff" : "#333" },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    emptyText: {
        textAlign: "center",
        marginTop: 40,
        color: isDark ? "#aaa" : "#999",
        fontSize: 16,
    },
    controlsRow: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 4,
    },
    searchBar: {
        marginBottom: 12,
    },
    actionRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    keyboardView: {
        width: '100%',
        maxWidth: 500,
    },
    modalContent: {
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        borderRadius: 12,
        padding: 20,
        elevation: 5,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: isDark ? "#fff" : "#333",
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        color: isDark ? "#ccc" : "#333",
        fontWeight: "500",
        marginBottom: 8,
    },
    input: {
        backgroundColor: isDark ? "#2a2a2a" : "#f9f9f9",
        borderWidth: 1,
        borderColor: isDark ? "#444" : "#ddd",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: isDark ? "#fff" : "#333",
    },
    textArea: {
        height: 80,
        textAlignVertical: "top",
    },
    submitBtn: {
        backgroundColor: "#0a84ff",
        padding: 16,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 8,
    },
    disabledBtn: {
        backgroundColor: isDark ? "#555" : "#ccc",
    },
    submitBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
});
