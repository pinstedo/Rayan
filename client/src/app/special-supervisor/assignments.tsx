import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { CustomModal, ModalType } from "../../components/CustomModal";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";

interface Site {
  id: number;
  name: string;
  status: string;
  labour_count?: number;
}

interface Labour {
  id: number;
  name: string;
  phone: string;
  site?: string;
  site_id?: number;
  status?: "active" | "unassigned" | "leave" | "pending";
}

type StatusFilter = "all" | "active" | "unassigned" | "leave";

export default function SpecialSupervisorAssignments() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const local = getStyles(isDark, colors);
  const [sites, setSites] = useState<Site[]>([]);
  const [labours, setLabours] = useState<Labour[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("unassigned");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [modal, setModal] = useState<{ visible: boolean; title: string; message: string; type: ModalType }>({
    visible: false,
    title: "",
    message: "",
    type: "default",
  });

  const showModal = (title: string, message: string, type: ModalType = "default") => {
    setModal({ visible: true, title, message, type });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sitesRes, laboursRes] = await Promise.all([
        api.get("/sites?status=active"),
        api.get("/labours"),
      ]);
      const sitesData = await sitesRes.json();
      const laboursData = await laboursRes.json();
      if (sitesRes.ok) {
        setSites(sitesData);
        setSelectedSite((current) => current || sitesData[0] || null);
      }
      if (laboursRes.ok) setLabours(laboursData);
    } catch (error) {
      console.error("Special supervisor fetch error:", error);
      showModal("Error", "Unable to load assignments", "error");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    fetchData();
  }, []));

  const filteredLabours = useMemo(() => {
    const text = query.trim().toLowerCase();
    return labours
      .filter((labour) => status === "all" || (labour.status || "active") === status)
      .filter((labour) => {
        if (!text) return true;
        return `${labour.name} ${labour.phone} ${labour.site || ""}`.toLowerCase().includes(text);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [labours, query, status]);

  const logout = async () => {
    await AsyncStorage.multiRemove(["token", "refreshToken", "userData"]);
    router.replace("/auth/verificationau" as any);
  };

  const runAction = async (labour: Labour, action: () => Promise<Response>, success: string) => {
    try {
      setBusyId(labour.id);
      const response = await action();
      const body = await response.json();
      if (response.ok) {
        showModal("Success", success, "success");
        fetchData();
      } else {
        showModal("Error", body.error || "Action failed", "error");
      }
    } catch (error) {
      console.error("Assignment action error:", error);
      showModal("Error", "Unable to complete action", "error");
    } finally {
      setBusyId(null);
    }
  };

  const assignLabour = (labour: Labour) => {
    if (!selectedSite) {
      showModal("Select Site", "Choose an active site before assigning labour.", "warning");
      return;
    }
    runAction(
      labour,
      () => api.post(`/sites/${selectedSite.id}/assign-labour`, { labour_id: labour.id }),
      `${labour.name} assigned to ${selectedSite.name}`
    );
  };

  const unassignLabour = (labour: Labour) => {
    if (!labour.site_id) {
      runAction(labour, () => api.put(`/labours/${labour.id}/status`, { status: "unassigned" }), `${labour.name} marked unassigned`);
      return;
    }
    runAction(labour, () => api.delete(`/sites/${labour.site_id}/unassign-labour/${labour.id}`), `${labour.name} unassigned`);
  };

  const changeStatus = (labour: Labour, newStatus: "leave" | "unassigned" | "active") => {
    runAction(labour, () => api.put(`/labours/${labour.id}/status`, { status: newStatus }), `${labour.name} updated`);
  };

  const renderLabour = ({ item }: { item: Labour }) => {
    const disabled = busyId === item.id;
    return (
      <View style={local.labourCard}>
        <View style={local.labourTop}>
          <View style={{ flex: 1 }}>
            <Text style={local.labourName}>{item.name}</Text>
            <Text style={local.labourSub}>{item.phone || "No phone"} - {item.site || "Unassigned"}</Text>
          </View>
          <Text style={local.badge}>{item.status || "active"}</Text>
        </View>
        <View style={local.actionRow}>
          <TouchableOpacity style={[local.actionButton, disabled && local.disabled]} disabled={disabled} onPress={() => assignLabour(item)}>
            <Text style={local.actionText}>Assign</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[local.actionButton, disabled && local.disabled]} disabled={disabled} onPress={() => unassignLabour(item)}>
            <Text style={local.actionText}>Unassign</Text>
          </TouchableOpacity>
          {item.status === "leave" ? (
            <TouchableOpacity style={[local.actionButton, disabled && local.disabled]} disabled={disabled} onPress={() => changeStatus(item, "unassigned")}>
              <Text style={local.actionText}>End Leave</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[local.warningButton, disabled && local.disabled]} disabled={disabled} onPress={() => changeStatus(item, "leave")}>
              <Text style={local.warningText}>Leave</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={local.container}>
      <View style={local.header}>
        <View>
          <Text style={local.kicker}>Special Supervisor</Text>
          <Text style={local.title}>Labour Assignment</Text>
        </View>
        <TouchableOpacity style={local.iconButton} onPress={logout}>
          <MaterialIcons name="logout" size={24} color={colors.error} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} />
      ) : (
        <>
          <View style={local.panel}>
            <Text style={local.sectionTitle}>Active Site</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {sites.map((site) => (
                <TouchableOpacity
                  key={site.id}
                  style={[local.siteChip, selectedSite?.id === site.id && local.siteChipActive]}
                  onPress={() => setSelectedSite(site)}
                >
                  <Text style={[local.siteChipText, selectedSite?.id === site.id && local.siteChipTextActive]}>
                    {site.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={local.filters}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search labours"
              placeholderTextColor={colors.textSecondary}
              style={local.search}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(["all", "active", "unassigned", "leave"] as StatusFilter[]).map((item) => (
                <TouchableOpacity key={item} style={[local.filterChip, status === item && local.filterChipActive]} onPress={() => setStatus(item)}>
                  <Text style={[local.filterText, status === item && local.filterTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={filteredLabours}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderLabour}
            contentContainerStyle={local.list}
            ListEmptyComponent={<Text style={local.emptyText}>No labours found.</Text>}
          />
        </>
      )}

      <CustomModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal((m) => ({ ...m, visible: false }))}
        actions={[{ text: "OK", style: "default", onPress: () => setModal((m) => ({ ...m, visible: false })) }]}
      />
    </View>
  );
}

const getStyles = (isDark: boolean, colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  kicker: { color: colors.textSecondary, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: "800", marginTop: 2 },
  iconButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  panel: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "800", marginBottom: 10 },
  siteChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginRight: 8, backgroundColor: colors.background },
  siteChipActive: { borderColor: colors.primary, backgroundColor: isDark ? "#123456" : "#e8f4ff" },
  siteChipText: { color: colors.textSecondary, fontWeight: "700" },
  siteChipTextActive: { color: colors.primary },
  filters: { padding: 16, gap: 10 },
  search: { height: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginRight: 8, backgroundColor: colors.surface },
  filterChipActive: { borderColor: colors.primary, backgroundColor: isDark ? "#123456" : "#e8f4ff" },
  filterText: { color: colors.textSecondary, fontWeight: "700", textTransform: "capitalize" },
  filterTextActive: { color: colors.primary },
  list: { padding: 16, paddingBottom: 80 },
  labourCard: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  labourTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  labourName: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" },
  labourSub: { color: colors.textSecondary, marginTop: 3 },
  badge: { color: isDark ? "#bfdbfe" : "#1d4ed8", backgroundColor: isDark ? "#1e3a8a" : "#dbeafe", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: "hidden", textTransform: "capitalize", fontSize: 12, fontWeight: "800" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionButton: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8 },
  actionText: { color: "#fff", fontWeight: "800" },
  warningButton: { backgroundColor: colors.warning, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8 },
  warningText: { color: "#fff", fontWeight: "800" },
  disabled: { opacity: 0.55 },
  emptyText: { color: colors.textSecondary, textAlign: "center", marginTop: 40 },
});
