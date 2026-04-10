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
import { SearchBar, FilterPanel, SortSelector, PaginationControls, SortOption, FilterOption } from "../../components/list";

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

const sortOptions: SortOption[] = [
    { label: "Name", field: "name", type: "string" },
    { label: "Date Completed", field: "last_active_date", type: "date" },
    { label: "Completion %", field: "completion_percentage", type: "number" }
];

const filterOptions: FilterOption[] = [];

export default function CompletedSitesScreen() {
    const router = useRouter();
    const { isDark } = useTheme();
    const local = getStyles(isDark);
    const [allSites, setAllSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const listManager = useListManager<Site>({
        initialData: allSites,
        initialConfig: {
            search: { text: "", fields: ["name", "address"] },
            sort: [{ field: "last_active_date", order: "desc", type: "date" }],
            pagination: { page: 1, limit: 15 }
        }
    });

    const fetchSites = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            const response = await api.get("/sites?status=completed");
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
            setLoading(false);
            setRefreshing(false);
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

    const renderSite = ({ item }: { item: Site }) => {
        const pct = Math.min(100, Math.max(0, item.completion_percentage || 0));

        return (
            <TouchableOpacity
                style={local.card}
                onPress={() => router.push(`/(screens)/site-details?id=${item.id}` as any)}
            >
                {/* Status badge */}
                <View style={[local.statusBadge, { backgroundColor: isDark ? "#0d2b1c" : "#e8fdf0" }]}>
                    <View style={[local.statusDot, { backgroundColor: "#34c759" }]} />
                    <Text style={[local.statusBadgeText, { color: "#34c759" }]}>Completed</Text>
                </View>

                <View style={local.cardMain}>
                    <View style={local.iconWrap}>
                        <MaterialIcons
                            name="domain-verification"
                            size={24}
                            color="#34c759"
                        />
                    </View>
                    <View style={local.info}>
                        <Text style={local.name}>{item.name}</Text>
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
                                    <View style={[local.progressFill, { width: `${pct}%` as any, backgroundColor: "#34c759" }]} />
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

    return (
        <View style={local.container}>
            <View style={local.header}>
                <TouchableOpacity onPress={() => router.back()} style={local.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={isDark ? "#fff" : "#000"} />
                </TouchableOpacity>
                <Text style={local.title}>Completed Sites</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={local.controlsRow}>
                <SearchBar 
                    value={listManager.searchText}
                    onChangeText={listManager.setSearchText}
                    placeholder="Search completed sites..."
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

            {loading && !refreshing ? (
                <ActivityIndicator size="large" color="#0a84ff" style={local.loader} />
            ) : listManager.data.length === 0 ? (
                <View style={local.emptyState}>
                    <MaterialIcons name="domain-verification" size={64} color={isDark ? "#555" : "#ccc"} />
                    <Text style={local.emptyText}>No completed sites</Text>
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
                    ListFooterComponent={
                        <PaginationControls 
                            currentPage={listManager.currentPage}
                            totalPages={listManager.totalPages}
                            hasNextPage={listManager.hasNextPage}
                            hasPrevPage={listManager.hasPrevPage}
                            onNext={() => listManager.setPage(listManager.currentPage + 1)}
                            onPrev={() => listManager.setPage(listManager.currentPage - 1)}
                            totalCount={listManager.totalCount}
                        />
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
    loader: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
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
        backgroundColor: isDark ? "#1b4323" : "#e8fdf0",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    info: { flex: 1 },
    name: {
        fontSize: 16,
        fontWeight: "600",
        color: isDark ? "#fff" : "#333",
        marginBottom: 4,
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
});
