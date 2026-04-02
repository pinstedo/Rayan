
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { CustomModal } from "../../components/CustomModal";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";

interface Labour {
    id: number;
    name: string;
    phone: string;
    aadhaar: string;
    trade: string;
    rate: number;
    site: string;
    site_id: number;
    status: 'active' | 'unassigned';
    profile_image?: string;
    date_of_birth?: string;
    emergency_phone?: string;
    notes?: string;
}

export default function LabourDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { isDark } = useTheme();
    const local = getStyles(isDark);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [labour, setLabour] = useState<Labour | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Labour>>({});

    // Modals
    const [showBonusModal, setShowBonusModal] = useState(false);
    const [bonusAmount, setBonusAmount] = useState("");
    const [bonusNotes, setBonusNotes] = useState("");
    const [savingBonus, setSavingBonus] = useState(false);

    const [showIncrementModal, setShowIncrementModal] = useState(false);
    const [newRate, setNewRate] = useState("");
    const [savingIncrement, setSavingIncrement] = useState(false);

    useEffect(() => {
        fetchLabourDetails();
    }, [id]);

    const fetchLabourDetails = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/labours/${id}`);
            if (response.ok) {
                const data = await response.json();
                setLabour(data);
                setFormData(data);
            } else {
                Alert.alert("Error", "Failed to fetch labour details");
                router.back();
            }
        } catch (error) {
            console.error("Error fetching labour:", error);
            Alert.alert("Error", "Unable to connect to server");
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.name?.trim() || !formData.phone?.trim()) {
            Alert.alert("Error", "Name and Phone are required");
            return;
        }

        try {
            setSaving(true);
            const payload = {
                ...formData,
                rate: Number(formData.rate), // Ensure numeric
            };

            const response = await api.put(`/labours/${id}`, payload);
            const data = await response.json();

            if (response.ok) {
                setLabour(data as Labour);
                setIsEditing(false);
                Alert.alert("Success", "Labour details updated successfully");
            } else {
                Alert.alert("Error", data.error || "Failed to update labour");
            }
        } catch (error) {
            console.error("Error updating labour:", error);
            Alert.alert("Error", "Unable to connect to server");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBonus = async () => {
        if (!bonusAmount || isNaN(Number(bonusAmount)) || Number(bonusAmount) <= 0) {
            Alert.alert("Error", "Please enter a valid amount");
            return;
        }

        try {
            setSavingBonus(true);
            const response = await api.post(`/labours/${id}/bonus`, {
                amount: Number(bonusAmount),
                date: new Date().toISOString(),
                notes: bonusNotes
            });

            const data = await response.json();

            if (response.ok) {
                Alert.alert("Success", "Bonus recorded successfully");
                setShowBonusModal(false);
                setBonusAmount("");
                setBonusNotes("");
            } else {
                Alert.alert("Error", data.error || "Failed to record bonus");
            }
        } catch (error) {
            console.error("Error recording bonus:", error);
            Alert.alert("Error", "Unable to connect to server");
        } finally {
            setSavingBonus(false);
        }
    };

    const handleSaveIncrement = async () => {
        if (!newRate || isNaN(Number(newRate)) || Number(newRate) <= 0) {
            Alert.alert("Error", "Please enter a valid rate");
            return;
        }

        try {
            setSavingIncrement(true);
            const payload = {
                ...labour,
                rate: Number(newRate),
            };

            const response = await api.put(`/labours/${id}`, payload);
            const data = await response.json();

            if (response.ok) {
                setLabour(data as Labour);
                setFormData(data as Labour);
                setShowIncrementModal(false);
                Alert.alert("Success", "Daily rate updated successfully");
            } else {
                Alert.alert("Error", data.error || "Failed to update rate");
            }
        } catch (error) {
            console.error("Error updating rate:", error);
            Alert.alert("Error", "Unable to connect to server");
        } finally {
            setSavingIncrement(false);
        }
    };

    const calculateAge = (dobString?: string) => {
        if (!dobString) return null;
        const dob = new Date(dobString);
        const diffMs = Date.now() - dob.getTime();
        const ageDate = new Date(diffMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };

    if (loading) {
        return (
            <View style={local.loadingContainer}>
                <ActivityIndicator size="large" color="#0a84ff" />
            </View>
        );
    }

    if (!labour) return null;

    const renderDetailItem = ({ label, value, icon, isEditable = false, field, keyboardType = 'default' }: any) => (
        <View style={local.inputGroup}>
            <Text style={local.label}>{label}</Text>
            <View style={[local.inputContainer, !isEditing && local.readOnlyContainer]}>
                <Ionicons name={icon} size={20} color={isDark ? "#aaa" : "#666"} style={local.inputIcon} />
                {isEditing && isEditable ? (
                    <TextInput
                        style={local.input}
                        value={String(field ? (formData as any)[field] || "" : value)}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, [field]: text }))}
                        editable={true}
                        keyboardType={keyboardType}
                        placeholderTextColor={isDark ? "#888" : "#999"}
                    />
                ) : (
                    <Text style={local.inputText}>{value || "-"}</Text>
                )}
            </View>
        </View>
    );

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={local.container}
            enabled={Platform.OS !== "web"}
        >
            <ScrollView contentContainerStyle={local.scrollContent}>
                <View style={local.header}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={local.backButton}
                    >
                        <Ionicons name="arrow-back" size={24} color={isDark ? "#fff" : "#333"} />
                    </TouchableOpacity>
                    <Text style={local.title}>Labour Details</Text>
                    <TouchableOpacity
                        onPress={() => {
                            if (isEditing) {
                                // If cancelling edit, reset form data
                                setFormData(labour);
                                setIsEditing(false);
                            } else {
                                setIsEditing(true);
                            }
                        }}
                        style={local.editButton}
                    >
                        <Text style={local.editButtonText}>{isEditing ? "Cancel" : "Edit"}</Text>
                    </TouchableOpacity>
                </View>

                {/* Profile Header Card */}
                <View style={local.profileCard}>
                    <View style={local.avatarContainer}>
                        {/* Placeholder for avatar, or use image if available */}
                        <Ionicons name="person" size={40} color={isDark ? "#333" : "#fff"} />
                    </View>
                    <View>
                        <Text style={local.profileName}>{labour.name}</Text>
                        <Text style={local.profileId}>ID: {labour.id}</Text>
                        <View style={[local.statusBadge,
                        { backgroundColor: labour.status === 'active' ? (isDark ? '#1b4323' : '#2e7d32') : (isDark ? '#444' : '#9e9e9e') }
                        ]}>
                            <Text style={local.statusText}>{labour.status.toUpperCase()}</Text>
                        </View>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={local.actionRow}>
                    <TouchableOpacity style={local.actionBtn} onPress={() => setShowBonusModal(true)}>
                        <Ionicons name="gift-outline" size={20} color="#fff" />
                        <Text style={local.actionBtnText}>Record Bonus</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[local.actionBtn, { backgroundColor: isDark ? '#2e7d32' : '#4CAF50' }]} onPress={() => { setNewRate(String(labour.rate || "")); setShowIncrementModal(true); }}>
                        <Ionicons name="trending-up-outline" size={20} color="#fff" />
                        <Text style={local.actionBtnText}>Update Rate</Text>
                    </TouchableOpacity>
                </View>

                <View style={local.formContainer}>
                    <Text style={local.sectionTitle}>Personal Information</Text>

                    {renderDetailItem({
                        label: "Full Name",
                        value: labour.name,
                        field: "name",
                        icon: "person-outline",
                        isEditable: true
                    })}

                    {renderDetailItem({
                        label: "Phone Number",
                        value: labour.phone,
                        field: "phone",
                        icon: "call-outline",
                        isEditable: true,
                        keyboardType: "phone-pad"
                    })}

                    {renderDetailItem({
                        label: "Date of Birth (YYYY-MM-DD)",
                        value: labour.date_of_birth,
                        field: "date_of_birth",
                        icon: "calendar-outline",
                        isEditable: true
                    })}

                    {labour.date_of_birth && (
                        <View style={local.inputGroup}>
                            <Text style={local.label}>Age</Text>
                            <View style={[local.inputContainer, local.readOnlyContainer]}>
                                <Ionicons name="hourglass-outline" size={20} color={isDark ? "#aaa" : "#666"} style={local.inputIcon} />
                                <Text style={local.inputText}>{calculateAge(labour.date_of_birth)} yrs</Text>
                            </View>
                        </View>
                    )}

                    {renderDetailItem({
                        label: "Aadhaar Number",
                        value: labour.aadhaar,
                        field: "aadhaar",
                        icon: "card-outline",
                        isEditable: true,
                        keyboardType: "numeric"
                    })}

                    {renderDetailItem({
                        label: "Emergency Contact",
                        value: labour.emergency_phone,
                        field: "emergency_phone",
                        icon: "medical-outline",
                        isEditable: true,
                        keyboardType: "phone-pad"
                    })}

                    <View style={local.divider} />
                    <Text style={local.sectionTitle}>Work Details</Text>

                    {renderDetailItem({
                        label: "Trade / Role",
                        value: labour.trade,
                        field: "trade",
                        icon: "briefcase-outline",
                        isEditable: true
                    })}

                    {renderDetailItem({
                        label: "Daily Rate (₹)",
                        value: String(labour.rate || 0),
                        field: "rate",
                        icon: "cash-outline",
                        isEditable: true,
                        keyboardType: "numeric"
                    })}

                    {renderDetailItem({
                        label: "Current Site",
                        value: labour.site,
                        field: "site",
                        icon: "location-outline",
                        isEditable: true
                    })}

                    {renderDetailItem({
                        label: "Status",
                        value: labour.status,
                        icon: "flag-outline",
                        isEditable: false
                    })}

                    <View style={local.divider} />
                    {renderDetailItem({
                        label: "Notes",
                        value: labour.notes,
                        field: "notes",
                        icon: "document-text-outline",
                        isEditable: true
                    })}

                    {isEditing && (
                        <TouchableOpacity
                            style={[local.saveButton, saving && local.disabledButton]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            <Text style={local.saveButtonText}>
                                {saving ? "Saving..." : "Save Changes"}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>

            {/* Bonus Modal */}
            <CustomModal
                visible={showBonusModal}
                onClose={() => setShowBonusModal(false)}
                title="Record Bonus"
                actions={[
                    { text: "Cancel", onPress: () => setShowBonusModal(false), style: "cancel" },
                    { text: savingBonus ? "Saving..." : "Save Bonus", onPress: handleSaveBonus, style: "default" }
                ]}
            >
                <View style={local.modalForm}>
                    <View style={local.inputGroup}>
                        <Text style={local.label}>Amount (₹)</Text>
                        <TextInput
                            style={local.input}
                            keyboardType="numeric"
                            placeholder="Enter amount"
                            value={bonusAmount}
                            onChangeText={setBonusAmount}
                            placeholderTextColor={isDark ? "#888" : "#999"}
                        />
                    </View>
                    <View style={local.inputGroup}>
                        <Text style={local.label}>Notes</Text>
                        <TextInput
                            style={[local.input, { height: 80, textAlignVertical: 'top' }]}
                            placeholder="Optional notes"
                            value={bonusNotes}
                            onChangeText={setBonusNotes}
                            multiline
                            numberOfLines={3}
                            placeholderTextColor={isDark ? "#888" : "#999"}
                        />
                    </View>
                </View>
            </CustomModal>

            {/* Increment Modal */}
            <CustomModal
                visible={showIncrementModal}
                onClose={() => setShowIncrementModal(false)}
                title="Update Daily Rate"
                actions={[
                    { text: "Cancel", onPress: () => setShowIncrementModal(false), style: "cancel" },
                    { text: savingIncrement ? "Saving..." : "Update Rate", onPress: handleSaveIncrement, style: "default" }
                ]}
            >
                <View style={local.modalForm}>
                    <View style={local.inputGroup}>
                        <Text style={local.label}>Current Rate: ₹{labour.rate || 0}</Text>
                    </View>
                    <View style={local.inputGroup}>
                        <Text style={local.label}>New Daily Rate (₹)</Text>
                        <TextInput
                            style={local.input}
                            keyboardType="numeric"
                            placeholder="Enter new rate"
                            value={newRate}
                            onChangeText={setNewRate}
                            placeholderTextColor={isDark ? "#888" : "#999"}
                        />
                    </View>
                </View>
            </CustomModal>
        </KeyboardAvoidingView>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: isDark ? "#121212" : "#f5f6fa",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: isDark ? "#121212" : "#f5f6fa",
    },
    scrollContent: {
        flexGrow: 1,
        padding: 20,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
        marginTop: 10,
    },
    backButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    editButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: isDark ? "#173a5a" : "#e3f2fd",
    },
    editButtonText: {
        color: isDark ? "#64b5f6" : "#0a84ff",
        fontWeight: "600",
        fontSize: 14,
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        color: isDark ? "#fff" : "#2d3436",
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? "#1e1e1e" : '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    avatarContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: isDark ? '#444' : '#bdbdbd',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        borderWidth: 2,
        borderColor: isDark ? '#1e1e1e' : '#fff',
    },
    profileName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: isDark ? '#fff' : '#333',
    },
    profileId: {
        fontSize: 12,
        color: isDark ? '#aaa' : '#888',
        marginBottom: 4,
    },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    statusText: {
        color: isDark ? '#eee' : '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    formContainer: {
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        borderRadius: 16,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: isDark ? "#aaa" : "#636e72",
        marginBottom: 20,
        marginTop: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: "600",
        color: isDark ? "#bbb" : "#636e72",
        marginBottom: 6,
        marginLeft: 4,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: isDark ? "#2a2a2a" : "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isDark ? "#444" : "#e1e1e1",
        paddingHorizontal: 15,
        height: 50,
    },
    readOnlyContainer: {
        backgroundColor: isDark ? "#1a1a1a" : "#f8f9fa",
        borderColor: isDark ? "#333" : "#f0f0f0",
        borderWidth: 1,
    },
    inputIcon: {
        marginRight: 10,
        width: 20,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: isDark ? "#fff" : "#2d3436",
        height: "100%",
    },
    inputText: {
        flex: 1,
        fontSize: 16,
        color: isDark ? "#fff" : "#2d3436",
    },
    divider: {
        height: 1,
        backgroundColor: isDark ? "#333" : "#f0f0f0",
        marginVertical: 20,
    },
    saveButton: {
        backgroundColor: "#0a84ff",
        borderRadius: 12,
        height: 55,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 20,
        shadowColor: "#0a84ff",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledButton: {
        backgroundColor: "#a0cfff",
        shadowOpacity: 0,
    },
    saveButtonText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
    },
    actionRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 20,
        gap: 10,
    },
    actionBtn: {
        flex: 1,
        flexDirection: "row",
        backgroundColor: "#0a84ff",
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    actionBtnText: {
        color: "#fff",
        marginLeft: 8,
        fontWeight: "600",
        fontSize: 15,
    },
    modalForm: {
        paddingTop: 10,
        width: "100%",
    },
});
