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

export default function SignUpScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const styles = getStyles(isDark);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Please enter your name.");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Validation", "Please enter your phone number.");
      return;
    }
    if (phone.trim().length < 10) {
      Alert.alert("Validation", "Phone number must be at least 10 digits.");
      return;
    }
    if (!password.trim()) {
      Alert.alert("Validation", "Please enter a password.");
      return;
    }
    if (password.trim().length < 6) {
      Alert.alert("Validation", "Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.pending) {
          Alert.alert(
            "Approval Required",
            "Your admin account request has been sent to existing administrators for approval. You will be able to log in once they grant you access.",
            [{ text: "OK", onPress: () => router.push("/auth/authentication2" as any) }]
          );
        } else {
          await AsyncStorage.setItem("userData", JSON.stringify(data.user));
          await AsyncStorage.setItem("token", data.accessToken);
          await AsyncStorage.setItem("refreshToken", data.refreshToken);

          Alert.alert("Success", "Account created successfully!", [
            { text: "OK", onPress: () => router.replace("/(tabs)/home") },
          ]);
        }
      } else {
        Alert.alert("Sign Up Failed", data.error || "Failed to create account");
      }
    } catch (error) {
      console.error("Sign up error:", error);
      Alert.alert("Error", "Unable to connect to server");
    } finally {
      setLoading(false);
    }
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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor={isDark ? "#888" : "#A0AEC0"}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 10-digit phone number"
              placeholderTextColor={isDark ? "#888" : "#A0AEC0"}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Create a strong password"
              placeholderTextColor={isDark ? "#888" : "#A0AEC0"}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push("/auth/authentication2" as any)}>
            <Text style={styles.signInLink}>Sign In</Text>
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
    fontSize: 32,
    fontWeight: "800",
    color: isDark ? "#fff" : "#1A202C",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: isDark ? "#aaa" : "#718096",
    fontWeight: "400",
  },
  formContainer: {
    width: "100%",
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
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
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
  },
  footerText: {
    fontSize: 15,
    color: isDark ? "#aaa" : "#718096",
  },
  signInLink: {
    fontSize: 15,
    color: isDark ? "#63b3ed" : "#3182CE",
    fontWeight: "700",
  },
});
