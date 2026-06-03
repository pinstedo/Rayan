import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";

interface AdminAccount {
  id: number;
  name: string;
  phone: string;
  status: string;
  is_deleted: boolean;
  created_at: string;
}

const emptyForm = { id: 0, name: "", phone: "", password: "" };

export default function OwnerAdmins() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const local = getStyles(isDark, colors);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [pending, setPending] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const [adminsRes, pendingRes] = await Promise.all([
        api.get("/auth/admins"),
        api.get("/auth/admins/pending"),
      ]);
      const adminsData = await adminsRes.json();
      const pendingData = await pendingRes.json();
      if (adminsRes.ok) setAdmins(adminsData);
      if (pendingRes.ok) setPending(pendingData);
    } catch (error) {
      console.error("Fetch admins error:", error);
      Alert.alert("Error", "Unable to load admin accounts");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    fetchAdmins();
  }, []));

  const openCreate = () => {
    setForm(emptyForm);
    setFormVisible(true);
  };

  const openEdit = (admin: AdminAccount) => {
    setForm({ id: admin.id, name: admin.name, phone: admin.phone, password: "" });
    setFormVisible(true);
  };

  const saveAdmin = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      Alert.alert("Validation", "Name and phone are required");
      return;
    }
    if (!form.id && form.password.length < 6) {
      Alert.alert("Validation", "Password must be at least 6 characters");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        ...(form.password ? { password: form.password } : {}),
      };
      const response = form.id
        ? await api.put(`/auth/admins/${form.id}`, payload)
        : await api.post("/auth/admins", payload);
      const body = await response.json();
      if (response.ok) {
        setFormVisible(false);
        fetchAdmins();
      } else {
        Alert.alert("Error", body.error || "Failed to save admin");
      }
    } catch (error) {
      console.error("Save admin error:", error);
      Alert.alert("Error", "Unable to save admin");
    } finally {
      setSaving(false);
    }
  };

  const requestAction = (title: string, message: string, action: () => Promise<void>) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: () => action() },
    ]);
  };

  const action = async (request: Promise<Response>, success: string) => {
    const response = await request;
    const body = await response.json();
    if (response.ok) {
      Alert.alert("Success", success);
      fetchAdmins();
    } else {
      Alert.alert("Error", body.error || "Action failed");
    }
  };

  const resetPassword = (admin: AdminAccount) => {
    if (!form.password || form.id !== admin.id) {
      Alert.alert("Reset Password", "Open Edit, enter a new password, then tap Reset Password.");
      openEdit(admin);
      return;
    }
    requestAction("Reset Password", `Reset password for ${admin.name}?`, async () => {
      await action(api.post(`/auth/admins/${admin.id}/reset-password`, { newPassword: form.password }), "Password reset successfully");
    });
  };

  const approve = (admin: AdminAccount) => action(api.put(`/auth/admins/${admin.id}/approve`, {}), "Admin approved");
  const reject = (admin: AdminAccount) => action(api.put(`/auth/admins/${admin.id}/reject`, {}), "Admin rejected");

  const renderAdmin = ({ item }: { item: AdminAccount }) => (
    <View style={[local.card, item.is_deleted && local.cardMuted]}>
      <View style={local.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={local.name}>{item.name}</Text>
          <Text style={local.subText}>{item.phone}</Text>
        </View>
        <Text style={[local.badge, item.is_deleted && local.badgeMuted]}>{item.is_deleted ? "disabled" : item.status}</Text>
      </View>
      <View style={local.actionRow}>
        <TouchableOpacity style={local.smallButton} onPress={() => openEdit(item)}>
          <Text style={local.smallButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={local.smallButton} onPress={() => resetPassword(item)}>
          <Text style={local.smallButtonText}>Reset</Text>
        </TouchableOpacity>
        {item.is_deleted ? (
          <>
            <TouchableOpacity style={local.smallButton} onPress={() => action(api.put(`/auth/admins/${item.id}/restore`, {}), "Admin restored")}>
              <Text style={local.smallButtonText}>Restore</Text>
            </TouchableOpacity>
            <TouchableOpacity style={local.dangerButton} onPress={() => requestAction("Delete Admin", `Permanently delete ${item.name}?`, () => action(api.delete(`/auth/admins/${item.id}/permanent`), "Admin deleted"))}>
              <Text style={local.dangerButtonText}>Delete</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={local.dangerButton} onPress={() => requestAction("Disable Admin", `Disable ${item.name}?`, () => action(api.delete(`/auth/admins/${item.id}`), "Admin disabled"))}>
            <Text style={local.dangerButtonText}>Disable</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={local.container}>
      <View style={local.header}>
        <TouchableOpacity onPress={() => router.back()} style={local.iconButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={local.title}>Admin Management</Text>
        <TouchableOpacity onPress={openCreate} style={local.iconButton}>
          <MaterialIcons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={admins}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderAdmin}
          ListHeaderComponent={pending.length > 0 ? (
            <View style={local.pendingPanel}>
              <Text style={local.sectionTitle}>Pending Admin Requests</Text>
              {pending.map((admin) => (
                <View key={admin.id} style={local.pendingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={local.name}>{admin.name}</Text>
                    <Text style={local.subText}>{admin.phone}</Text>
                  </View>
                  <TouchableOpacity style={local.approveButton} onPress={() => approve(admin)}>
                    <Text style={local.approveText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={local.dangerButton} onPress={() => reject(admin)}>
                    <Text style={local.dangerButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
          contentContainerStyle={local.list}
          ListEmptyComponent={<Text style={local.emptyText}>No admin accounts found.</Text>}
        />
      )}

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <View style={local.modalOverlay}>
          <View style={local.modalContent}>
            <Text style={local.modalTitle}>{form.id ? "Edit Admin" : "Create Admin"}</Text>
            <ScrollView>
              <TextInput style={local.input} placeholder="Name" placeholderTextColor={colors.textSecondary} value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} />
              <TextInput style={local.input} placeholder="Phone" placeholderTextColor={colors.textSecondary} value={form.phone} onChangeText={(phone) => setForm((f) => ({ ...f, phone }))} keyboardType="phone-pad" />
              <TextInput style={local.input} placeholder={form.id ? "New password optional" : "Password"} placeholderTextColor={colors.textSecondary} value={form.password} onChangeText={(password) => setForm((f) => ({ ...f, password }))} secureTextEntry />
            </ScrollView>
            <View style={local.modalActions}>
              <TouchableOpacity style={local.cancelButton} onPress={() => setFormVisible(false)}>
                <Text style={local.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={local.saveButton} onPress={saveAdmin} disabled={saving}>
                <Text style={local.saveText}>{saving ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (isDark: boolean, colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconButton: { padding: 8 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  list: { padding: 16, paddingBottom: 60 },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "800", marginBottom: 10 },
  pendingPanel: { marginBottom: 18 },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  cardMuted: { opacity: 0.72 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  name: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  subText: { color: colors.textSecondary, marginTop: 2 },
  badge: { color: isDark ? "#a7f3d0" : "#047857", backgroundColor: isDark ? "#064e3b" : "#d1fae5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: "hidden", textTransform: "capitalize", fontSize: 12, fontWeight: "700" },
  badgeMuted: { color: isDark ? "#fecaca" : "#991b1b", backgroundColor: isDark ? "#7f1d1d" : "#fee2e2" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  smallButton: { backgroundColor: colors.secondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  smallButtonText: { color: colors.textPrimary, fontWeight: "700" },
  approveButton: { backgroundColor: colors.success, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  approveText: { color: "#fff", fontWeight: "700" },
  dangerButton: { backgroundColor: colors.error, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  dangerButtonText: { color: "#fff", fontWeight: "700" },
  emptyText: { color: colors.textSecondary, textAlign: "center", marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 },
  modalContent: { backgroundColor: colors.surface, borderRadius: 12, padding: 18, maxHeight: "85%" },
  modalTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: "800", marginBottom: 14 },
  input: { height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? "#111827" : "#f8fafc", color: colors.textPrimary, paddingHorizontal: 12, marginBottom: 10 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelButton: { flex: 1, height: 46, borderRadius: 10, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.textPrimary, fontWeight: "700" },
  saveButton: { flex: 1, height: 46, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontWeight: "800" },
});
