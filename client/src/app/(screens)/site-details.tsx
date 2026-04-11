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
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";
import { sortByName } from "../../utils/sort";

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
}

interface SiteDetails {
    id: number;
    name: string;
    address: string;
    description: string;
    status: string;
    completion_percentage: number;
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
    const [showAssignLabourModal, setShowAssignLabourModal] = useState(false);
    const [availableLabours, setAvailableLabours] = useState<Labour[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const fetchRole = async () => {
            try {
                const userStr = await AsyncStorage.getItem('userData');
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
                // Sort supervisors and labours before storing
                data.supervisors = sortByName(data.supervisors || []);
                data.labours = sortByName(data.labours || []);
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
                setAvailableSupervisors(sortByName(available));
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
                if (Platform.OS === 'web') {
                    window.alert("Site updated successfully");
                } else {
                    Alert.alert("Success", "Site updated successfully");
                }
                setIsEditing(false);
                fetchSiteDetails();
            } else {
                const data = await response.json();
                if (Platform.OS === 'web') {
                    window.alert(data.error || "Failed to update site");
                } else {
                    Alert.alert("Error", data.error || "Failed to update site");
                }
            }
        } catch (error) {
            if (Platform.OS === 'web') {
                window.alert("Failed to connect to server");
            } else {
                Alert.alert("Error", "Failed to connect to server");
            }
        }
    };

    const handleToggleStatus = async () => {
        if (!site) return;
        const newStatus = site.status === 'inactive' ? 'active' : 'inactive';
        const confirmMsg = newStatus === 'inactive'
            ? 'Mark this site as Inactive? Labour assignments will be blocked.'
            : 'Reactivate this site?';

        const execute = async () => {
            try {
                const response = await api.put(`/sites/${id}/status`, { status: newStatus });
                if (response.ok) {
                    fetchSiteDetails();
                } else {
                    const data = await response.json();
                    if (Platform.OS === 'web') {
                        window.alert(data.error || 'Failed to update status');
                    } else {
                        Alert.alert('Error', data.error || 'Failed to update status');
                    }
                }
            } catch {
                if (Platform.OS === 'web') {
                    window.alert('Failed to connect to server');
                } else {
                    Alert.alert('Error', 'Failed to connect to server');
                }
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(confirmMsg)) execute();
        } else {
            Alert.alert(
                newStatus === 'inactive' ? 'Mark as Inactive' : 'Reactivate Site',
                confirmMsg,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: newStatus === 'inactive' ? 'Inactive' : 'Activate', style: newStatus === 'inactive' ? 'destructive' : 'default', onPress: execute }
                ]
            );
        }
    };

    const handleUpdateProgress = async (newProgress: number) => {
        try {
            const response = await api.put(`/sites/${id}/progress`, { progress: newProgress });
            if (response.ok) {
                fetchSiteDetails(); // refresh to get updated status and percentage
            } else {
                const data = await response.json();
                if (Platform.OS === 'web') {
                    window.alert(data.error || "Failed to update progress");
                } else {
                    Alert.alert("Error", data.error || "Failed to update progress");
                }
            }
        } catch (error) {
            if (Platform.OS === 'web') {
                window.alert("Failed to connect to server");
            } else {
                Alert.alert("Error", "Failed to connect to server");
            }
        }
    };

    const handleAssignSupervisor = async (supervisorId: number, name: string) => {
        const executeAssign = async () => {
            try {
                const response = await api.post(`/sites/${id}/assign`, { supervisor_id: supervisorId });

                if (response.ok) {
                    if (Platform.OS === 'web') {
                        window.alert("Supervisor assigned to site");
                    } else {
                        Alert.alert("Success", "Supervisor assigned to site");
                    }
                    setShowAssignModal(false);
                    fetchSiteDetails();
                } else {
                    const data = await response.json();
                    if (Platform.OS === 'web') {
                        window.alert(data.error || "Failed to assign supervisor");
                    } else {
                        Alert.alert("Error", data.error || "Failed to assign supervisor");
                    }
                }
            } catch (error) {
                if (Platform.OS === 'web') {
                    window.alert("Failed to connect to server");
                } else {
                    Alert.alert("Error", "Failed to connect to server");
                }
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Assign ${name} to this site?`)) {
                executeAssign();
            }
        } else {
            Alert.alert(
                "Assign Supervisor",
                `Assign ${name} to this site?`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Assign", onPress: executeAssign }
                ]
            );
        }
    };

    const handleUnassignSupervisor = (supervisorId: number, name: string) => {
        const executeRemove = async () => {
            try {
                const response = await api.delete(
                    `/sites/${id}/unassign/${supervisorId}`
                );

                if (response.ok) {
                    fetchSiteDetails();
                } else {
                    const data = await response.json();
                    if (Platform.OS === 'web') {
                        window.alert(data.error || "Failed to remove supervisor");
                    } else {
                        Alert.alert("Error", data.error || "Failed to remove supervisor");
                    }
                }
            } catch (error) {
                if (Platform.OS === 'web') {
                    window.alert("Failed to connect to server");
                } else {
                    Alert.alert("Error", "Failed to connect to server");
                }
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Remove ${name} from this site?`)) {
                executeRemove();
            }
        } else {
            Alert.alert(
                "Remove Supervisor",
                `Remove ${name} from this site?`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: executeRemove }
                ]
            );
        }
    };

    const openAssignModal = () => {
        fetchAvailableSupervisors();
        setShowAssignModal(true);
    };

    const fetchAvailableLabours = async () => {
        try {
            const response = await api.get("/labours?status=unassigned");
            const data = await response.json();
            if (response.ok) {
                const assignedIds = site?.labours.map(l => l.id) || [];
                const available = data.filter((l: Labour) => !assignedIds.includes(l.id));
                setAvailableLabours(sortByName(available));
            }
        } catch (error) {
            console.error("Fetch labours error:", error);
        }
    };

    const handleAssignLabour = async (labourId: number, name: string) => {
        const executeAssign = async () => {
            try {
                const response = await api.post(`/sites/${id}/assign-labour`, { labour_id: labourId });
                if (response.ok) {
                    if (Platform.OS === 'web') {
                        window.alert("Labour assigned to site");
                    } else {
                        Alert.alert("Success", "Labour assigned to site");
                    }
                    setShowAssignLabourModal(false);
                    fetchSiteDetails();
                } else {
                    const data = await response.json();
                    if (Platform.OS === 'web') {
                        window.alert(data.error || "Failed to assign labour");
                    } else {
                        Alert.alert("Error", data.error || "Failed to assign labour");
                    }
                }
            } catch (error) {
                if (Platform.OS === 'web') {
                    window.alert("Failed to connect to server");
                } else {
                    Alert.alert("Error", "Failed to connect to server");
                }
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Assign ${name} to this site?`)) {
                executeAssign();
            }
        } else {
            Alert.alert(
                "Assign Labour",
                `Assign ${name} to this site?`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Assign", onPress: executeAssign }
                ]
            );
        }
    };

    const handleUnassignLabour = (labourId: number, name: string) => {
        const executeRemove = async () => {
            try {
                const response = await api.delete(`/sites/${id}/unassign-labour/${labourId}`);
                if (response.ok) {
                    fetchSiteDetails();
                } else {
                    const data = await response.json();
                    if (Platform.OS === 'web') {
                        window.alert(data.error || "Failed to remove labour");
                    } else {
                        Alert.alert("Error", data.error || "Failed to remove labour");
                    }
                }
            } catch (error) {
                if (Platform.OS === 'web') {
                    window.alert("Failed to connect to server");
                } else {
                    Alert.alert("Error", "Failed to connect to server");
                }
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Remove ${name} from this site?`)) {
                executeRemove();
            }
        } else {
            Alert.alert(
                "Remove Labour",
                `Remove ${name} from this site?`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: executeRemove }
                ]
            );
        }
    };

    const openAssignLabourModal = () => {
        fetchAvailableLabours();
        setShowAssignLabourModal(true);
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
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={local.siteName}>{site.name}</Text>
                                                {site.address && <Text style={local.siteAddress}>{site.address}</Text>}
                                            </View>
                                            {/* Status Badge */}
                                            <View style={[
                                                local.statusBadge, 
                                                { 
                                                    backgroundColor: site.status === 'completed' ? (isDark ? '#0d2b1c' : '#e8fdf0') : 
                                                                     site.status === 'inactive' ? (isDark ? '#3b2a00' : '#fff8e1') :
                                                                     (isDark ? '#1a3b5c' : '#e8f4ff')
                                                }
                                            ]}>
                                                <View style={[
                                                    local.statusDot, 
                                                    { 
                                                        backgroundColor: site.status === 'completed' ? '#34c759' : 
                                                                         site.status === 'inactive' ? '#ff9500' : '#0a84ff' 
                                                    }
                                                ]} />
                                                <Text style={[
                                                    local.statusBadgeText, 
                                                    { 
                                                        color: site.status === 'completed' ? '#34c759' : 
                                                               site.status === 'inactive' ? '#ff9500' : '#0a84ff' 
                                                    }
                                                ]}>
                                                    {site.status === 'completed' ? 'Completed' : 
                                                     site.status === 'inactive' ? 'Inactive' : 'Active'}
                                                </Text>
                                            </View>
                                        </View>
                                        {site.description && <Text style={local.siteDesc}>{site.description}</Text>}

                                        {/* Inactive / Activate toggle — admin only, non-completed */}
                                        {userRole === 'admin' && site.status !== 'completed' && (
                                            <TouchableOpacity
                                                style={[
                                                    local.toggleStatusBtn,
                                                    site.status === 'inactive'
                                                        ? local.toggleStatusBtnActivate
                                                        : local.toggleStatusBtnInactive,
                                                ]}
                                                onPress={handleToggleStatus}
                                            >
                                                <MaterialIcons
                                                    name={site.status === 'inactive' ? 'play-circle-filled' : 'pause-circle-filled'}
                                                    size={16}
                                                    color={site.status === 'inactive' ? '#34c759' : '#ff9500'}
                                                />
                                                <Text style={[
                                                    local.toggleStatusBtnText,
                                                    { color: site.status === 'inactive' ? '#34c759' : '#ff9500' }
                                                ]}>
                                                    {site.status === 'inactive' ? 'Mark as Active' : 'Mark as Inactive'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            </View>

                            {/* Progress Section */}
                            <View style={local.section}>
                                <Text style={local.sectionTitle}>Site Progress</Text>
                                <View style={local.progressCard}>
                                    <View style={local.progressHeaderRow}>
                                        <Text style={local.progressLabel}>Completion</Text>
                                        <Text style={local.progressValueText}>{Math.round(site.completion_percentage || 0)}%</Text>
                                    </View>
                                    
                                    <View style={local.largeProgressTrack}>
                                        <View style={[local.largeProgressFill, { 
                                            width: `${Math.min(100, Math.max(0, site.completion_percentage || 0))}%` as any, 
                                            backgroundColor: site.status === 'completed' ? '#34c759' : (isDark ? '#4da6ff' : '#0a84ff')
                                        }]} />
                                    </View>
                                    
                                    {(userRole === 'admin' || userRole === 'supervisor') && site.status !== 'completed' && (
                                        <View style={local.progressControls}>
                                            <Text style={local.updateProgressLabel}>Update Progress:</Text>
                                            <View style={local.progressActionsRow}>
                                                {[25, 50, 75, 100].map(val => (
                                                    <TouchableOpacity 
                                                        key={val}
                                                        style={val === 100 ? local.completeBtn : local.progressBtn}
                                                        onPress={() => {
                                                            if (val === 100) {
                                                                if (Platform.OS === 'web') {
                                                                    if (window.confirm("Marking progress at 100% will complete this site and prevent further labour assignments. Continue?")) {
                                                                        handleUpdateProgress(100);
                                                                    }
                                                                } else {
                                                                    Alert.alert(
                                                                        "Complete Site",
                                                                        "Marking progress at 100% will complete this site and prevent further labour assignments. Continue?",
                                                                        [
                                                                            { text: "Cancel", style: "cancel" },
                                                                            { text: "Complete", style: "default", onPress: () => handleUpdateProgress(100) }
                                                                        ]
                                                                    );
                                                                }
                                                            } else {
                                                                handleUpdateProgress(val);
                                                            }
                                                        }}
                                                    >
                                                        <Text style={val === 100 ? local.completeBtnText : local.progressBtnText}>
                                                            {val === 100 ? "Complete Site" : `Set ${val}%`}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                    {(userRole === 'admin' || userRole === 'supervisor') && site.status === 'completed' && (
                                        <TouchableOpacity 
                                            style={local.revertProgressBtn}
                                            onPress={() => handleUpdateProgress(99)} // Drops to 99% to reopen site
                                        >
                                            <MaterialIcons name="refresh" size={16} color={isDark ? "#aaa" : "#666"} />
                                            <Text style={local.revertProgressText}>Reopen Site (set to 99%)</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                        {/* Supervisors Section */}
                        <View style={local.section}>
                            <View style={local.sectionHeader}>
                                <Text style={local.sectionTitle}>Assigned Supervisors</Text>
                                {(userRole === 'admin' || userRole === 'supervisor') && (
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
                                        {(userRole === 'admin' || userRole === 'supervisor') && (
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
                            <View style={local.sectionHeader}>
                                <Text style={local.sectionTitle}>Labours at this Site</Text>
                                {(userRole === 'admin' || userRole === 'supervisor') && (
                                    <TouchableOpacity onPress={openAssignLabourModal} style={local.addBtn}>
                                        <MaterialIcons name="add" size={20} color={isDark ? "#4da6ff" : "#0a84ff"} />
                                        <Text style={local.addBtnText}>Assign</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
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
                                            <Text style={local.personPhone}>{labour.phone}</Text>
                                        </View>
                                        {(userRole === 'admin' || userRole === 'supervisor') && (
                                            <TouchableOpacity
                                                onPress={() => handleUnassignLabour(labour.id, labour.name)}
                                                style={local.removeBtn}
                                            >
                                                <MaterialIcons name="remove-circle" size={24} color="#ff3b30" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))
                            )}
                        </View>

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
                                        onPress={() => handleAssignSupervisor(item.id, item.name)}
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

            {/* Assign Labour Modal */}
            <Modal visible={showAssignLabourModal} transparent animationType="slide">
                <View style={local.modalOverlay}>
                    <View style={local.modalContent}>
                        <View style={local.modalHeader}>
                            <Text style={local.modalTitle}>Assign Labour</Text>
                            <TouchableOpacity onPress={() => setShowAssignLabourModal(false)}>
                                <MaterialIcons name="close" size={24} color={isDark ? "#fff" : "#333"} />
                            </TouchableOpacity>
                        </View>
                        {availableLabours.length === 0 ? (
                            <Text style={local.emptyText}>No available labours to assign</Text>
                        ) : (
                            <FlatList
                                data={availableLabours}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={local.supervisorOption}
                                        onPress={() => handleAssignLabour(item.id, item.name)}
                                    >
                                        <View style={local.personIconWrapGreen}>
                                            <MaterialIcons name="engineering" size={20} color="#34c759" />
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
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 12,
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 0.5,
        textTransform: "uppercase",
    },
    progressCard: {
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        padding: 16,
        borderRadius: 12,
    },
    progressHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    progressLabel: {
        fontSize: 14,
        fontWeight: "500",
        color: isDark ? "#ccc" : "#333",
    },
    progressValueText: {
        fontSize: 18,
        fontWeight: "800",
        color: isDark ? "#fff" : "#333",
    },
    largeProgressTrack: {
        height: 12,
        backgroundColor: isDark ? "#333" : "#e0e0e0",
        borderRadius: 6,
        overflow: "hidden",
        marginBottom: 16,
    },
    largeProgressFill: {
        height: "100%",
        borderRadius: 6,
    },
    progressControls: {
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: isDark ? "#333" : "#f0f0f0",
        paddingTop: 16,
    },
    updateProgressLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: isDark ? "#888" : "#666",
        marginBottom: 12,
    },
    progressActionsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    progressBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: isDark ? "#2a2a2a" : "#f0f0f0",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: isDark ? "#444" : "#e0e0e0",
    },
    progressBtnText: {
        fontSize: 14,
        fontWeight: "600",
        color: isDark ? "#ccc" : "#555",
    },
    completeBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: "#1b4323",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#34c759",
    },
    completeBtnText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#34c759",
    },
    revertProgressBtn: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        padding: 12,
        marginTop: 8,
        gap: 8,
    },
    revertProgressText: {
        fontSize: 14,
        color: isDark ? "#aaa" : "#666",
        fontWeight: "500",
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
    toggleStatusBtn: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        marginTop: 14,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    toggleStatusBtnInactive: {
        backgroundColor: isDark ? "#3b2a00" : "#fff8e1",
        borderColor: "#ff9500",
    },
    toggleStatusBtnActivate: {
        backgroundColor: isDark ? "#0d2b1c" : "#e8fdf0",
        borderColor: "#34c759",
    },
    toggleStatusBtnText: {
        fontSize: 13,
        fontWeight: "700",
        letterSpacing: 0.2,
    },
});
