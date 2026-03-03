import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";

interface Supervisor {
    id: number;
    name: string;
    phone: string;
    assigned_at?: string;
}

interface Labour {
    id: number;
    name: string;
    phone: string;
    trade: string;
}

interface SiteDetails {
    id: number;
    name: string;
    address: string;
    description: string;
    supervisors: Supervisor[];
    labours: Labour[];
}

export default function SiteDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { isDark } = useTheme();
    const local = getStyles(isDark);

    const [site, setSite] = useState<SiteDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editAddress, setEditAddress] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [availableSupervisors, setAvailableSupervisors] = useState<Supervisor[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const fetchRole = async () => {
            try {
                const userStr = await AsyncStorage.getItem('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    setUserRole(user.role);
                }
            } catch (error) {
                console.error("Error fetching user role", error);
            }
        };
        fetchRole();
    }, []);

    const fetchSiteDetails = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            const response = await api.get(`/sites/${id}`);
            const data = await response.json();

            if (response.ok) {
                setSite(data);
                setEditName(data.name);
                setEditAddress(data.address || "");
                setEditDescription(data.description || "");
            } else {
                Alert.alert("Error", data.error || "Failed to fetch site details");
            }
        } catch (error) {
            console.error("Fetch site details error:", error);
            Alert.alert("Error", "Unable to connect to server");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        fetchSiteDetails(true);
    };

    const fetchAvailableSupervisors = async () => {
        try {
            const response = await api.get("/auth/supervisors");
            const data = await response.json();
            if (response.ok) {
                // Filter out already assigned supervisors
                const assignedIds = site?.supervisors.map(s => s.id) || [];
                const available = data.filter((s: Supervisor) => !assignedIds.includes(s.id));
                setAvailableSupervisors(available);
            }
        } catch (error) {
            console.error("Fetch supervisors error:", error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchSiteDetails();
        }, [id])
    );

    const handleUpdate = async () => {
        try {
            const response = await api.put(`/sites/${id}`, {
                name: editName,
                address: editAddress,
                description: editDescription,
            });

            if (response.ok) {
                Alert.alert("Success", "Site updated successfully");
                setIsEditing(false);
                fetchSiteDetails();
            } else {
                const data = await response.json();
                Alert.alert("Error", data.error || "Failed to update site");
            }
        } catch (error) {
            Alert.alert("Error", "Failed to connect to server");
        }
    };

    const handleDelete = () => {
        Alert.alert(
            "Delete Site",
            "Are you sure you want to delete this site? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const response = await api.delete(`/sites/${id}`);

                            if (response.ok) {
                                Alert.alert("Success", "Site deleted", [
                                    { text: "OK", onPress: () => router.back() },
                                ]);
                            } else {
                                const data = await response.json();
                                Alert.alert("Error", data.error || "Failed to delete site");
                            }
                        } catch (error) {
                            Alert.alert("Error", "Failed to connect to server");
                        }
                    },
                },
            ]
        );
    };

    const handleAssignSupervisor = async (supervisorId: number) => {
        try {
            const response = await api.post(`/sites/${id}/assign`, { supervisor_id: supervisorId });

            if (response.ok) {
                Alert.alert("Success", "Supervisor assigned to site");
                setShowAssignModal(false);
                fetchSiteDetails();
            } else {
                const data = await response.json();
                Alert.alert("Error", data.error || "Failed to assign supervisor");
            }
        } catch (error) {
            Alert.alert("Error", "Failed to connect to server");
        }
    };

    const handleUnassignSupervisor = (supervisorId: number, name: string) => {
        Alert.alert(
            "Remove Supervisor",
            `Remove ${name} from this site?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const response = await api.delete(
                                `/sites/${id}/unassign/${supervisorId}`
                            );

                            if (response.ok) {
                                fetchSiteDetails();
                            } else {
                                const data = await response.json();
                                Alert.alert("Error", data.error || "Failed to remove supervisor");
                            }
                        } catch (error) {
                            Alert.alert("Error", "Failed to connect to server");
                        }
                    },
                },
            ]
        );
    };

    const openAssignModal = () => {
        fetchAvailableSupervisors();
        setShowAssignModal(true);
    };

    if (loading) {
        return (
            <View style={local.loaderContainer}>
                <ActivityIndicator size="large" color="#0a84ff" />
            </View>
        );
    }

    if (!site) {
        return (
            <View style={local.container}>
                <Text style={{ color: isDark ? "#fff" : "#000" }}>Site not found</Text>
            </View>
        );
    }

    return (
        <View style={local.container}>
            <View style={local.header}>
                <TouchableOpacity onPress={() => router.back()} style={local.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={isDark ? "#fff" : "#000"} />
                </TouchableOpacity>
                <Text style={local.title}>Site Details</Text>
                {userRole === 'admin' ? (
                    <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={local.editButton}>
                        <MaterialIcons name={isEditing ? "close" : "edit"} size={24} color={isDark ? "#4da6ff" : "#0a84ff"} />
                    </TouchableOpacity>
                ) : (
                    <View style={local.editButton} />
                )}
            </View>

            <FlatList
                data={[{ key: "content" }]}
                renderItem={() => (
                    <View style={local.content}>
                        {/* Site Info Section */}
                        <View style={local.section}>
                            <Text style={local.sectionTitle}>Site Information</Text>
                            {isEditing ? (
                                <View style={local.editForm}>
                                    <Text style={local.label}>Name</Text>
                                    <TextInput
                                        style={local.input}
                                        value={editName}
                                        onChangeText={setEditName}
                                        placeholderTextColor={isDark ? "#888" : "#999"}
                                    />
                                    <Text style={local.label}>Address</Text>
                                    <TextInput
                                        style={local.input}
                                        value={editAddress}
                                        onChangeText={setEditAddress}
                                        placeholderTextColor={isDark ? "#888" : "#999"}
                                    />
                                    <Text style={local.label}>Description</Text>
                                    <TextInput
                                        style={[local.input, { height: 80 }]}
                                        value={editDescription}
                                        onChangeText={setEditDescription}
                                        multiline
                                        placeholderTextColor={isDark ? "#888" : "#999"}
                                    />
                                    <TouchableOpacity style={local.saveBtn} onPress={handleUpdate}>
                                        <Text style={local.saveBtnText}>Save Changes</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={local.infoCard}>
                                    <Text style={local.siteName}>{site.name}</Text>
                                    {site.address && <Text style={local.siteAddress}>{site.address}</Text>}
                                    {site.description && <Text style={local.siteDesc}>{site.description}</Text>}
                                </View>
                            )}
                        </View>

                        {/* Supervisors Section */}
                        <View style={local.section}>
                            <View style={local.sectionHeader}>
                                <Text style={local.sectionTitle}>Assigned Supervisors</Text>
                                {userRole === 'admin' && (
                                    <TouchableOpacity onPress={openAssignModal} style={local.addBtn}>
                                        <MaterialIcons name="add" size={20} color={isDark ? "#4da6ff" : "#0a84ff"} />
                                        <Text style={local.addBtnText}>Assign</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {site.supervisors.length === 0 ? (
                                <Text style={local.emptyText}>No supervisors assigned</Text>
                            ) : (
                                site.supervisors.map((sup) => (
                                    <View key={sup.id} style={local.personCard}>
                                        <View style={local.personIconWrap}>
                                            <MaterialIcons name="person" size={20} color={isDark ? "#4da6ff" : "#0a84ff"} />
                                        </View>
                                        <View style={local.personInfo}>
                                            <Text style={local.personName}>{sup.name}</Text>
                                            <Text style={local.personPhone}>{sup.phone}</Text>
                                        </View>
                                        {userRole === 'admin' && (
                                            <TouchableOpacity
                                                onPress={() => handleUnassignSupervisor(sup.id, sup.name)}
                                                style={local.removeBtn}
                                            >
                                                <MaterialIcons name="remove-circle" size={24} color="#ff3b30" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))
                            )}
                        </View>

                        {/* Labours Section */}
                        <View style={local.section}>
                            <Text style={local.sectionTitle}>Labours at this Site</Text>
                            {site.labours.length === 0 ? (
                                <Text style={local.emptyText}>No labours assigned to this site</Text>
                            ) : (
                                site.labours.map((labour) => (
                                    <View key={labour.id} style={local.personCard}>
                                        <View style={local.personIconWrapGreen}>
                                            <MaterialIcons name="engineering" size={20} color="#34c759" />
                                        </View>
                                        <View style={local.personInfo}>
                                            <Text style={local.personName}>{labour.name}</Text>
                                            <Text style={local.personPhone}>{labour.phone || labour.trade}</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>

                        {/* Delete Button - Admin Only */}
                        {userRole === 'admin' && (
                            <TouchableOpacity style={local.deleteBtn} onPress={handleDelete}>
                                <MaterialIcons name="delete" size={20} color="#fff" />
                                <Text style={local.deleteBtnText}>Delete Site</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0a84ff']} />
                }
            />

            {/* Assign Supervisor Modal */}
            <Modal visible={showAssignModal} transparent animationType="slide">
                <View style={local.modalOverlay}>
                    <View style={local.modalContent}>
                        <View style={local.modalHeader}>
                            <Text style={local.modalTitle}>Assign Supervisor</Text>
                            <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                                <MaterialIcons name="close" size={24} color={isDark ? "#fff" : "#333"} />
                            </TouchableOpacity>
                        </View>
                        {availableSupervisors.length === 0 ? (
                            <Text style={local.emptyText}>No available supervisors to assign</Text>
                        ) : (
                            <FlatList
                                data={availableSupervisors}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={local.supervisorOption}
                                        onPress={() => handleAssignSupervisor(item.id)}
                                    >
                                        <View style={local.personIconWrap}>
                                            <MaterialIcons name="person" size={20} color={isDark ? "#4da6ff" : "#0a84ff"} />
                                        </View>
                                        <View style={local.personInfo}>
                                            <Text style={local.personName}>{item.name}</Text>
                                            <Text style={local.personPhone}>{item.phone}</Text>
                                        </View>
                                        <MaterialIcons name="add-circle" size={24} color="#34c759" />
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: isDark ? "#121212" : "#f5f5f5",
    },
    loaderContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
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
    editButton: {
        padding: 8,
    },
    content: {
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: isDark ? "#fff" : "#333",
        marginBottom: 12,
    },
    infoCard: {
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        padding: 16,
        borderRadius: 12,
    },
    siteName: {
        fontSize: 20,
        fontWeight: "700",
        color: isDark ? "#fff" : "#333",
        marginBottom: 8,
    },
    siteAddress: {
        fontSize: 14,
        color: isDark ? "#aaa" : "#666",
        marginBottom: 4,
    },
    siteDesc: {
        fontSize: 14,
        color: isDark ? "#888" : "#888",
        marginTop: 8,
    },
    editForm: {
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        padding: 16,
        borderRadius: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: "500",
        color: isDark ? "#ccc" : "#333",
        marginBottom: 6,
        marginTop: 12,
    },
    input: {
        borderWidth: 1,
        borderColor: isDark ? "#444" : "#e6e6e6",
        padding: 12,
        borderRadius: 8,
        backgroundColor: isDark ? "#2a2a2a" : "#fafafa",
        fontSize: 16,
        color: isDark ? "#fff" : "#000",
    },
    saveBtn: {
        backgroundColor: "#0a84ff",
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 16,
    },
    saveBtnText: {
        color: "#fff",
        fontWeight: "700",
    },
    addBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    addBtnText: {
        color: isDark ? "#4da6ff" : "#0a84ff",
        fontWeight: "600",
    },
    emptyText: {
        color: isDark ? "#888" : "#999",
        fontSize: 14,
        textAlign: "center",
        padding: 16,
    },
    personCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    personIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: isDark ? "#1a3b5c" : "#e8f4ff",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    personIconWrapGreen: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: isDark ? "#1b4323" : "#e8fdf0",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    personInfo: {
        flex: 1,
    },
    personName: {
        fontSize: 14,
        fontWeight: "600",
        color: isDark ? "#fff" : "#333",
    },
    personPhone: {
        fontSize: 12,
        color: isDark ? "#aaa" : "#666",
    },
    removeBtn: {
        padding: 4,
    },
    deleteBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ff3b30",
        padding: 14,
        borderRadius: 8,
        gap: 8,
        marginTop: 16,
    },
    deleteBtnText: {
        color: "#fff",
        fontWeight: "700",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: "70%",
        padding: 16,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? "#333" : "#eee",
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: isDark ? "#fff" : "#333",
    },
    supervisorOption: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? "#333" : "#f0f0f0",
    },
});
