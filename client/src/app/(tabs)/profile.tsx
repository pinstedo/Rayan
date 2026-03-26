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
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />}
      >
        {/* Profile Header Block */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            {userProfileImage ? (
              <Image source={{ uri: userProfileImage }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{userName}</Text>
            <Text style={styles.contactText}>{userPhone}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{userRole}</Text>
            </View>
          </View>
        </View>

        {/* Account Menu */}
        <Text style={styles.sectionTitle}>Account Settings</Text>
        <View style={styles.menuCard}>
          <Pressable style={styles.menuItem} onPress={openEditModal}>
            <View style={[styles.menuIconBg, { backgroundColor: isDark ? "#1E293B" : "#EFF6FF" }]}>
              <MaterialIcons name="person" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.menuText}>Edit Profile</Text>
            <MaterialIcons name="chevron-right" size={24} color={isDark ? "#64748B" : "#94A3B8"} />
          </Pressable>
          <View style={styles.divider} />
          
          {(userRole.toLowerCase() === 'admin' || userRole.toLowerCase() === 'supervisor') && (
            <Pressable style={styles.menuItem} onPress={() => setIsPasswordModalVisible(true)}>
              <View style={[styles.menuIconBg, { backgroundColor: isDark ? "#1E293B" : "#FFF4ED" }]}>
                <MaterialIcons name="lock" size={20} color="#F97316" />
              </View>
              <Text style={styles.menuText}>Change Password</Text>
              <MaterialIcons name="chevron-right" size={24} color={isDark ? "#64748B" : "#94A3B8"} />
            </Pressable>
          )}
        </View>

        {/* Preferences Menu */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.menuCard}>
          <View style={styles.menuItem}>
            <View style={[styles.menuIconBg, { backgroundColor: isDark ? "#1E293B" : "#F5F3FF" }]}>
              <MaterialIcons name={isDark ? "dark-mode" : "light-mode"} size={20} color="#8B5CF6" />
            </View>
            <Text style={styles.menuText}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: "#CBD5E1", true: "#3B82F6" }}
              thumbColor={isDark ? "#FFFFFF" : "#F8FAFC"}
            />
          </View>
        </View>

        {/* System Data Menu */}
        <Text style={styles.sectionTitle}>System & Actions</Text>
        <View style={styles.menuCard}>
          {userRole.toLowerCase() === 'admin' && (
            <>
              <Pressable style={styles.menuItem} onPress={handleClearDatabase} disabled={isClearingDatabase}>
                <View style={[styles.menuIconBg, { backgroundColor: isDark ? "#331515" : "#FEF2F2" }]}>
                  {isClearingDatabase ? <ActivityIndicator size="small" color="#EF4444" /> : <MaterialIcons name="delete-forever" size={20} color="#EF4444" />}
                </View>
                <Text style={[styles.menuText, { color: "#EF4444" }]}>Clear Application Data</Text>
              </Pressable>
              <View style={styles.divider} />
            </>
          )}

          <Pressable style={styles.menuItem} onPress={handleLogout}>
            <View style={[styles.menuIconBg, { backgroundColor: isDark ? "#331515" : "#FEF2F2" }]}>
              <MaterialIcons name="logout" size={20} color="#EF4444" />
            </View>
            <Text style={[styles.menuText, { color: "#EF4444" }]}>Logout</Text>
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
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
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
    marginLeft: 72, // Aligned with text
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
