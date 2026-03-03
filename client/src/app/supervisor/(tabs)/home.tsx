import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { JSX, useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import GlobalSearch from "../../../components/GlobalSearch";
import { useTheme } from "../../../context/ThemeContext";
import { api } from "../../../services/api";

interface Site {
    id: number;
    name: string;
    address: string;
}

const options = [
    { key: "attendance", icon: "check-circle", title: "Attendance", desc: "Record and view attendance" },
    { key: "labours", icon: "group", title: "Labours", desc: "View assigned labours" },
    { key: "overtime", icon: "timer", title: "Overtime", desc: "Log overtime hours" },
    { key: "advance", icon: "account-balance-wallet", title: "Advance", desc: "Manage advances" },
    { key: "add-labour", icon: "person-add", title: "Add Labours", desc: "Add new labours to the system" },
];

export default function SupervisorHome(): JSX.Element {
    const router = useRouter();
    const { isDark } = useTheme();
    const styles = getLocalStyles(isDark);
    const [assignedSites, setAssignedSites] = useState<Site[]>([]);
    const [selectedSite, setSelectedSite] = useState<Site | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userName, setUserName] = useState("Supervisor");

    const fetchAssignedSites = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            // Get supervisor ID from stored user data
            const userDataStr = await AsyncStorage.getItem("userData");
            if (!userDataStr) {
                Alert.alert("Error", "User session not found. Please login again.");
                return;
            }

            const userData = JSON.parse(userDataStr);
            setUserName(userData.name || "Supervisor");

            const response = await api.get(`/sites/supervisor/${userData.id}`);
            const data = await response.json();

            if (response.ok) {
                setAssignedSites(data);
                if (data.length > 0 && !selectedSite) {
                    setSelectedSite(data[0]);
                }
            } else {
                console.error("Failed to fetch sites:", data.error);
            }
        } catch (error) {
            console.error("Fetch assigned sites error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        fetchAssignedSites(true);
    };

    useFocusEffect(
        useCallback(() => {
            fetchAssignedSites();
        }, [])
    );

    const onPress = (key: string) => {
        if (key === "add-labour") {
            // Pass selected site ID if available
            if (selectedSite) {
                router.push(`/(screens)/add-labour?siteId=${selectedSite.id}&siteName=${encodeURIComponent(selectedSite.name)}` as any);
            } else {
                router.push("/(screens)/add-labour");
            }
            return;
        }
        if (key === "attendance") {
            if (selectedSite) {
                router.push(`/(screens)/attendance?siteId=${selectedSite.id}&siteName=${encodeURIComponent(selectedSite.name)}` as any);
            } else {
                Alert.alert("Error", "Please select a site first.");
            }
            return;
        }
        if (key === "overtime") {
            router.push("/(screens)/overtime");
            return;
        }
        if (key === "labours") {
            // Navigate to shared labours screen, it will handle fetching based on role/id
            router.push("/(screens)/labours");
            return;
        }
        if (key === "advance") {
            router.push("/(screens)/advance");
            return;
        }
        // navigate to dedicated management screen (ensure routes exist or create them)
        router.push(`/manage/${key}` as any);
    };

    const firstName = userName.split(" ")[0];

    return (
        <View style={styles.mainContainer}>
            <View style={styles.headerSection}>
                <Text style={styles.greetingText}>Welcome back,</Text>
                <Text style={styles.headerTitle}>{firstName}</Text>
                <View style={{ marginTop: 16 }}>
                    <GlobalSearch />
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.contentStyle}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />
                }
            >
                {/* Site Selector */}
                {assignedSites.length > 0 && (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionHeader}>Assigned Sites</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.siteScroll}>
                            {assignedSites.map((site) => (
                                <Pressable
                                    key={site.id}
                                    style={[
                                        styles.siteChip,
                                        selectedSite?.id === site.id && styles.siteChipActive
                                    ]}
                                    onPress={() => setSelectedSite(site)}
                                >
                                    <MaterialIcons
                                        name="location-city"
                                        size={20}
                                        color={selectedSite?.id === site.id ? "#FFFFFF" : (isDark ? "#94A3B8" : "#64748B")}
                                    />
                                    <Text style={[
                                        styles.siteChipText,
                                        selectedSite?.id === site.id && styles.siteChipTextActive
                                    ]}>
                                        {site.name}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {assignedSites.length === 0 && !loading && (
                    <View style={styles.noSitesContainer}>
                        <MaterialIcons name="location-off" size={48} color={isDark ? "#475569" : "#CBD5E1"} />
                        <Text style={styles.noSitesText}>No sites assigned to you yet</Text>
                        <Text style={styles.noSitesSubtext}>Contact your admin to get assigned to a site.</Text>
                    </View>
                )}

                <Text style={[styles.sectionHeader, { paddingHorizontal: 20 }]}>Quick Actions</Text>
                <View style={styles.grid}>
                    {options.map((opt) => (
                        <Pressable
                            key={opt.key}
                            style={styles.optionCard}
                            onPress={() => onPress(opt.key)}
                            accessibilityRole="button"
                            accessibilityLabel={opt.title}
                        >
                            <View style={styles.optionIconWrap}>
                                <MaterialIcons name={opt.icon as any} size={24} color="#3B82F6" />
                            </View>

                            <Text style={styles.optionTitle}>{opt.title}</Text>
                            <Text style={styles.optionDesc} numberOfLines={2}>{opt.desc}</Text>
                        </Pressable>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const getLocalStyles = (isDark: boolean) => StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
    },
    headerSection: {
        paddingTop: 64, // Top padding for safe area since using default header off
        paddingHorizontal: 24,
        paddingBottom: 24,
        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.3 : 0.05,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 100,
        marginBottom: 24,
    },
    greetingText: {
        fontSize: 15,
        fontWeight: "500",
        color: isDark ? "#94A3B8" : "#64748B",
        marginBottom: 4,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: "800",
        color: isDark ? "#F1F5F9" : "#0F172A",
    },
    contentStyle: {
        paddingBottom: 40,
    },
    sectionContainer: {
        marginBottom: 28,
    },
    sectionHeader: {
        fontSize: 20,
        fontWeight: "700",
        color: isDark ? "#F1F5F9" : "#0F172A",
        marginBottom: 16,
        paddingHorizontal: 20,
    },
    siteScroll: {
        paddingLeft: 20,
        paddingRight: 8,
    },
    siteChip: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
        borderRadius: 24,
        marginRight: 12,
        borderWidth: 1,
        borderColor: isDark ? "#334155" : "#E2E8F0",
        gap: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.1 : 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    siteChipActive: {
        backgroundColor: "#3B82F6",
        borderColor: "#3B82F6",
        shadowOpacity: isDark ? 0.4 : 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    siteChipText: {
        fontSize: 15,
        fontWeight: "600",
        color: isDark ? "#94A3B8" : "#64748B",
    },
    siteChipTextActive: {
        color: "#FFFFFF",
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        paddingHorizontal: 20,
    },
    optionCard: {
        width: "48%",
        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        alignItems: "flex-start",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.2 : 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    optionIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: isDark ? "rgba(59, 130, 246, 0.15)" : "#EFF6FF",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: isDark ? "#F1F5F9" : "#0F172A",
        marginBottom: 6,
    },
    optionDesc: {
        fontSize: 13,
        fontWeight: "400",
        color: isDark ? "#94A3B8" : "#64748B",
        lineHeight: 18,
    },
    noSitesContainer: {
        alignItems: "center",
        padding: 40,
        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
        borderRadius: 20,
        marginHorizontal: 20,
        marginBottom: 24,
        borderStyle: "dashed",
        borderWidth: 1,
        borderColor: isDark ? "#334155" : "#CBD5E1",
    },
    noSitesText: {
        fontSize: 16,
        fontWeight: "600",
        color: isDark ? "#94A3B8" : "#64748B",
        marginTop: 16,
    },
    noSitesSubtext: {
        fontSize: 14,
        color: isDark ? "#64748B" : "#94A3B8",
        marginTop: 6,
        textAlign: "center",
    },
});
