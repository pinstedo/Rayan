import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../../app/style/theme";
import { useTheme } from "../../context/ThemeContext";

export type MenuItem = { name: string; title: string; icon: string; iconActive: string; route: any; };

const DEFAULT_MENU_ITEMS: MenuItem[] = [
	{ name: "home", title: "Home", icon: "home-outline", iconActive: "home", route: "/(tabs)/home" as any },
	{ name: "manage", title: "Manage", icon: "briefcase-outline", iconActive: "briefcase", route: "/(tabs)/manage" as any },
	{ name: "profile", title: "Settings", icon: "person-outline", iconActive: "person", route: "/(tabs)/profile" as any },
];

export function Sidebar({
	menuItems = DEFAULT_MENU_ITEMS,
	title = "Rayan"
}: {
	menuItems?: MenuItem[],
	title?: string
}) {
	const pathname = usePathname();
	const router = useRouter();
	const { isDark, colors } = useTheme();

	const localColors = theme.colors; // Using the new design system colors

	return (
		<View style={[styles.container, { backgroundColor: isDark ? "#1e293b" : localColors.surface, borderRightColor: isDark ? "#334155" : localColors.border }]}>
			<View style={styles.logoContainer}>
				<Text style={[styles.logoText, { color: isDark ? "#f8fafc" : localColors.textPrimary }]}>{title}</Text>
			</View>

			<View style={styles.menuContainer}>
				{menuItems.map((item) => {
					// Check if current path includes the route name
					const isActive = pathname.includes(item.name);

					return (
						<TouchableOpacity
							key={item.name}
							style={[
								styles.menuItem,
								isActive && { backgroundColor: isDark ? "#334155" : `${localColors.primary}15` }
							]}
							onPress={() => router.push(item.route)}
						>
							<Ionicons
								name={isActive ? item.iconActive as any : item.icon as any}
								size={22}
								color={isActive ? localColors.primaryHover : (isDark ? "#cbd5e1" : localColors.textSecondary)}
							/>
							<Text
								style={[
									styles.menuText,
									{ color: isActive ? localColors.primaryHover : (isDark ? "#cbd5e1" : localColors.textSecondary) },
									isActive && { fontWeight: "700" }
								]}
							>
								{item.title}
							</Text>
						</TouchableOpacity>
					);
				})}
			</View>

			<View style={styles.footer}>
				<TouchableOpacity
					style={styles.menuItem}
					onPress={() => router.replace("/auth/authentication2" as any)} // Assuming this logs out or goes to auth
				>
					<Ionicons name="log-out-outline" size={22} color={localColors.error} />
					<Text style={[styles.menuText, { color: localColors.error }]}>Logout</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		width: 250,
		height: "100%",
		borderRightWidth: 1,
		paddingTop: theme.spacing.xl,
		paddingBottom: theme.spacing.lg,
		justifyContent: "space-between",
	},
	logoContainer: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: theme.spacing.lg,
		marginBottom: theme.spacing.xxl,
		gap: theme.spacing.sm,
	},
	logoText: {
		fontSize: theme.typography.sizes.xl,
		fontWeight: "800",
		letterSpacing: -0.5,
	},
	menuContainer: {
		flex: 1,
		paddingHorizontal: theme.spacing.md,
		gap: theme.spacing.xs,
	},
	menuItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: theme.spacing.md,
		paddingHorizontal: theme.spacing.md,
		borderRadius: theme.borderRadius.lg,
		gap: theme.spacing.md,
	},
	menuText: {
		fontSize: theme.typography.sizes.md,
		fontWeight: "500",
	},
	footer: {
		paddingHorizontal: theme.spacing.md,
		borderTopWidth: 1,
		borderTopColor: "transparent",
		paddingTop: theme.spacing.md,
	}
});
