import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Image, StatusBar, View } from "react-native";
import { API_URL } from "../constants";
import { getHomeRouteForRole } from "../utils/roles";
import { styles } from "./style/stylesheet";
import { useTheme } from "../context/ThemeContext";

export default function SplashScreen() {
	const router = useRouter();
	const { colors } = useTheme();

	useEffect(() => {
		const checkLogin = async () => {
			try {
				const token = await AsyncStorage.getItem("token");
				const refreshToken = await AsyncStorage.getItem("refreshToken");
				const userDataStr = await AsyncStorage.getItem("userData");

				if (token && userDataStr) {
					const user = JSON.parse(userDataStr);
					if (user && user.password_reset_required) {
						router.replace("/auth/create-new-password" as any);
						return;
					}
					// Ideally, we should verify the token with the backend here or check expiration
					// For now, we'll try to use the token. If it fails later, the user will be logged out.
					// However, strict security would require validation.
					// Let's implement a quick validity check or refresh if we can.

					// Simple check: if we have a token, go home.
					// Better: try to refresh if possible to ensure we have a fresh session.
					// Or just proceed and let the interceptors (if any) handle 401s.
					// Given the requirement is "signin last for 30 days", we rely on the refresh token.

					// Strategies:
					// 1. Just navigate to Home. If API calls fail with 401, handle logout there. (Simplest)
					// 2. Validate token/Refresh token here. (More robust)

					// Let's try to refresh the token if we have a refresh token, to ensure we are good for another session.
					if (refreshToken) {
						try {
							const response = await fetch(`${API_URL}/auth/refresh-token`, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ refreshToken })
							});

							if (response.ok) {
								const data = await response.json();
								await AsyncStorage.setItem("token", data.accessToken);
								await AsyncStorage.setItem("refreshToken", data.refreshToken);

								if (data.user) {
									await AsyncStorage.setItem("userData", JSON.stringify(data.user));
									if (data.user.password_reset_required) {
										router.replace("/auth/create-new-password" as any);
										return;
									}
								}

								const user = data.user || JSON.parse(userDataStr);
								router.replace(getHomeRouteForRole(user.role) as any);
								return;
							} else if (response.status === 401 || response.status === 403) {
								// Session explicitly revoked or expired
								console.warn("Session revoked during splash check, redirecting to login");
								await AsyncStorage.multiRemove(["token", "refreshToken", "userData"]);
								router.replace("/auth/verificationau" as any);
								return;
							}
						} catch (e) {
							console.log("Failed to refresh token (network issue), continuing with cached session", e);
						}
					}

					// Fallback: If network is offline or reconnecting, allow entry with cached credentials
					router.replace(getHomeRouteForRole(user.role) as any);
					return;
				}
			} catch (e) {
				console.error("Error checking login status", e);
			}

			// Default to login if checks fail
			router.replace("/auth/verificationau" as any);
		};

		// Minimal delay to show splash
		const t = setTimeout(() => {
			checkLogin();
		}, 2000);

		return () => clearTimeout(t);
	}, [router]);

	return (
		<View style={[styles.container, { padding: 0, backgroundColor: colors.background }]}>
			<StatusBar hidden />
			<Image
				style={[styles.image, { width: 250, height: 250 }]}
				source={require("../../assets/images/logo11.png")}
				resizeMode="contain"
			/>
			<ActivityIndicator size="large" color="#56565dff" style={{ marginTop: 20 }} />
		</View>
	);
}
