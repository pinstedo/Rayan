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
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";

export default function SupervisorDetailsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { isDark } = useTheme();
    const local = getStyles(isDark);

    const [id] = useState(params.id);
    const [name, setName] = useState(params.name as string || "");
    const [phone, setPhone] = useState(params.phone as string || "");



    const [loading, setLoading] = useState(false);

    const handleUpdate = async () => {
        if (!name.trim()) {
            Alert.alert("Validation Error", "Please enter the supervisor's name.");
            return;
        }
        if (!phone.trim()) {
            Alert.alert("Validation Error", "Please enter the phone number.");
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
                Alert.alert("Success", "Supervisor updated successfully!", [
                    { text: "OK", onPress: () => router.back() },
                ]);
            } else {
                Alert.alert("Error", data.error || "Failed to update supervisor");
            }
        } catch (error) {
            console.error("Update supervisor error:", error);
            Alert.alert("Error", "Unable to connect to server");
            setLoading(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            "Delete Supervisor",
            "Are you sure you want to delete this supervisor? Their access will be revoked immediately and they will be moved to the bin for 7 days.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const response = await api.delete(`/auth/supervisors/${id}`);
                            const data = await response.json();
                            if (response.ok) {
                                Alert.alert("Success", "Supervisor moved to bin successfully!", [
                                    { text: "OK", onPress: () => router.back() },
                                ]);
                            } else {
                                Alert.alert("Error", data.error || "Failed to delete supervisor");
                            }
                        } catch (error) {
                            console.error("Delete supervisor error:", error);
                            Alert.alert("Error", "Unable to connect to server");
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
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
                    <Text style={local.title}>Supervisor Details</Text>
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
    disabledInput: {
        backgroundColor: isDark ? "#1a1a1a" : "#eee",
        borderColor: isDark ? "#333" : "#ddd",
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
