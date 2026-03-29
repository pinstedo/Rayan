import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
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

export default function SignInScreen() {
	const { isDark } = useTheme();
	const styles = getStyles(isDark);
	const [phone, setPhone] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSignIn = async () => {
		if (!phone.trim()) {
			Alert.alert("Validation", "Please enter your phone number.");
			return;
		}
		if (!password.trim()) {
			Alert.alert("Validation", "Please enter your password.");
			return;
		}
		if (phone.trim().length < 10) {
			Alert.alert("Validation", "Phone number must be at least 10 digits.");
			return;
		}

		try {
			setLoading(true);
			const response = await fetch(`${API_URL}/auth/signin`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ phone, password }),
			});

			const data = await response.json();

			if (response.ok) {
				await AsyncStorage.setItem("userData", JSON.stringify(data.user));
				await AsyncStorage.setItem("token", String(data.accessToken));
				await AsyncStorage.setItem("refreshToken", String(data.refreshToken));

				if (data.user.role === 'admin') {
					router.replace("/(tabs)/home");
				} else if (data.user.role === 'supervisor') {
					router.replace("/supervisor/(tabs)/home");
				} else if (data.user.role === 'labour') {
					router.replace("/(labour)/dashboard");
				} else {
					router.replace("/(tabs)/home");
				}
			} else {
				Alert.alert("Sign In Failed", data.error || "Invalid credentials");
			}
		} catch (error) {
			console.error("Sign in error:", error);
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
					<Text style={styles.title}>Welcome Back</Text>
					<Text style={styles.subtitle}>Sign in to continue</Text>
				</View>

				<View style={styles.formContainer}>
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
						<View style={styles.passwordHeader}>
							<Text style={styles.label}>Password</Text>
							<TouchableOpacity>
								<Text style={styles.forgotPassword}>Forgot?</Text>
							</TouchableOpacity>
						</View>
						<TextInput
							style={styles.input}
							placeholder="Enter your password"
							placeholderTextColor={isDark ? "#888" : "#A0AEC0"}
							secureTextEntry
							value={password}
							onChangeText={setPassword}
						/>
					</View>

					<TouchableOpacity
						style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
						onPress={handleSignIn}
						disabled={loading}
					>
						{loading ? (
							<ActivityIndicator color="#fff" />
						) : (
							<Text style={styles.primaryButtonText}>Sign In</Text>
						)}
					</TouchableOpacity>
				</View>

				<View style={styles.footerContainer}>
					<Text style={styles.footerText}>Don't have an account? </Text>
					<TouchableOpacity onPress={() => router.push("/auth/authentication" as any)}>
						<Text style={styles.createAccountLink}>Create new account</Text>
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
		marginBottom: 24,
	},
	label: {
		fontSize: 14,
		fontWeight: "600",
		color: isDark ? "#bbb" : "#4A5568",
		marginBottom: 8,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	passwordHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 8,
	},
	forgotPassword: {
		fontSize: 14,
		color: isDark ? "#63b3ed" : "#3182CE",
		fontWeight: "600",
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
	createAccountLink: {
		fontSize: 15,
		color: isDark ? "#63b3ed" : "#3182CE",
		fontWeight: "700",
	},
});
