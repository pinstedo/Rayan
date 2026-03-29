import { Stack } from "expo-router";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";
import { ResponsiveContainer } from "../components/ResponsiveContainer";

export default function RootLayout() {
	return (
		<ThemeProvider>
			<SafeAreaView style={{ flex: 1 }}>
				<ResponsiveContainer>
					<Stack screenOptions={{ headerShown: false }} />
				</ResponsiveContainer>
			</SafeAreaView>
		</ThemeProvider>
	);
}
