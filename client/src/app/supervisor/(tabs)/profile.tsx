import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../../constants";
import { useTheme } from "../../../context/ThemeContext";

export default function SupervisorProfile() {
    const router = useRouter();
    const { theme, toggleTheme, isDark } = useTheme();
    const [user, setUser] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async (isRefresh = false) => {
        try {
            const userData = await AsyncStorage.getItem("userData");
            if (userData) {
                setUser(JSON.parse(userData));
            }
        } catch (error) {
            console.error("Error loading user data:", error);
        } finally {
            if (isRefresh) setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadUser(true);
    };
    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert("Error", "New passwords do not match");
            return;
        }
        if (newPassword.length < 6) {
            Alert.alert("Validation", "New password must be at least 6 characters.");
            return;
        }

        try {
            setIsChangingPassword(true);
            const token = await AsyncStorage.getItem("token");

            const response = await fetch(`${API_URL}/auth/change-password`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            let data;
            const textResponse = await response.text();
            try {
                data = JSON.parse(textResponse);
            } catch (e) {
                console.error("Non-JSON response from server:", textResponse);
                Alert.alert("Server Error", "Received an unexpected response from the server. Please manually restart the backend server so it can load the new API endpoint.");
                setIsChangingPassword(false);
                return;
            }

            if (response.ok) {
                Alert.alert("Success", "Password changed successfully!");
                setIsPasswordModalVisible(false);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
            } else {
                Alert.alert("Error", data.error || "Failed to change password");
            }
        } catch (error) {
            console.error("Change password error:", error);
            Alert.alert("Error", "Unable to connect to server");
        } finally {
            setIsChangingPassword(false);
        }
    };
    const handleLogout = async () => {
        Alert.alert("Confirm Logout", "Are you sure you want to logout?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout",
                style: "destructive",
                onPress: async () => {
                    try {
                        const refreshToken = await AsyncStorage.getItem("refreshToken");
                        if (refreshToken) {
                            await fetch(`${API_URL}/auth/logout`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ refreshToken }),
                            });
                        }
                    } catch (error) {
                        console.error("Logout error:", error);
                    } finally {
                        await AsyncStorage.clear();
                        router.replace("/auth/authentication2" as any);
                    }
                },
            },
        ]);
    };

    const localStyles = getStyles(isDark);
    const userRole = user?.role || "Supervisor";

    return (
        <SafeAreaView style={localStyles.container}>
            <View style={localStyles.header}>
                <Text style={localStyles.title}>Settings</Text>
            </View>

            <ScrollView
                contentContainerStyle={localStyles.body}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />}
            >
                {/* Profile Header Block */}
                <View style={localStyles.profileHeader}>
                    <View style={localStyles.avatar}>
                        <Text style={localStyles.avatarText}>
                            {user?.name ? user.name.charAt(0).toUpperCase() : "S"}
                        </Text>
                    </View>
                    <View style={localStyles.profileInfo}>
                        <Text style={localStyles.name}>{user?.name || "Supervisor"}</Text>
                        <Text style={localStyles.contactText}>{user?.phone || ""}</Text>
                        <View style={localStyles.roleBadge}>
                            <Text style={localStyles.roleBadgeText}>{userRole}</Text>
                        </View>
                    </View>
                </View>

                {/* Account Menu */}
                <Text style={localStyles.sectionTitle}>Account Settings</Text>
                <View style={localStyles.menuCard}>
                    <Pressable style={localStyles.menuItem} onPress={() => setIsPasswordModalVisible(true)}>
                        <View style={[localStyles.menuIconBg, { backgroundColor: isDark ? "#1E293B" : "#FFF4ED" }]}>
                            <MaterialIcons name="lock" size={20} color="#F97316" />
                        </View>
                        <Text style={localStyles.menuText}>Change Password</Text>
                        <MaterialIcons name="chevron-right" size={24} color={isDark ? "#64748B" : "#94A3B8"} />
                    </Pressable>
                </View>

                {/* Preferences Menu */}
                <Text style={localStyles.sectionTitle}>Preferences</Text>
                <View style={localStyles.menuCard}>
                    <View style={localStyles.menuItem}>
                        <View style={[localStyles.menuIconBg, { backgroundColor: isDark ? "#1E293B" : "#F5F3FF" }]}>
                            <MaterialIcons name={isDark ? "dark-mode" : "light-mode"} size={20} color="#8B5CF6" />
                        </View>
                        <Text style={localStyles.menuText}>Dark Mode</Text>
                        <Switch
                            value={isDark}
                            onValueChange={toggleTheme}
                            trackColor={{ false: "#CBD5E1", true: "#3B82F6" }}
                            thumbColor={isDark ? "#FFFFFF" : "#F8FAFC"}
                        />
                    </View>
                </View>

                {/* System & Actions Menu */}
                <Text style={localStyles.sectionTitle}>System & Actions</Text>
                <View style={localStyles.menuCard}>
                    <Pressable style={localStyles.menuItem} onPress={handleLogout}>
                        <View style={[localStyles.menuIconBg, { backgroundColor: isDark ? "#331515" : "#FEF2F2" }]}>
                            <MaterialIcons name="logout" size={20} color="#EF4444" />
                        </View>
                        <Text style={[localStyles.menuText, { color: "#EF4444" }]}>Logout</Text>
                    </Pressable>
                </View>

                {/* Change Password Modal */}
                <Modal
                    visible={isPasswordModalVisible}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setIsPasswordModalVisible(false)}
                >
                    <View style={localStyles.modalOverlay}>
                        <View style={localStyles.modalContent}>
                            <View style={localStyles.modalHeader}>
                                <Text style={localStyles.modalTitle}>Change Password</Text>
                                <Pressable onPress={() => setIsPasswordModalVisible(false)}>
                                    <Text style={localStyles.closeText}>Cancel</Text>
                                </Pressable>
                            </View>

                            <View style={localStyles.inputGroup}>
                                <Text style={localStyles.label}>Current Password</Text>
                                <TextInput
                                    style={[localStyles.input, { color: isDark ? "#fff" : "#000" }]}
                                    placeholder="Enter current password"
                                    placeholderTextColor={isDark ? "#888" : "#999"}
                                    secureTextEntry
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                />
                            </View>

                            <View style={localStyles.inputGroup}>
                                <Text style={localStyles.label}>New Password</Text>
                                <TextInput
                                    style={[localStyles.input, { color: isDark ? "#fff" : "#000" }]}
                                    placeholder="Enter new password"
                                    placeholderTextColor={isDark ? "#888" : "#999"}
                                    secureTextEntry
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                />
                            </View>

                            <View style={localStyles.inputGroup}>
                                <Text style={localStyles.label}>Confirm New Password</Text>
                                <TextInput
                                    style={[localStyles.input, { color: isDark ? "#fff" : "#000" }]}
                                    placeholder="Confirm new password"
                                    placeholderTextColor={isDark ? "#888" : "#999"}
                                    secureTextEntry
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                />
                            </View>

                            <TouchableOpacity
                                style={localStyles.saveBtn}
                                onPress={handleChangePassword}
                                disabled={isChangingPassword}
                            >
                                {isChangingPassword ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={localStyles.saveBtnText}>Save Password</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        </SafeAreaView>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: isDark ? "#0F172A" : "#F8FAFC"
    },
    header: {
        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingTop: 64, // App safe area padding top
        paddingBottom: 20,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.3 : 0.05,
        shadowRadius: 12,
        elevation: 8,
        marginBottom: 16,
    },
    title: {
        fontSize: 32,
        fontWeight: "800",
        color: isDark ? "#F1F5F9" : "#0F172A"
    },
    body: {
        padding: 20,
        paddingBottom: 40
    },
    profileHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 32,
        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
        padding: 20,
        borderRadius: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.2 : 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: isDark ? "#0F172A" : "#EFF6FF",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderWidth: 2,
        borderColor: isDark ? "#334155" : "#E2E8F0",
    },
    avatarText: {
        color: "#3B82F6",
        fontSize: 28,
        fontWeight: "700"
    },
    profileInfo: {
        marginLeft: 16,
        flex: 1,
    },
    name: {
        fontSize: 22,
        fontWeight: "800",
        color: isDark ? "#F1F5F9" : "#0F172A",
    },
    contactText: {
        fontSize: 14,
        color: isDark ? "#94A3B8" : "#64748B",
        marginTop: 4,
    },
    roleBadge: {
        marginTop: 8,
        backgroundColor: "rgba(59, 130, 246, 0.15)",
        alignSelf: "flex-start",
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    roleBadgeText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#3B82F6",
        textTransform: "uppercase",
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: isDark ? "#64748B" : "#94A3B8",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 8,
        marginLeft: 12,
    },
    menuCard: {
        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
        borderRadius: 20,
        marginBottom: 28,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.2 : 0.03,
        shadowRadius: 8,
        elevation: 2,
        overflow: "hidden",
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    menuIconBg: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16,
    },
    menuText: {
        flex: 1,
        fontSize: 16,
        fontWeight: "600",
        color: isDark ? "#F1F5F9" : "#1E293B",
    },
    divider: {
        height: 1,
        backgroundColor: isDark ? "#334155" : "#F1F5F9",
        marginLeft: 72,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    modalContent: {
        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
        borderRadius: 28,
        padding: 28,
        width: "100%",
        maxWidth: 400,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: "800",
        color: isDark ? "#F1F5F9" : "#0F172A"
    },
    closeText: {
        color: "#3B82F6",
        fontWeight: "600",
    },
    inputGroup: {
        marginBottom: 20
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: isDark ? "#94A3B8" : "#64748B",
        marginBottom: 8
    },
    input: {
        borderWidth: 1,
        borderColor: isDark ? "#334155" : "#E2E8F0",
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
        color: isDark ? "#F1F5F9" : "#0F172A",
    },
    saveBtn: {
        backgroundColor: "#3B82F6",
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: "center",
        marginTop: 12,
    },
    saveBtnText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 16
    },
});
