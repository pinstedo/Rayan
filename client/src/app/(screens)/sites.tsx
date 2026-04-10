import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";
import { useListManager } from "../../hooks/useListManager";
import { SearchBar, FilterPanel, SortSelector, SortOption, FilterOption } from "../../components/list";

interface Site {
    id: number;
    name: string;
    address: string;
    description: string;
    supervisor_count: number;
    labour_count: number;
    status: string;
    completion_percentage: number;
    last_active_date: string | null;
    created_at: string;
}

type FilterType = "all" | "active" | "inactive";

const sortOptions: SortOption[] = [
    { label: "Name", field: "name", type: "string" },
    { label: "Completion", field: "completion_percentage", type: "number" },
    { label: "Labour Count", field: "labour_count", type: "number" },
    { label: "Supervisor Count", field: "supervisor_count", type: "number" },
];

const filterOptions: FilterOption[] = [
    { 
        label: "Status", 
        field: "status", 
        type: "select", 
        options: [
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
            { label: "Completed", value: "completed" },
        ] 
    }
];

export default function SitesScreen() {
    const router = useRouter();
    const { isDark } = useTheme();
    const local = getStyles(isDark);
    const [allSites, setAllSites] = useState<Site[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Initial config: sort by name asc, don't show completed if we want to mimic old behavior, 
    // but with generic filters we can just start with active+inactive. Let's start with active + inactive filter.
    const listManager = useListManager<Site>({
        initialData: allSites,
        initialConfig: {
            search: { text: "", fields: ["name", "address"] },
            sort: [{ field: "name", order: "asc", type: "string" }],
            filters: [{ field: "status", operator: "not_in", value: ["completed"] }] // hide completed by default
        }
    });

    const fetchSites = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            }
            const response = await api.get("/sites");
            const data = await response.json();

            if (response.ok) {
                setAllSites(data);
            } else {
                Alert.alert("Error", data.error || "Failed to fetch sites");
            }
        } catch (error) {
            console.error("Fetch sites error:", error);
            Alert.alert("Error", "Unable to connect to server");
        } finally {
            setRefreshing(false);
        }
    };

    const handleFilterChange = (f: FilterType) => {
        // Just for keeping the easy UI tabs functional as requested or we can let FilterPanel do it.
        // We'll update listManager filters instead.
        if (f === "all") {
            listManager.setFilters([{ field: "status", operator: "not_in", value: ["completed"] }]);
        } else {
            listManager.setFilters([{ field: "status", value: f }]);
        }
    };

    const onRefresh = () => {
        fetchSites(true);
    };

    useFocusEffect(
        useCallback(() => {
            fetchSites();
        }, [])
    );

    const getStatusColor = (status: string) => {
        if ((status ?? "active") === "inactive") {
            return { bg: isDark ? "#3b2a00" : "#fff8e1", text: isDark ? "#ffb74d" : "#e65100" };
        }
        return { bg: isDark ? "#0d2b1c" : "#e8f5e9", text: isDark ? "#66bb6a" : "#2e7d32" };
    };

    const renderSite = ({ item }: { item: Site }) => {
        const status = item.status ?? "active";
        const statusColors = getStatusColor(status);
        const pct = Math.min(100, Math.max(0, item.completion_percentage || 0));

        return (
            <TouchableOpacity
                style={local.card}
                onPress={() => router.push(`/(screens)/site-details?id=${item.id}` as any)}
            >
                {/* Status badge */}
                <View style={[local.statusBadge, { backgroundColor: statusColors.bg }]}>
                    <View style={[local.statusDot, { backgroundColor: statusColors.text }]} />
                    <Text style={[local.statusBadgeText, { color: statusColors.text }]}>
                        {status === "inactive" ? "Inactive" : "Active"}
                    </Text>
                </View>

                <View style={local.cardMain}>
                    <View style={[local.iconWrap, status === "inactive" && local.iconWrapInactive]}>
                        <MaterialIcons
                            name="location-city"
                            size={24}
                            color={status === "inactive" ? (isDark ? "#aaa" : "#999") : (isDark ? "#64b5f6" : "#0a84ff")}
                        />
                    </View>
                    <View style={local.info}>
                        <Text style={[local.name, status === "inactive" && local.nameInactive]}>
                            {item.name}
                        </Text>
                        {item.address && <Text style={local.address}>{item.address}</Text>}
                        <View style={local.statsRow}>
                            <View style={local.stat}>
                                <MaterialIcons name="supervisor-account" size={16} color={isDark ? "#aaa" : "#666"} />
                                <Text style={local.statText}>{item.supervisor_count} supervisors</Text>
                            </View>
                            <View style={local.stat}>
                                <MaterialIcons name="people" size={16} color={isDark ? "#aaa" : "#666"} />
                                <Text style={local.statText}>{item.labour_count} labours</Text>
                            </View>
                        </View>

                        {/* Completion progress bar */}
                        {pct > 0 && (
                            <View style={local.progressRow}>
                                <View style={local.progressTrack}>
                                    <View style={[local.progressFill, { width: `${pct}%` as any, backgroundColor: pct >= 100 ? "#34c759" : (isDark ? "#64b5f6" : "#0a84ff") }]} />
                                </View>
                                <Text style={local.progressText}>{Math.round(pct)}%</Text>
                            </View>
                        )}
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color={isDark ? "#555" : "#ccc"} />
                </View>
            </TouchableOpacity>
        );
    };

    const visibleAllSites = allSites.filter(s => s.status !== "completed");
    
    // Check which filter is active for the tabs UI
    const statusFilter = listManager.config.filters?.find(f => f.field === "status");
    let activeTab: FilterType = "all";
    if (statusFilter?.operator === "not_in" && statusFilter?.value?.includes("completed")) activeTab = "all";
    else if (statusFilter?.value === "active") activeTab = "active";
    else if (statusFilter?.value === "inactive") activeTab = "inactive";

    const filterCounts = {
        all: visibleAllSites.length,
        active: visibleAllSites.filter(s => (s.status ?? "active") === "active").length,
        inactive: visibleAllSites.filter(s => s.status === "inactive").length,
    };

    return (
        <View style={local.container}>
            <View style={local.header}>
                <TouchableOpacity onPress={() => router.back()} style={local.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={isDark ? "#fff" : "#000"} />
                </TouchableOpacity>
                <Text style={local.title}>Sites</Text>
                <TouchableOpacity
                    onPress={() => router.push("/(screens)/add-site" as any)}
                    style={local.addButton}
                >
                    <MaterialIcons name="add" size={24} color={isDark ? "#4da6ff" : "#0a84ff"} />
                </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={local.filterBar}>
                {(["all", "active", "inactive"] as FilterType[]).map(f => (
                    <TouchableOpacity
                        key={f}
                        style={[local.filterTab, activeTab === f && local.filterTabActive]}
                        onPress={() => handleFilterChange(f)}
                    >
                        <Text style={[local.filterTabText, activeTab === f && local.filterTabTextActive]}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                            {" "}
                            <Text style={[local.filterCount, activeTab === f && local.filterCountActive]}>
                                ({filterCounts[f]})
                            </Text>
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* List Manager Controls */}
            <View style={local.controlsRow}>
                <SearchBar 
                    value={listManager.searchText}
                    onChangeText={listManager.setSearchText}
                    placeholder="Search sites by name or address..."
                    style={local.searchBar}
                />
                <View style={local.actionRow}>
                    <FilterPanel 
                        availableFilters={filterOptions}
                        activeFilters={listManager.config.filters || []}
                        onApplyFilter={(f) => {
                            // If they use the generic filter panel for status, it breaks tabs a bit, 
                            // but this is expected when mixing UI paradigms.
                            listManager.addFilter(f);
                        }}
                        onRemoveFilter={listManager.removeFilter}
                    />
                    <SortSelector 
                        options={sortOptions}
                        currentSort={listManager.config.sort?.[0]}
                        onSortChange={listManager.toggleSort}
                    />
                </View>
            </View>

            {allSites.length === 0 && !refreshing ? (
                <View style={local.emptyState}>
                    <MaterialIcons name="location-city" size={64} color={isDark ? "#555" : "#ccc"} />
                    <Text style={local.emptyText}>No sites added yet</Text>
                    <TouchableOpacity
                        onPress={() => router.push("/(screens)/add-site" as any)}
                        style={local.addFirstButton}
                    >
                        <Text style={local.addFirstText}>Add First Site</Text>
                    </TouchableOpacity>
                </View>
            ) : listManager.data.length === 0 ? (
                <View style={local.emptyState}>
                    <Text style={local.emptyText}>No results found.</Text>
                </View>
            ) : (
                <FlatList
                    data={listManager.data}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderSite}
                    contentContainerStyle={local.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0a84ff']} />
                    }
                />
            )}
        </View>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: isDark ? "#121212" : "#f5f5f5",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        borderBottomWidth: 1,
        borderBottomColor: isDark ? "#333" : "#eee",
    },
    backButton: { padding: 8 },
    title: {
        fontSize: 18,
        fontWeight: "600",
        color: isDark ? "#fff" : "#333",
    },
    addButton: { padding: 8 },
    controlsRow: {
        paddingHorizontal: 16,
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
    filterBar: {
        flexDirection: "row",
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        borderBottomWidth: 1,
        borderBottomColor: isDark ? "#333" : "#eee",
        paddingHorizontal: 8,
    },
    filterTab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: "center",
        borderBottomWidth: 2,
        borderBottomColor: "transparent",
    },
    filterTabActive: {
        borderBottomColor: isDark ? "#4da6ff" : "#0a84ff",
    },
    filterTabText: {
        fontSize: 14,
        fontWeight: "500",
        color: isDark ? "#888" : "#666",
    },
    filterTabTextActive: {
        color: isDark ? "#4da6ff" : "#0a84ff",
        fontWeight: "700",
    },
    filterCount: {
        fontSize: 12,
        color: isDark ? "#666" : "#999",
    },
    filterCountActive: {
        color: isDark ? "#4da6ff" : "#0a84ff",
    },
    loader: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    list: { padding: 16 },
    card: {
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 4,
        elevation: 3,
        overflow: "hidden",
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-end",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderBottomLeftRadius: 8,
        gap: 4,
        margin: 8,
        marginBottom: 0,
        borderRadius: 10,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.3,
    },
    cardMain: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        paddingTop: 8,
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: isDark ? "#1a3b5c" : "#e8f4ff",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    iconWrapInactive: {
        backgroundColor: isDark ? "#2a2a2a" : "#f0f0f0",
    },
    info: { flex: 1 },
    name: {
        fontSize: 16,
        fontWeight: "600",
        color: isDark ? "#fff" : "#333",
        marginBottom: 4,
    },
    nameInactive: {
        color: isDark ? "#aaa" : "#999",
    },
    address: {
        fontSize: 14,
        color: isDark ? "#ccc" : "#666",
        marginBottom: 8,
    },
    statsRow: {
        flexDirection: "row",
        gap: 16,
        marginBottom: 6,
    },
    stat: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    statText: {
        fontSize: 12,
        color: isDark ? "#aaa" : "#666",
    },
    progressRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 4,
    },
    progressTrack: {
        flex: 1,
        height: 4,
        backgroundColor: isDark ? "#333" : "#e0e0e0",
        borderRadius: 2,
        overflow: "hidden",
    },
    progressFill: {
        height: 4,
        borderRadius: 2,
    },
    progressText: {
        fontSize: 11,
        fontWeight: "600",
        color: isDark ? "#aaa" : "#666",
        minWidth: 30,
        textAlign: "right",
    },
    emptyState: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
    },
    emptyText: {
        fontSize: 16,
        color: isDark ? "#888" : "#999",
        marginTop: 16,
        marginBottom: 24,
    },
    addFirstButton: {
        backgroundColor: "#0a84ff",
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    addFirstText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
});
