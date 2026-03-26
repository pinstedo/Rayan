import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
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
import { styles as globalStyles } from "../style/stylesheet";

export default function AddSite() {
    const router = useRouter();
    const { isDark } = useTheme();
    const local = getStyles(isDark);

    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);

    const onSubmit = async () => {
        if (!name.trim()) {
            Alert.alert("Validation", "Please enter the site name.");
            return;
        }

        setLoading(true);
        try {
            const payload = { name, address, description };
            const response = await api.post("/sites", payload);

            if (response.ok) {
                if (Platform.OS === 'web') {
                    window.alert("Site added successfully.");
                } else {
                    Alert.alert("Success", "Site added successfully.");
                }
                router.back();
            } else {
                const errorData = await response.json();
                Alert.alert("Error", errorData.error || "Failed to add site");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to connect to server");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={local.container}>
            <View style={local.header}>
                <Text style={[globalStyles.head1, { color: isDark ? "#fff" : "#000" }]}>Add Site</Text>
                <Text style={local.sub}>Enter site details below</Text>
            </View>

            <View style={local.form}>
                <Text style={local.label}>Site Name *</Text>
                <TextInput
                    style={local.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g., Construction Site A"
                    placeholderTextColor={isDark ? "#888" : "#999"}
                />

                <Text style={local.label}>Address</Text>
                <TextInput
                    style={local.input}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Site address or location"
                    placeholderTextColor={isDark ? "#888" : "#999"}
                />

                <Text style={local.label}>Description</Text>
                <TextInput
                    style={[local.input, { height: 90 }]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Optional description or notes"
                    placeholderTextColor={isDark ? "#888" : "#999"}
                    multiline
                />

                <TouchableOpacity style={local.cancelBtn} onPress={() => router.back()}>
                    <Text style={local.cancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[local.submitBtn, loading && { opacity: 0.7 }]} 
                    onPress={onSubmit}
                    disabled={loading}
                >
                    <Text style={local.submitText}>
                        {loading ? "Adding..." : "Add Site"}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: {
        padding: 20,
        paddingTop: 40,
        minHeight: "100%",
        backgroundColor: isDark ? "#121212" : "#fff",
    },
    header: {
        alignItems: "center",
        marginBottom: 20,
    },
    sub: {
        color: isDark ? "#aaa" : "#666",
        marginTop: 6,
        fontSize: 16,
    },
    form: {
        marginTop: 6,
    },
    label: {
        marginTop: 12,
        marginBottom: 6,
        color: isDark ? "#ccc" : "#333",
        fontWeight: "500",
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
    cancelBtn: {
        marginTop: 18,
        backgroundColor: isDark ? "#333" : "#ddd",
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
    },
    cancelText: {
        color: isDark ? "#fff" : "#333",
        fontWeight: "700",
    },
    submitBtn: {
        marginTop: 12,
        backgroundColor: "#0a84ff",
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
    },
    submitText: {
        color: "#fff",
        fontWeight: "700",
    },
});
