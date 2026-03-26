import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { useWindowDimensions, View } from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import { Sidebar } from "../../../components/layout/Sidebar";

export default function SupervisorRemoteLayout() {
    const { isDark, colors } = useTheme();
    const { width } = useWindowDimensions();
    const isLargeScreen = width >= 768;

    const SUPERVISOR_MENU = [
        { name: "home", title: "Home", icon: "home-outline", iconActive: "home", route: "/supervisor/(tabs)/home" as any },
        { name: "profile", title: "Profile", icon: "person-outline", iconActive: "person", route: "/supervisor/(tabs)/profile" as any },
    ];

    return (
        <View style={{ flex: 1, flexDirection: isLargeScreen ? "row" : "column" }}>
            {isLargeScreen && <Sidebar menuItems={SUPERVISOR_MENU} title="Supervisor App" />}
            <View style={{ flex: 1 }}>
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors?.primary || "#0ea5e9",
                tabBarInactiveTintColor: isDark ? "#888" : "gray",
                tabBarStyle: {
                    display: isLargeScreen ? "none" : "flex",
                    backgroundColor: isDark ? "#1e1e1e" : "#fff",
                    borderTopColor: isDark ? "#333" : "#e0e0e0",
                },
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: "Home",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="home-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="person-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
        </View>
        </View>
    );
}

