import React from "react";
import {
	ActivityIndicator,
	RefreshControl,
	RefreshControlProps,
	StyleProp,
	StyleSheet,
	Text,
	View,
	ViewStyle,
} from "react-native";
import { useTheme } from "../context/ThemeContext";

type AppRefreshControlProps = Omit<RefreshControlProps, "colors" | "tintColor" | "progressBackgroundColor"> & {
	color?: string;
};

export function AppRefreshControl({ color, ...props }: AppRefreshControlProps) {
	const { colors, isDark } = useTheme();
	const accent = color ?? colors.primary;

	return (
		<RefreshControl
			{...props}
			colors={[accent]}
			tintColor={accent}
			progressBackgroundColor={isDark ? colors.surface : "#FFFFFF"}
		/>
	);
}

interface TopRefreshLoaderProps {
	visible: boolean;
	label?: string;
	style?: StyleProp<ViewStyle>;
}

export function TopRefreshLoader({ visible, label = "Refreshing...", style }: TopRefreshLoaderProps) {
	const { colors } = useTheme();

	if (!visible) return null;

	return (
		<View
			style={[
				styles.topLoader,
				{ backgroundColor: colors.surface, borderColor: colors.border },
				style,
			]}
		>
			<ActivityIndicator size="small" color={colors.primary} />
			<Text style={[styles.topLoaderText, { color: colors.textSecondary }]}>{label}</Text>
		</View>
	);
}

interface LoadingScreenProps {
	label?: string;
	style?: StyleProp<ViewStyle>;
}

export function LoadingScreen({ label = "Loading...", style }: LoadingScreenProps) {
	const { colors } = useTheme();

	return (
		<View style={[styles.loadingScreen, { backgroundColor: colors.background }, style]}>
			<ActivityIndicator size="large" color={colors.primary} />
			<Text style={[styles.loadingText, { color: colors.textSecondary }]}>{label}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	topLoader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		marginHorizontal: 16,
		marginTop: 12,
		marginBottom: 8,
		paddingVertical: 10,
		borderRadius: 8,
		borderWidth: 1,
	},
	topLoaderText: {
		fontSize: 13,
		fontWeight: "600",
	},
	loadingScreen: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
	},
	loadingText: {
		marginTop: 12,
		fontSize: 14,
		fontWeight: "600",
	},
});
