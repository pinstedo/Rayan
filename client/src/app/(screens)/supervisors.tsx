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
import { api } from "../../services/api";

interface Supervisor {
    id: number;
    name: string;
    phone: string;
}

export default function SupervisorsScreen() {
    const router = useRouter();
    const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchSupervisors = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            const response = await api.get("/auth/supervisors");
            const data = await response.json();

            if (response.ok) {
                setSupervisors(data);
            } else {
                Alert.alert("Error", data.error || "Failed to fetch supervisors");
            }
        } catch (error) {
            console.error("Fetch supervisors error:", error);
            Alert.alert("Error", "Unable to connect to server");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        fetchSupervisors(true);
    };

    useFocusEffect(
        useCallback(() => {
            fetchSupervisors();
        }, [])
    );

    const renderSupervisor = ({ item }: { item: Supervisor }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({
                pathname: "/(screens)/supervisor-details",
                params: { id: item.id, name: item.name, phone: item.phone }
            })}
        >
            <View style={styles.iconWrap}>
                <MaterialIcons name="person" size={24} color="#0a84ff" />
            </View>
            <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.phone}>{item.phone}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.title}>Supervisors</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        onPress={() => router.push("/(screens)/supervisor-bin")}
                        style={styles.actionButton}
                    >
                        <MaterialIcons name="delete-outline" size={24} color="#ff3b30" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => router.push("/(screens)/add-supervisor")}
                        style={styles.actionButton}
                    >
                        <MaterialIcons name="add" size={24} color="#0a84ff" />
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#0a84ff" style={styles.loader} />
            ) : supervisors.length === 0 ? (
                <View style={styles.emptyState}>
                    <MaterialIcons name="supervisor-account" size={64} color="#ccc" />
                    <Text style={styles.emptyText}>No supervisors added yet</Text>
                    <TouchableOpacity
                        onPress={() => router.push("/(screens)/add-supervisor")}
                        style={styles.addFirstButton}
                    >
                        <Text style={styles.addFirstText}>Add First Supervisor</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={supervisors}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderSupervisor}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0a84ff']} />
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f5f5f5",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    backButton: {
        padding: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: "600",
        color: "#333",
    },
    headerActions: {
        flexDirection: "row",
        alignItems: "center",
    },
    actionButton: {
        padding: 8,
        marginLeft: 4,
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
        backgroundColor: "#fff",
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#e8f4ff",
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
        color: "#333",
        marginBottom: 4,
    },
    phone: {
        fontSize: 14,
        color: "#666",
    },
    emptyState: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
    },
    emptyText: {
        fontSize: 16,
        color: "#999",
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
