import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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
  View
} from "react-native";
import { API_URL } from "../../constants";
import { useTheme } from "../../context/ThemeContext";

export default function CreateNewPasswordScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const styles = getStyles(isDark);
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      Alert.alert("Validation", "Please enter the temporary password you were given.");
      return;
    }
    if (!newPassword.trim()) {
      Alert.alert("Validation", "Please enter your new password.");
      return;
    }
    if (newPassword.length < 10) {
      Alert.alert("Validation", "New password must be at least 10 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Validation", "New passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        // Clear session and force login with new password
        await AsyncStorage.multiRemove(["token", "refreshToken", "userData"]);
        Alert.alert(
          "Success",
          "Password updated successfully! Please sign in with your new password.",
          [{ text: "OK", onPress: () => router.replace("/auth/verificationau" as any) }]
        );
      } else {
        Alert.alert("Failed to change password", data.error || "Please check your temporary password.");
      }
    } catch (error) {
      console.error("Change password error:", error);
      Alert.alert("Error", "Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(["token", "refreshToken", "userData"]);
    router.replace("/auth/verificationau" as any);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      enabled={Platform.OS !== "web"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Create New Password</Text>
          <Text style={styles.subtitle}>You must update your temporary password to continue</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Temporary Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter temporary password"
              placeholderTextColor={isDark ? "#888" : "#A0AEC0"}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Min 10 characters"
              placeholderTextColor={isDark ? "#888" : "#A0AEC0"}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Repeat new password"
              placeholderTextColor={isDark ? "#888" : "#A0AEC0"}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
            onPress={handleChangePassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Update Password</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleLogout}
          >
            <Text style={styles.cancelButtonText}>Cancel & Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: isDark ? "#121212" : "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: "center",
  },
  headerContainer: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: isDark ? "#fff" : "#1A202C",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: isDark ? "#ff5252" : "#E53E3E",
    fontWeight: "600",
  },
  formContainer: {
    width: "100%",
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: isDark ? "#bbb" : "#4A5568",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    height: 56,
    backgroundColor: isDark ? "#1e1e1e" : "#F7FAFC",
    borderWidth: 1,
    borderColor: isDark ? "#333" : "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: isDark ? "#fff" : "#1A202C",
  },
  primaryButton: {
    height: 56,
    backgroundColor: "#3182CE",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#3182CE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.5 : 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: isDark ? "#2c5282" : "#90CDF4",
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cancelButton: {
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15,
    borderWidth: 1,
    borderColor: isDark ? "#444" : "#E2E8F0",
    borderRadius: 12,
  },
  cancelButtonText: {
    color: isDark ? "#aaa" : "#718096",
    fontSize: 16,
    fontWeight: "600",
  },
});
