import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Clipboard,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";
import { CustomModal, ModalType } from "../../components/CustomModal";

export default function EditSupervisorScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { isDark } = useTheme();
    const local = getStyles(isDark);

    const [id] = useState(params.id);
    const [name, setName] = useState(params.name as string || "");
    const [phone, setPhone] = useState(params.phone as string || "");
    const [loading, setLoading] = useState(false);

    // Forgot/Reset Password States
    const [adminPasswordModalVisible, setAdminPasswordModalVisible] = useState(false);
    const [adminPassword, setAdminPassword] = useState("");
    const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false);
    const [tempPasswordModalVisible, setTempPasswordModalVisible] = useState(false);
    const [generatedTempPassword, setGeneratedTempPassword] = useState("");

    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState<{
        title: string;
        message: string;
        type: ModalType;
        actions: { text: string; onPress: () => void; style?: "cancel" | "destructive" | "default" }[];
    }>({
        title: "",
        message: "",
        type: "default",
        actions: [],
    });

    const showModal = (
        title: string,
        message: string,
        type: ModalType,
        actions: { text: string; onPress: () => void; style?: "cancel" | "destructive" | "default" }[]
    ) => {
        setModalConfig({ title, message, type, actions });
        setModalVisible(true);
    };

    const handleUpdate = async () => {
        if (!name.trim()) {
            showModal("Validation Error", "Please enter the supervisor's name.", "error", [
                { text: "OK", onPress: () => setModalVisible(false), style: "default" }
            ]);
            return;
        }
        if (!phone.trim()) {
            showModal("Validation Error", "Please enter the phone number.", "error", [
                { text: "OK", onPress: () => setModalVisible(false), style: "default" }
            ]);
            return;
        }
        setLoading(true);
        try {
            const payload: any = {
                name,
                phone,
            };

            const response = await api.put(`/auth/supervisors/${id}`, payload);
            const data = await response.json();

            if (response.ok) {
                showModal("Success", "Supervisor updated successfully!", "success", [
                    { 
                        text: "OK", 
                        onPress: () => {
                            setModalVisible(false);
                            router.back();
                        },
                        style: "default"
                    },
                ]);
            } else {
                showModal("Error", data.error || "Failed to update supervisor", "error", [
                    { text: "OK", onPress: () => setModalVisible(false), style: "default" }
                ]);
            }
        } catch (error) {
            console.error("Update supervisor error:", error);
            showModal("Error", "Unable to connect to server", "error", [
                { text: "OK", onPress: () => setModalVisible(false), style: "default" }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        showModal(
            "Delete Supervisor",
            "Are you sure you want to delete this supervisor? Their access will be revoked immediately and they will be moved to the bin for 7 days.",
            "warning",
            [
                { text: "Cancel", style: "cancel", onPress: () => setModalVisible(false) },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setModalVisible(false);
                        setLoading(true);
                        try {
                            const response = await api.delete(`/auth/supervisors/${id}`);
                            const data = await response.json();
                            if (response.ok) {
                                showModal("Success", "Supervisor moved to bin successfully!", "success", [
                                    { 
                                        text: "OK", 
                                        onPress: () => {
                                            setModalVisible(false);
                                            // Go back twice to return to supervisors list
                                            router.dismiss(2);
                                        },
                                        style: "default"
                                    },
                                ]);
                            } else {
                                showModal("Error", data.error || "Failed to delete supervisor", "error", [
                                    { text: "OK", onPress: () => setModalVisible(false), style: "default" }
                                ]);
                            }
                        } catch (error) {
                            console.error("Delete supervisor error:", error);
                            showModal("Error", "Unable to connect to server", "error", [
                                { text: "OK", onPress: () => setModalVisible(false), style: "default" }
                            ]);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handlePasswordReset = async () => {
        if (!adminPassword.trim()) {
            Alert.alert("Error", "Please enter your admin password.");
            return;
        }

        const showGeneratedPassword = (temporaryPassword: string) => {
            setGeneratedTempPassword(temporaryPassword);
            setAdminPassword("");
            setAdminPasswordModalVisible(false);
            setTempPasswordModalVisible(true);
        };

        const submitReset = async (verificationToken: string, confirmReplace = false) => {
            const resetRes = await api.post(`/admin/users/${id}/reset-password`, {
                verificationToken,
                role: 'supervisor',
                confirmReplace
            });
            const resetData = await resetRes.json();

            if (resetRes.ok) {
                showGeneratedPassword(resetData.temporaryPassword);
                return;
            }

            if (resetRes.status === 409 && resetData.code === 'TEMP_PASSWORD_ACTIVE' && !confirmReplace) {
                const expiryText = resetData.expiresAt
                    ? ` It expires at ${new Date(resetData.expiresAt).toLocaleString()}.`
                    : "";

                Alert.alert(
                    "Temporary Password Already Active",
                    `A temporary password already exists for this supervisor.${expiryText} Generating a new one will invalidate the old temporary password.`,
                    [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Generate New",
                            style: "destructive",
                            onPress: async () => {
                                setIsVerifyingAdmin(true);
                                try {
                                    await submitReset(verificationToken, true);
                                } catch (error) {
                                    console.error("Password reset error:", error);
                                    Alert.alert("Error", "Unable to connect to server.");
                                } finally {
                                    setIsVerifyingAdmin(false);
                                }
                            }
                        }
                    ]
                );
                return;
            }

            Alert.alert("Reset Failed", resetData.error || "Failed to reset supervisor password.");
        };

        setIsVerifyingAdmin(true);
        try {
            // Step 1: Verify admin password
            const verifyRes = await api.post("/admin/verify-password", { password: adminPassword });
            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
                Alert.alert("Verification Failed", verifyData.error || "Invalid admin password.");
                setIsVerifyingAdmin(false);
                return;
            }

            const { verificationToken } = verifyData;

            // Step 2: Reset supervisor password
            await submitReset(verificationToken);
        } catch (error) {
            console.error("Password reset error:", error);
            Alert.alert("Error", "Unable to connect to server.");
        } finally {
            setIsVerifyingAdmin(false);
        }
    };

    const handleCopyPassword = () => {
        Clipboard.setString(generatedTempPassword);
        Alert.alert("Copied", "Temporary password copied to clipboard!");
    };

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
                    <Text style={local.title}>Edit Supervisor</Text>
                </View>

                <View style={local.formContainer}>
                    <Text style={local.sectionTitle}>Account Details</Text>

                    <View style={local.inputGroup}>
                        <Text style={local.label}>Full Name</Text>
                        <View style={local.inputContainer}>
                            <Ionicons name="person-outline" size={20} color={isDark ? "#aaa" : "#666"} style={local.inputIcon} />
                            <TextInput
                                style={local.input}
                                placeholder="Ex: John Doe"
                                placeholderTextColor={isDark ? "#888" : "#999"}
                                onChangeText={setName}
                                value={name}
                            />
                        </View>
                    </View>

                    <View style={local.inputGroup}>
                        <Text style={local.label}>Username / Phone</Text>
                        <View style={local.inputContainer}>
                            <Ionicons name="call-outline" size={20} color={isDark ? "#aaa" : "#666"} style={local.inputIcon} />
                            <TextInput
                                style={local.input}
                                placeholder="10 digit number"
                                placeholderTextColor={isDark ? "#888" : "#999"}
                                onChangeText={setPhone}
                                value={phone}
                                keyboardType="phone-pad"
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[local.submitButton, loading && local.disabledButton]}
                        onPress={handleUpdate}
                        disabled={loading}
                    >
                        <Text style={local.submitButtonText}>
                            {loading ? "Updating..." : "Save Changes"}
                        </Text>
                    </TouchableOpacity>

                    {/* Password reset */}
                    <View style={{ marginTop: 15 }}>
                        <TouchableOpacity
                            style={local.resetButton}
                            onPress={() => setAdminPasswordModalVisible(true)}
                        >
                            <Ionicons name="key-outline" size={18} color="#0a84ff" style={{ marginRight: 6 }} />
                            <Text style={local.resetButtonText}>Generate Temporary Password</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[local.deleteButton, loading && local.disabledButton]}
                        onPress={handleDelete}
                        disabled={loading}
                    >
                        <Ionicons name="trash-outline" size={20} color="#ff3b30" style={local.deleteIcon} />
                        <Text style={local.deleteButtonText}>Delete Supervisor</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <CustomModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                title={modalConfig.title}
                message={modalConfig.message}
                type={modalConfig.type}
                actions={modalConfig.actions}
            />

            {/* Admin Password verification Modal */}
            <CustomModal
                visible={adminPasswordModalVisible}
                onClose={() => {
                    setAdminPasswordModalVisible(false);
                    setAdminPassword("");
                }}
                title="Enter Admin Password"
                message="Please verify your admin password to perform this secure reset operation."
                actions={[
                    {
                        text: "Cancel",
                        onPress: () => {
                            setAdminPasswordModalVisible(false);
                            setAdminPassword("");
                        },
                        style: "cancel"
                    },
                    {
                        text: isVerifyingAdmin ? "Verifying..." : "Verify & Reset",
                        onPress: handlePasswordReset,
                        style: "default"
                    }
                ]}
            >
                <View style={{ width: "100%", marginTop: 10 }}>
                    <TextInput
                        style={{
                            height: 50,
                            backgroundColor: isDark ? "#2a2a2a" : "#f5f6fa",
                            borderColor: isDark ? "#444" : "#e1e1e1",
                            borderWidth: 1,
                            borderRadius: 12,
                            paddingHorizontal: 15,
                            fontSize: 16,
                            color: isDark ? "#fff" : "#2d3436"
                        }}
                        placeholder="Admin password"
                        placeholderTextColor={isDark ? "#888" : "#999"}
                        secureTextEntry
                        value={adminPassword}
                        onChangeText={setAdminPassword}
                    />
                </View>
            </CustomModal>

            {/* Temporary Password Display Modal */}
            <CustomModal
                visible={tempPasswordModalVisible}
                onClose={() => {
                    setTempPasswordModalVisible(false);
                    setGeneratedTempPassword("");
                }}
                title="Temporary Password Generated"
                type="success"
                actions={[
                    {
                        text: "Done",
                        onPress: () => {
                            setTempPasswordModalVisible(false);
                            setGeneratedTempPassword("");
                        },
                        style: "default"
                    }
                ]}
            >
                <View style={{ width: "100%", alignItems: "center", marginTop: 10 }}>
                    <Text style={{
                        color: "#ff3b30",
                        fontWeight: "700",
                        fontSize: 14,
                        textAlign: "center",
                        marginBottom: 15
                    }}>
                        Share this temporary password now. It expires in 24 hours and cannot be viewed again.
                    </Text>

                    <View style={{
                        backgroundColor: isDark ? "#2a2a2a" : "#f5f6fa",
                        paddingVertical: 15,
                        paddingHorizontal: 25,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isDark ? "#444" : "#e1e1e1",
                        width: "100%",
                        alignItems: "center",
                        marginBottom: 15,
                    }}>
                        <Text style={{
                            fontSize: 22,
                            fontWeight: "bold",
                            color: isDark ? "#fff" : "#2d3436",
                            letterSpacing: 1.5,
                        }}>
                            {generatedTempPassword}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={{
                            flexDirection: "row",
                            backgroundColor: "#0a84ff",
                            borderRadius: 8,
                            paddingVertical: 10,
                            paddingHorizontal: 15,
                            alignItems: "center"
                        }}
                        onPress={handleCopyPassword}
                    >
                        <Ionicons name="copy-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={{ color: "#fff", fontWeight: "600" }}>Copy Password</Text>
                    </TouchableOpacity>
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
    scrollContent: {
        flexGrow: 1,
        padding: 20,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 30,
        marginTop: 10,
    },
    backButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        marginRight: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    title: {
        fontSize: 24,
        fontWeight: "700",
        color: isDark ? "#fff" : "#2d3436",
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: isDark ? "#aaa" : "#636e72",
        marginBottom: 20,
        textTransform: "uppercase",
        letterSpacing: 0.5,
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
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: isDark ? "#ccc" : "#2d3436",
        marginBottom: 8,
        marginLeft: 4,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: isDark ? "#2a2a2a" : "#f5f6fa",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isDark ? "#444" : "#e1e1e1",
        paddingHorizontal: 15,
        height: 50,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: isDark ? "#fff" : "#2d3436",
        height: "100%",
    },
    submitButton: {
        backgroundColor: "#0a84ff",
        borderRadius: 12,
        height: 55,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 10,
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
    submitButtonText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
    },
    resetButton: {
        flexDirection: "row",
        backgroundColor: isDark ? "#172d42" : "#e3f2fd",
        borderRadius: 12,
        height: 55,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: isDark ? "#1d4469" : "#bbdefb",
    },
    resetButtonText: {
        color: "#0a84ff",
        fontSize: 15,
        fontWeight: "600",
    },
    deleteButton: {
        flexDirection: "row",
        backgroundColor: isDark ? "#2a1a1a" : "#ffeaea",
        borderRadius: 12,
        height: 55,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 15,
        borderWidth: 1,
        borderColor: isDark ? "#3a1a1a" : "#ffc2c2",
    },
    deleteIcon: {
        marginRight: 8,
    },
    deleteButtonText: {
        color: "#ff3b30",
        fontSize: 16,
        fontWeight: "600",
    },
});
