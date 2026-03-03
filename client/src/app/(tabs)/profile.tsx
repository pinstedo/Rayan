import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { API_URL } from "../../constants";
import { useTheme } from "../../context/ThemeContext";

export default function Profile() {
  const router = useRouter();
  const { theme, toggleTheme, isDark } = useTheme();
  const styles = getStyles(isDark);

  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Profile States
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editProfileImage, setEditProfileImage] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Change Password States
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Clear Database States
  const [isClearingDatabase, setIsClearingDatabase] = useState(false);

  const fetchUser = async (isRefresh = false) => {
    try {
      const userData = await AsyncStorage.getItem("userData");
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error("Failed to load user data", error);
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUser();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchUser(true);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();
      router.replace("/auth/authentication");
    } catch (error) {
      console.error("Failed to logout", error);
    }
  };

  const openEditModal = () => {
    setEditName(user?.name || "");
    setEditProfileImage(user?.profile_image || null);
    setIsEditModalVisible(true);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const b64 = `data:${result.assets[0].mimeType || 'image/jpeg'};base64,${result.assets[0].base64}`;
      setEditProfileImage(b64);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert("Validation", "Name cannot be empty");
      return;
    }

    try {
      setIsSavingProfile(true);
      const token = await AsyncStorage.getItem("token");

      const response = await fetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: editName, profile_image: editProfileImage }),
      });

      const data = await response.json();

      if (response.ok && data.user) {
        await AsyncStorage.setItem("userData", JSON.stringify(data.user));
        setUser(data.user);
        setIsEditModalVisible(false);
        Alert.alert("Success", "Profile updated successfully!");
      } else {
        Alert.alert("Error", data.error || "Failed to update profile");
      }
    } catch (error) {
      console.error("Save profile error:", error);
      Alert.alert("Error", "Unable to connect to server");
    } finally {
      setIsSavingProfile(false);
    }
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

  const handleClearDatabase = () => {
    Alert.alert(
      "Clear Database",
      "Are you sure you want to clear the entire database? This action cannot be undone and will delete all labours, sites, attendances, and supervisors.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear System Data",
          style: "destructive",
          onPress: async () => {
            try {
              setIsClearingDatabase(true);
              const token = await AsyncStorage.getItem("token");
              const response = await fetch(`${API_URL}/auth/clear-database`, {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              const data = await response.json();
              if (response.ok) {
                Alert.alert("Success", "Database cleared successfully!");
              } else {
                Alert.alert("Error", data.error || "Failed to clear database");
              }
            } catch (error) {
              console.error("Clear database error:", error);
              Alert.alert("Error", "Unable to connect to server");
            } finally {
              setIsClearingDatabase(false);
            }
          },
        },
      ]
    );
  };

  const userName = user?.name || "User";
  const userPhone = user?.phone || "";
  const userRole = user?.role || "User";
  const userProfileImage = user?.profile_image;

  const initials = userName
    ? userName
      .split(" ")
      .map((s: string) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
    : "";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Pressable style={styles.editHeaderBtn} onPress={openEditModal}>
          <Text style={styles.editHeaderText}>Edit Profile</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />
        }
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            {userProfileImage ? (
              <Image source={{ uri: userProfileImage }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <Text style={styles.name}>{userName}</Text>
          <Text style={styles.role}>{userRole}</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone Number</Text>
            <Text style={styles.infoValue}>{userPhone}</Text>
          </View>

          <View style={[styles.themeRow, styles.infoRowLast]}>
            <Text style={styles.themeLabel}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: "#CBD5E1", true: "#3B82F6" }}
              thumbColor={isDark ? "#FFFFFF" : "#F8FAFC"}
            />
          </View>
        </View>

        <View style={styles.actions}>
          {(userRole.toLowerCase() === 'admin' || userRole.toLowerCase() === 'supervisor') && (
            <Pressable style={styles.actionBtn} onPress={() => setIsPasswordModalVisible(true)}>
              <Text style={styles.actionText}>Change Password</Text>
            </Pressable>
          )}

          {userRole.toLowerCase() === 'admin' && (
            <Pressable
              style={[styles.actionBtn, styles.clearDbBtn]}
              onPress={handleClearDatabase}
              disabled={isClearingDatabase}
            >
              {isClearingDatabase ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.clearDbText}>Clear Application Data</Text>
              )}
            </Pressable>
          )}

          <Pressable
            style={[styles.actionBtn, styles.logoutBtn]}
            onPress={handleLogout}
          >
            <Text style={[styles.actionText, styles.logoutText]}>Logout</Text>
          </Pressable>
        </View>

        {/* Edit Profile Modal */}
        <Modal
          visible={isEditModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsEditModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <Pressable onPress={() => setIsEditModalVisible(false)} style={styles.closeBtn}>
                  <MaterialIcons name="close" size={20} color={isDark ? "#94A3B8" : "#64748B"} />
                </Pressable>
              </View>

              <View style={styles.imagePickerContainer}>
                <Pressable onPress={pickImage} style={styles.pickerAvatar}>
                  {editProfileImage ? (
                    <Image source={{ uri: editProfileImage }} style={styles.avatarImage} />
                  ) : (
                    <Text style={[styles.avatarText, { fontSize: 32 }]}>{initials}</Text>
                  )}
                  <View style={styles.editOverlay}>
                    <Text style={styles.editOverlayText}>CHANGE</Text>
                  </View>
                </Pressable>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  value={editName}
                  onChangeText={setEditName}
                  autoCapitalize="words"
                />
              </View>

              <Pressable
                style={styles.saveBtn}
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Profile</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Change Password Modal */}
        <Modal
          visible={isPasswordModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsPasswordModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Change Password</Text>
                <Pressable onPress={() => setIsPasswordModalVisible(false)} style={styles.closeBtn}>
                  <MaterialIcons name="close" size={20} color={isDark ? "#94A3B8" : "#64748B"} />
                </Pressable>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Current Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter current password"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  secureTextEntry
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter new password"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm new password"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>

              <Pressable
                style={styles.saveBtn}
                onPress={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Password</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
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
  editHeaderBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: isDark ? "rgba(59, 130, 246, 0.15)" : "#EFF6FF",
    borderRadius: 20
  },
  editHeaderText: {
    color: "#3B82F6",
    fontWeight: "600",
    fontSize: 14
  },
  body: {
    padding: 20,
    paddingBottom: 40
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 28,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: isDark ? "#1E293B" : "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: isDark ? "#334155" : "#FFFFFF",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarText: {
    color: "#3B82F6",
    fontSize: 36,
    fontWeight: "700"
  },
  name: {
    fontSize: 24,
    fontWeight: "800",
    color: isDark ? "#F1F5F9" : "#0F172A",
    marginTop: 16
  },
  role: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3B82F6",
    marginTop: 6,
    textTransform: "uppercase",
    letterSpacing: 1.2
  },
  infoCard: {
    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.2 : 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? "#334155" : "#F1F5F9",
  },
  infoRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 4,
  },
  infoLabel: {
    color: isDark ? "#94A3B8" : "#64748B",
    fontSize: 15,
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: isDark ? "#F1F5F9" : "#1E293B",
  },
  themeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  themeLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: isDark ? "#F1F5F9" : "#1E293B",
  },
  actions: {
    gap: 12,
  },
  actionBtn: {
    paddingVertical: 16,
    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.2 : 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: isDark ? "#334155" : "#E2E8F0",
  },
  actionText: {
    color: isDark ? "#F1F5F9" : "#1E293B",
    fontWeight: "600",
    fontSize: 16
  },
  logoutBtn: {
    backgroundColor: isDark ? "rgba(239, 68, 68, 0.1)" : "#FEF2F2",
    borderColor: "rgba(239, 68, 68, 0.3)",
    shadowOpacity: 0,
    elevation: 0,
  },
  logoutText: {
    color: "#EF4444",
  },
  clearDbBtn: {
    backgroundColor: "#EF4444",
    borderColor: "#EF4444",
  },
  clearDbText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16
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
  closeBtn: {
    padding: 8,
    backgroundColor: isDark ? "#334155" : "#F1F5F9",
    borderRadius: 20,
  },
  imagePickerContainer: {
    alignItems: "center",
    marginBottom: 28,
  },
  pickerAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: isDark ? "#0F172A" : "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    borderWidth: 3,
    borderColor: isDark ? "#334155" : "#E2E8F0",
  },
  editOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    paddingVertical: 6,
    alignItems: "center",
  },
  editOverlayText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
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
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16
  },
});
