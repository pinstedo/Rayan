import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

export type ThemeType = "light" | "dark";

export interface AppColors {
    background: string;
    surface: string;
    primary: string;
    primaryHover: string;
    secondary: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
    warning: string;
}

const lightColors: AppColors = {
    background: "#FAFAFA",
    surface: "#FFFFFF",
    primary: "#4F46E5",
    primaryHover: "#4338CA",
    secondary: "#F3F4F6",
    textPrimary: "#111827",
    textSecondary: "#6B7280",
    border: "#E5E7EB",
    error: "#EF4444",
    success: "#10B981",
    warning: "#F59E0B"
};

const darkColors: AppColors = {
    background: "#09090B",
    surface: "#18181B",
    primary: "#6366F1",
    primaryHover: "#4F46E5",
    secondary: "#27272A",
    textPrimary: "#FAFAFA",
    textSecondary: "#A1A1AA",
    border: "#27272A",
    error: "#F87171",
    success: "#34D399",
    warning: "#FBBF24"
};

interface ThemeContextType {
    theme: ThemeType;
    toggleTheme: () => void;
    isDark: boolean;
    colors: AppColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [theme, setTheme] = useState<ThemeType>(systemColorScheme === "dark" ? "dark" : "light");

    useEffect(() => {
        // Load saved theme on mount
        const loadTheme = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem("appTheme");
                if (savedTheme === "light" || savedTheme === "dark") {
                    setTheme(savedTheme);
                }
            } catch (error) {
                console.error("Failed to load theme", error);
            }
        };
        loadTheme();
    }, []);

    const toggleTheme = async () => {
        try {
            const newTheme = theme === "light" ? "dark" : "light";
            setTheme(newTheme);
            await AsyncStorage.setItem("appTheme", newTheme);
        } catch (error) {
            console.error("Failed to save theme", error);
        }
    };

    const isDark = theme === "dark";
    const colors = isDark ? darkColors : lightColors;

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isDark, colors }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};
