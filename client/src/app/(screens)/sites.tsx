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

interface Site {
    id: number;
    name: string;
    address: string;
    description: string;
    supervisor_count: number;
    labour_count: number;
    created_at: string;
}

export default function SitesScreen() {
    const router = useRouter();
    const { isDark } = useTheme();
    const local = getStyles(isDark);
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);

    const [refreshing, setRefreshing] = useState(false);

    const fetchSites = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            const response = await api.get("/sites");
            const data = await response.json();

            if (response.ok) {
                setSites(data);
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

    const renderSite = ({ item }: { item: Site }) => (
        <TouchableOpacity
            style={local.card}
            onPress={() => router.push(`/(screens)/site-details?id=${item.id}` as any)}
        >
            <View style={local.iconWrap}>
                <MaterialIcons name="location-city" size={24} color={isDark ? "#64b5f6" : "#0a84ff"} />
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
            </View>
            <MaterialIcons name="chevron-right" size={24} color={isDark ? "#555" : "#ccc"} />
        </TouchableOpacity>
    );

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

            {loading && !refreshing ? (
                <ActivityIndicator size="large" color="#0a84ff" style={local.loader} />
            ) : sites.length === 0 ? (
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
            ) : (
                <FlatList
                    data={sites}
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
    backButton: {
        padding: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: "600",
        color: isDark ? "#fff" : "#333",
    },
    addButton: {
        padding: 8,
    },
    loader: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    list: {
        padding: 16,
    },
    card: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 4,
        elevation: 3,
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
    info: {
        flex: 1,
    },
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
