import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter } from "expo-router";
import Head from "expo-router/head";
import React, { useEffect } from "react";
import { AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PWASetup } from "../components/PWASetup";
import { ResponsiveContainer } from "../components/ResponsiveContainer";
import { ThemeProvider } from "../context/ThemeContext";
import { onSessionExpired, refreshSession } from "../services/api";

export default function RootLayout() {
	const router = useRouter();

	useEffect(() => {
		// Listen for session expiration events and redirect cleanly
		const unsubscribe = onSessionExpired(() => {
			router.replace("/auth/verificationau" as any);
		});

		// When app returns to foreground from background, silently verify/refresh session
		let lastState = AppState.currentState;
		const appStateSub = AppState.addEventListener("change", (nextState) => {
			if (lastState.match(/inactive|background/) && nextState === "active") {
				AsyncStorage.getItem("token").then((token) => {
					if (token) {
						refreshSession().catch(() => {});
					}
				});
			}
			lastState = nextState;
		});

		return () => {
			unsubscribe();
			appStateSub.remove();
		};
	}, [router]);

	return (
		<ThemeProvider>
			<Head>
				<title>Rayan</title>
				<link rel="manifest" href="/manifest.webmanifest" />
				<link rel="apple-touch-icon" sizes="192x192" href="/pwa-icon-192.png" />
				<meta name="theme-color" content="#0a84ff" />
				<meta name="mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-title" content="Rayan" />
				<meta name="apple-mobile-web-app-status-bar-style" content="default" />
			</Head>
			<PWASetup />
			<SafeAreaView style={{ flex: 1 }}>
				<ResponsiveContainer>
					<Stack screenOptions={{ headerShown: false }} />
				</ResponsiveContainer>
			</SafeAreaView>
		</ThemeProvider>
	);
}
