import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { AppRefreshControl, LoadingScreen, TopRefreshLoader } from "../../components/RefreshFeedback";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";

interface OwnerDailyData {
  date: string;
  summary: {
    present: number;
    computedAbsent: number;
    totalMarked: number;
    totalLabours: number;
    activeLabours: number;
    totalAdvances: number;
    advanceCount: number;
    totalSites: number;
    activeSites: number;
    inactiveSites: number;
    completedSites: number;
  };
  sites: Array<{
    id: number;
    name: string;
    status: string;
    completion_percentage: number;
    active_labour_count: number;
    total_labour_count: number;
    full_count: number;
    half_count: number;
    present_count: number;
    computed_absent_count: number;
    total_marked: number;
  }>;
  advancesBySite: Array<{
    site_id: number | null;
    site_name: string;
    count: number;
    total_amount: number;
  }>;
}

const todayString = () => new Date().toISOString().split("T")[0];

export default function OwnerDashboard() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const local = getStyles(isDark, colors);
  const [date, setDate] = useState(todayString());
  const [data, setData] = useState<OwnerDailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState("Owner");

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const userData = await AsyncStorage.getItem("userData");
      if (userData) {
        const user = JSON.parse(userData);
        setUserName(user.name || "Owner");
      }

      const response = await api.get(`/dashboard/owner-daily?date=${encodeURIComponent(date)}`);
      const body = await response.json();
      if (response.ok) {
        setData(body);
      } else {
        setData(null);
      }
    } catch (error) {
      console.error("Owner dashboard fetch error:", error);
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const logout = async () => {
    await AsyncStorage.multiRemove(["token", "refreshToken", "userData"]);
    router.replace("/auth/authentication2" as any);
  };

  const summary = data?.summary;
  const cards = [
    { label: "Today Present", value: summary?.present ?? 0, icon: "event-available", color: colors.success },
    { label: "Advances", value: `Rs ${Number(summary?.totalAdvances ?? 0).toFixed(0)}`, icon: "payments", color: colors.warning },
    { label: "Active Sites", value: summary?.activeSites ?? 0, icon: "business", color: colors.primary },
    { label: "Total Labours", value: summary?.totalLabours ?? 0, icon: "groups", color: "#7c3aed" },
  ];

  if (loading && !refreshing) {
    return <LoadingScreen label="Loading dashboard..." />;
  }

  return (
    <ScrollView
      style={local.container}
      contentContainerStyle={local.content}
      refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => fetchDashboard(true)} />}
    >
      <TopRefreshLoader visible={refreshing} />
      <View style={local.header}>
        <View>
          <Text style={local.kicker}>Owner Dashboard</Text>
          <Text style={local.title}>{userName}</Text>
        </View>
        <View style={local.headerActions}>
          <TouchableOpacity style={local.iconButton} onPress={() => router.push("/owner/admins" as any)}>
            <MaterialIcons name="admin-panel-settings" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={local.iconButton} onPress={logout}>
            <MaterialIcons name="logout" size={24} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={local.dateRow}>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textSecondary}
          style={local.dateInput}
        />
        <TouchableOpacity style={local.primaryButton} onPress={() => fetchDashboard()}>
          <Text style={local.primaryButtonText}>Load</Text>
        </TouchableOpacity>
      </View>

      {!loading && (
        <>
          <View style={local.cards}>
            {cards.map((card) => (
              <View key={card.label} style={[local.card, { borderTopColor: card.color }]}>
                <MaterialIcons name={card.icon as any} size={26} color={card.color} />
                <Text style={local.cardValue}>{card.value}</Text>
                <Text style={local.cardLabel}>{card.label}</Text>
              </View>
            ))}
          </View>

          <Section title="Daily Attendance" styles={local}>
            {(data?.sites || []).length === 0 ? (
              <Text style={local.emptyText}>No sites found.</Text>
            ) : (
              data!.sites.map((site) => (
                <View key={site.id} style={local.rowCard}>
                  <View style={local.rowTop}>
                    <Text style={local.rowTitle}>{site.name}</Text>
                    <Text style={local.badge}>{site.status || "active"}</Text>
                  </View>
                  <View style={local.metricsRow}>
                    <Metric label="Present" value={site.present_count} styles={local} />
                    <Metric label="Absent" value={site.computed_absent_count} styles={local} />
                    <Metric label="Marked" value={site.total_marked} styles={local} />
                    <Metric label="Labours" value={site.active_labour_count} styles={local} />
                  </View>
                </View>
              ))
            )}
          </Section>

          <Section title="Advances Given" styles={local}>
            {(data?.advancesBySite || []).length === 0 ? (
              <Text style={local.emptyText}>No advances recorded for this date.</Text>
            ) : (
              data!.advancesBySite.map((advance) => (
                <View key={`${advance.site_id}-${advance.site_name}`} style={local.compactRow}>
                  <Text style={local.rowTitle}>{advance.site_name}</Text>
                  <Text style={local.amountText}>Rs {Number(advance.total_amount).toFixed(0)} - {advance.count}</Text>
                </View>
              ))
            )}
          </Section>

          <Section title="Site Information" styles={local}>
            {(data?.sites || []).map((site) => (
              <View key={`info-${site.id}`} style={local.compactRow}>
                <View>
                  <Text style={local.rowTitle}>{site.name}</Text>
                  <Text style={local.subText}>{site.total_labour_count} labours - {Math.round(site.completion_percentage || 0)}% complete</Text>
                </View>
                <Text style={local.badge}>{site.status || "active"}</Text>
              </View>
            ))}
          </Section>
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, styles, children }: { title: string; styles: any; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Metric({ label, value, styles }: { label: string; value: number; styles: any }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const getStyles = (isDark: boolean, colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  kicker: { color: colors.textSecondary, fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: "800", marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 10 },
  iconButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  dateRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  dateInput: { flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: 14 },
  primaryButton: { height: 48, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  cards: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 12 },
  card: { width: "48%", backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 12, borderTopWidth: 4, borderWidth: 1, borderColor: colors.border },
  cardValue: { color: colors.textPrimary, fontSize: 24, fontWeight: "800", marginTop: 10 },
  cardLabel: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  section: { marginTop: 16 },
  sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "800", marginBottom: 10 },
  rowCard: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  compactRow: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  rowTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "700", flexShrink: 1 },
  badge: { color: isDark ? "#a7f3d0" : "#047857", backgroundColor: isDark ? "#064e3b" : "#d1fae5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: "hidden", textTransform: "capitalize", fontSize: 12, fontWeight: "700" },
  metricsRow: { flexDirection: "row", justifyContent: "space-between" },
  metric: { alignItems: "center", minWidth: 58 },
  metricValue: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  metricLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  amountText: { color: colors.textPrimary, fontWeight: "800" },
  subText: { color: colors.textSecondary, marginTop: 3, fontSize: 12 },
  emptyText: { color: colors.textSecondary, padding: 16, textAlign: "center", backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
});
