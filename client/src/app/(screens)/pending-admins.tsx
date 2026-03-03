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

interface PendingAdmin {
    id: number;
    name: string;
    phone: string;
    created_at: string;
}

export default function PendingAdminsScreen() {
    const router = useRouter();
    const { isDark } = useTheme();
    const local = getStyles(isDark);
    const [admins, setAdmins] = useState<PendingAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchPendingAdmins = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            const response = await api.get("/auth/admins/pending");
            const data = await response.json();

            if (response.ok) {
                setAdmins(data);
            } else {
                Alert.alert("Error", data.error || "Failed to fetch pending requests");
            }
        } catch (error) {
            console.error("Fetch pending admins error:", error);
            Alert.alert("Error", "Unable to connect to server");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleApprove = async (id: number) => {
        Alert.alert(
            "Approve Request",
            "Are you sure you want to approve this admin request? They will get full access to the dashboard.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Approve",
                    style: "default",
                    onPress: async () => {
                        try {
                            const response = await api.put(`/auth/admins/${id}/approve`, {});
                            const data = await response.json();
                            if (response.ok) {
                                fetchPendingAdmins(false);
                            } else {
                                Alert.alert("Error", data.error || "Failed to approve admin");
                            }
                        } catch (error) {
                            console.error("Approval error:", error);
                            Alert.alert("Error", "Unable to connect to server");
                        }
                    }
                }
            ]
        );
    };

    const handleReject = async (id: number) => {
        Alert.alert(
            "Reject Request",
            "Are you sure you want to reject this request? The user will not be able to log in.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reject",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const response = await api.put(`/auth/admins/${id}/reject`, {});
                            const data = await response.json();
                            if (response.ok) {
                                fetchPendingAdmins(false);
                            } else {
                                Alert.alert("Error", data.error || "Failed to reject admin");
                            }
                        } catch (error) {
                            console.error("Rejection error:", error);
                            Alert.alert("Error", "Unable to connect to server");
                        }
                    }
                }
            ]
        );
    };

    const onRefresh = () => {
        fetchPendingAdmins(true);
    };

    useFocusEffect(
        useCallback(() => {
            fetchPendingAdmins();
        }, [])
    );

    const renderAdmin = ({ item }: { item: PendingAdmin }) => (
        <View style={local.card}>
            <View style={local.iconWrap}>
                <MaterialIcons name="person-outline" size={24} color={isDark ? "#FFB74D" : "#F57C00"} />
            </View>
            <View style={local.info}>
                <Text style={local.name}>{item.name}</Text>
                <Text style={local.phone}>{item.phone}</Text>
                <Text style={local.date}>Requested on: {new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={local.actions}>
                <TouchableOpacity onPress={() => handleApprove(item.id)} style={[local.actionButton, local.approveButton]}>
                    <MaterialIcons name="check" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleReject(item.id)} style={[local.actionButton, local.rejectButton]}>
                    <MaterialIcons name="close" size={24} color="#fff" />
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
                <Text style={local.title}>Pending Approvals</Text>
                <View style={{ width: 40 }} /> {/* Spacer */}
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#0a84ff" style={local.loader} />
            ) : admins.length === 0 ? (
                <View style={local.emptyState}>
                    <MaterialIcons name="check-circle-outline" size={64} color={isDark ? "#555" : "#ccc"} />
                    <Text style={local.emptyText}>You're all caught up!</Text>
                    <Text style={local.emptySubtext}>No new admin requests are pending approval.</Text>
                </View>
            ) : (
                <FlatList
                    data={admins}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderAdmin}
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
        backgroundColor: isDark ? "#3A2A1A" : "#FFF3E0",
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
    date: {
        fontSize: 12,
        color: isDark ? "#888" : "#999",
        fontStyle: 'italic',
    },
    actions: {
        flexDirection: 'row',
    },
    actionButton: {
        padding: 8,
        marginLeft: 8,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        width: 44,
        height: 44,
    },
    approveButton: {
        backgroundColor: '#4CAF50',
    },
    rejectButton: {
        backgroundColor: '#FF3B30',
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
        color: isDark ? "#aaa" : "#555",
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: isDark ? "#666" : "#999",
        textAlign: 'center',
    },
});
