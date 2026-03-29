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
    View
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";

interface DeletedSupervisor {
    id: number;
    name: string;
    phone: string;
    deleted_at: string;
}

export default function SupervisorBinScreen() {
    const router = useRouter();
    const { isDark } = useTheme();
    const local = getStyles(isDark);
    const [supervisors, setSupervisors] = useState<DeletedSupervisor[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchDeletedSupervisors = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            const response = await api.get("/auth/supervisors/bin");
            const data = await response.json();

            if (response.ok) {
                setSupervisors(data);
            } else {
                Alert.alert("Error", data.error || "Failed to fetch deleted supervisors");
            }
        } catch (error) {
            console.error("Fetch deleted supervisors error:", error);
            Alert.alert("Error", "Unable to connect to server");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRestore = async (id: number) => {
        Alert.alert(
            "Restore Supervisor",
            "Are you sure you want to restore this supervisor to the active list?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Restore",
                    style: "default",
                    onPress: async () => {
                        try {
                            const response = await api.put(`/auth/supervisors/${id}/restore`, {});
                            const data = await response.json();
                            if (response.ok) {
                                fetchDeletedSupervisors(false);
                            } else {
                                Alert.alert("Error", data.error || "Failed to restore supervisor");
                            }
                        } catch (error) {
                            console.error("Restore error:", error);
                            Alert.alert("Error", "Unable to connect to server");
                        }
                    }
                }
            ]
        );
    };

    const handlePermanentDelete = async (id: number) => {
        Alert.alert(
            "Permanently Delete",
            "Are you sure you want to PERMANENTLY delete this supervisor? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const response = await api.delete(`/auth/supervisors/${id}/permanent`);
                            const data = await response.json();
                            if (response.ok) {
                                fetchDeletedSupervisors(false);
                            } else {
                                Alert.alert("Error", data.error || "Failed to delete supervisor");
                            }
                        } catch (error) {
                            console.error("Permanent delete error:", error);
                            Alert.alert("Error", "Unable to connect to server");
                        }
                    }
                }
            ]
        );
    };

    const onRefresh = () => {
        fetchDeletedSupervisors(true);
    };

    useFocusEffect(
        useCallback(() => {
            fetchDeletedSupervisors();
        }, [])
    );

    const checkDaysLeft = (deletedAt: string) => {
        const deletedDate = new Date(deletedAt);
        const now = new Date();
        const diffMs = now.getTime() - deletedDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const daysLeft = 7 - diffDays;
        return daysLeft > 0 ? daysLeft : 0;
    };

    const renderSupervisor = ({ item }: { item: DeletedSupervisor }) => (
        <View style={local.card}>
            <View style={local.iconWrap}>
                <MaterialIcons name="person-off" size={24} color={isDark ? "#ff6b6b" : "#ff3b30"} />
            </View>
            <View style={local.info}>
                <Text style={local.name}>{item.name}</Text>
                <Text style={local.phone}>{item.phone}</Text>
                <Text style={local.daysLeft}>Permanently deleted in {checkDaysLeft(item.deleted_at)} days</Text>
            </View>
            <View style={local.actions}>
                <TouchableOpacity onPress={() => handleRestore(item.id)} style={local.actionButton}>
                    <MaterialIcons name="restore" size={24} color={isDark ? "#64b5f6" : "#0a84ff"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handlePermanentDelete(item.id)} style={[local.actionButton, local.deleteButton]}>
                    <MaterialIcons name="delete-forever" size={24} color={isDark ? "#ff6b6b" : "#ff3b30"} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={local.container}>
            <View style={local.header}>
                <TouchableOpacity onPress={() => router.back()} style={local.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={isDark ? "#fff" : "#000"} />
                </TouchableOpacity>
                <Text style={local.title}>Supervisor Bin</Text>
                <View style={{ width: 40 }} /> {/* Spacer */}
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#0a84ff" style={local.loader} />
            ) : supervisors.length === 0 ? (
                <View style={local.emptyState}>
                    <MaterialIcons name="delete-outline" size={64} color={isDark ? "#555" : "#ccc"} />
                    <Text style={local.emptyText}>Bin is empty</Text>
                    <Text style={local.emptySubtext}>Deleted supervisors will appear here for 7 days before permanent deletion.</Text>
                </View>
            ) : (
                <FlatList
                    data={supervisors}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderSupervisor}
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
        backgroundColor: isDark ? "#2a1a1a" : "#ffe8e8",
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
    phone: {
        fontSize: 14,
        color: isDark ? "#aaa" : "#666",
        marginBottom: 4,
    },
    daysLeft: {
        fontSize: 12,
        color: isDark ? "#ff6b6b" : "#ff3b30",
        fontStyle: 'italic',
    },
    actions: {
        flexDirection: 'row',
    },
    actionButton: {
        padding: 8,
        marginLeft: 4,
        backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0',
        borderRadius: 8,
    },
    deleteButton: {
        backgroundColor: isDark ? '#3a1a1a' : '#ffeaea',
    },
    emptyState: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: isDark ? "#888" : "#666",
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: isDark ? "#666" : "#999",
        textAlign: 'center',
    },
});
