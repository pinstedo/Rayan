
import "@expo/vector-icons";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { default as React, useEffect, useRef } from "react";
import { Animated, useWindowDimensions, View } from "react-native";
import { Sidebar } from "../../components/layout/Sidebar";
import { useTheme } from "../../context/ThemeContext";

export default function RootLayout() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  return (
    <View style={{ flex: 1, flexDirection: isLargeScreen ? "row" : "column" }}>
      {isLargeScreen && <Sidebar />}
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textSecondary,
            tabBarShowLabel: true,
            tabBarStyle: {
              display: isLargeScreen ? "none" : "flex",
              backgroundColor: colors.surface,
              height: 64,
              paddingBottom: 8,
              paddingTop: 8,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 5,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: "600",
              marginTop: 2,
            },
          }}
        >
          <Tabs.Screen
            name="home"
            options={{
              title: "Home",
              tabBarIcon: ({ color, focused }) => (
                <IconWithAnimation
                  name={focused ? "home" : "home-outline"}
                  size={20}
                  color={color}
                  focused={focused}
                />
              ),
            }}
          />

          <Tabs.Screen
            name="manage"
            options={{
              title: "Manage",
              tabBarIcon: ({ color, focused }) => (
                <IconWithAnimation
                  name={focused ? "briefcase" : "briefcase-outline"}
                  size={20}
                  color={color}
                  focused={focused}
                />
              ),
            }}
          />

          <Tabs.Screen
            name="profile"
            options={{
              title: "Settings",
              tabBarIcon: ({ color, focused }) => (
                <IconWithAnimation
                  name={focused ? "person" : "person-outline"}
                  size={20}
                  color={color}
                  focused={focused}
                />
              ),
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}

const IconWithAnimation = ({ name, color, focused, size }: any) => {
  const scale = useRef(new Animated.Value(focused ? 1.15 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.15 : 1,
      useNativeDriver: true,
      friction: 5,
      tension: 100,
    }).start();
  }, [focused, scale]);

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={name} size={size ?? 24} color={color} />
    </Animated.View>
  );
};
