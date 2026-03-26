import React from "react";
import { View, StyleSheet, useWindowDimensions, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function ResponsiveContainer({ children }: { children: React.ReactNode }) {
	const { width, height } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	
	// Determine if the screen is large (like a Windows desktop)
	const isLargeScreen = width >= 768;

	// On mobile devices, let it fill the screen normally. We no longer rigidly constrain web.
	if (Platform.OS !== "web") {
		return <View style={styles.mobileContainer}>{children}</View>;
	}

	// On web, we provide a full width, standard fluid container so multi-column layouts work.
	return (
		<View style={styles.desktopOuterContainer}>
			<View style={styles.desktopInnerContainer}>
				{children}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	mobileContainer: {
		flex: 1,
	},
	desktopOuterContainer: {
		flex: 1,
		backgroundColor: "transparent",
	},
	desktopInnerContainer: {
		flex: 1,
		width: "100%",
		overflow: "hidden",
	},
});
