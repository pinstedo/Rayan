import { Stack } from "expo-router";
import Head from "expo-router/head";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";
import { ResponsiveContainer } from "../components/ResponsiveContainer";
import { PWASetup } from "../components/PWASetup";

export default function RootLayout() {
	return (
		<ThemeProvider>
			<Head>
				<title>Proto</title>
				<link rel="manifest" href="/manifest.webmanifest" />
				<link rel="apple-touch-icon" sizes="192x192" href="/pwa-icon-192.png" />
				<meta name="theme-color" content="#0a84ff" />
				<meta name="mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-title" content="Proto" />
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
