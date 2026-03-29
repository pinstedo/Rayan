import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

export default function AddSupervisorScreen() {
    const router = useRouter();
    const { isDark } = useTheme();
    const local = getStyles(isDark);

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleAddSupervisor = async () => {
        if (!name.trim()) {
            Alert.alert("Validation Error", "Please enter the supervisor's name.");
            return;
        }
        if (!phone.trim()) {
            Alert.alert("Validation Error", "Please enter the phone number.");
            return;
        }
        if (phone.trim().length < 10) {
            Alert.alert("Validation Error", "Phone number must be at least 10 digits.");
            return;
        }
        if (!password.trim()) {
            Alert.alert("Validation Error", "Please enter a password.");
            return;
        }
        if (password.trim().length < 6) {
            Alert.alert("Validation Error", "Password must be at least 6 characters.");
            return;
        }

        setLoading(true);
        try {
            const response = await api.post("/auth/add-supervisor", {
                name,
                phone,
                password,
            });

            const data = await response.json();

            if (response.ok) {
                if (Platform.OS === 'web') {
                    window.alert("Supervisor added successfully!");
                } else {
                    Alert.alert("Success", "Supervisor added successfully!");
                }
                router.back();
            } else {
                Alert.alert("Error", data.error || "Failed to add supervisor");
            }
        } catch (error) {
            console.error("Add supervisor error:", error);
            Alert.alert("Error", "Unable to connect to server");
        } finally {
            setLoading(false);
        }
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
                    <Text style={local.title}>Add Supervisor</Text>
                </View>

                <View style={local.formContainer}>
                    <Text style={local.sectionTitle}>New Account Details</Text>

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
                        <Text style={local.label}>Phone Number</Text>
                        <View style={local.inputContainer}>
                            <Ionicons name="call-outline" size={20} color={isDark ? "#aaa" : "#666"} style={local.inputIcon} />
                            <TextInput
                                style={local.input}
                                placeholder="10 digit number"
                                placeholderTextColor={isDark ? "#888" : "#999"}
                                onChangeText={setPhone}
                                value={phone}
                                keyboardType="phone-pad"
                                maxLength={15}
                            />
                        </View>
                    </View>

                    <View style={local.inputGroup}>
                        <Text style={local.label}>Password</Text>
                        <View style={local.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color={isDark ? "#aaa" : "#666"} style={local.inputIcon} />
                            <TextInput
                                style={local.input}
                                placeholder="Min 6 characters"
                                placeholderTextColor={isDark ? "#888" : "#999"}
                                onChangeText={setPassword}
                                value={password}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={local.eyeIcon}
                            >
                                <Ionicons
                                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                                    size={20}
                                    color={isDark ? "#aaa" : "#666"}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[local.submitButton, loading && local.disabledButton]}
                        onPress={handleAddSupervisor}
                        disabled={loading}
                    >
                        <Text style={local.submitButtonText}>
                            {loading ? "Creating..." : "Create Account"}
                        </Text>
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
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: isDark ? "#fff" : "#2d3436",
        height: "100%",
    },
    eyeIcon: {
        padding: 8,
    },
    submitButton: {
        backgroundColor: "#eb8934",
        borderRadius: 12,
        height: 55,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 10,
        shadowColor: "#eb8934",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledButton: {
        backgroundColor: "#fab1a0",
        shadowOpacity: 0,
    },
    submitButtonText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
    },
});
