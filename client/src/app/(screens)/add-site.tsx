import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CustomModal, ModalType } from "../../components/CustomModal";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";

export default function AddSite() {
  const router = useRouter();
  const { isDark } = useTheme();
  const local = getStyles(isDark);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const [modalConfig, setModalConfig] = useState<{
    visible: boolean;
    title?: string;
    message?: string;
    type?: ModalType;
    actions?: any[];
  }>({ visible: false });

  const showModal = (
    title: string,
    message: string,
    type: ModalType = "default",
    actions?: any[]
  ) => {
    setModalConfig({
      visible: true,
      title,
      message,
      type,
      actions: actions || [
        {
          text: "OK",
          onPress: () => setModalConfig((prev) => ({ ...prev, visible: false })),
          style: "default",
        },
      ],
    });
  };

  const onSubmit = async () => {
    if (!name.trim()) {
      showModal("Required Field", "Please enter the site name.", "warning");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        address: address.trim(),
        description: description.trim(),
      };
      const response = await api.post("/sites", payload);

      if (response.ok) {
        const successMsg = "Site created and registered successfully.";
        if (Platform.OS === "web") {
          window.alert(successMsg);
        } else {
          Alert.alert("Success", successMsg);
        }
        router.back();
      } else {
        const errorData = await response.json();
        showModal("Error", errorData.error || "Failed to add site", "error");
      }
    } catch (error) {
      console.error("Add site error:", error);
      showModal("Error", "Failed to connect to server. Please check your network.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={local.screenContainer}
      enabled={Platform.OS !== "web"}
    >
      <ScrollView
        contentContainerStyle={local.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={local.centeredWrapper}>
          {/* Top Header */}
          <View style={local.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={local.backBtn}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-back"
                size={22}
                color={isDark ? "#ffffff" : "#1f2937"}
              />
            </TouchableOpacity>
            <View style={local.headerTextWrap}>
              <Text style={local.headerTitle}>Add New Site</Text>
              <Text style={local.headerSubtitle}>
                Register construction project or workplace
              </Text>
            </View>
          </View>

          {/* SECTION 1: Site Identity & Location */}
          <View style={local.card}>
            <View style={local.sectionHeader}>
              <View style={[local.sectionIconWrap, { backgroundColor: isDark ? "#143328" : "#ecfdf5" }]}>
                <Ionicons name="business" size={18} color="#059669" />
              </View>
              <View>
                <Text style={local.sectionTitle}>Site Identity & Location</Text>
                <Text style={local.sectionSubtitle}>Core project identification & address</Text>
              </View>
            </View>

            {/* Site Name */}
            <View style={local.fieldGroup}>
              <View style={local.labelRow}>
                <Text style={local.label}>Site Name</Text>
                <Text style={local.requiredStar}>*</Text>
              </View>
              <View
                style={[
                  local.inputContainer,
                  focusedField === "name" && local.inputContainerFocused,
                ]}
              >
                <MaterialIcons
                  name="location-city"
                  size={20}
                  color={focusedField === "name" ? "#059669" : isDark ? "#71717a" : "#9ca3af"}
                  style={local.leadingIcon}
                />
                <TextInput
                  style={local.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Skyline Residency Tower A"
                  placeholderTextColor={isDark ? "#71717a" : "#9ca3af"}
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="words"
                />
                {name.length > 0 && (
                  <TouchableOpacity onPress={() => setName("")} style={local.clearBtn}>
                    <Ionicons name="close-circle" size={18} color={isDark ? "#71717a" : "#9ca3af"} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={local.helperText}>Unique identifier used for labour assignments</Text>
            </View>

            {/* Site Address */}
            <View style={[local.fieldGroup, { marginBottom: 0 }]}>
              <View style={local.labelRow}>
                <Text style={local.label}>Location / Address</Text>
                <Text style={local.optionalBadge}>Optional</Text>
              </View>
              <View
                style={[
                  local.inputContainer,
                  focusedField === "address" && local.inputContainerFocused,
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={19}
                  color={focusedField === "address" ? "#059669" : isDark ? "#71717a" : "#9ca3af"}
                  style={local.leadingIcon}
                />
                <TextInput
                  style={local.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="e.g. Plot 42, Sector 15, Near Metro"
                  placeholderTextColor={isDark ? "#71717a" : "#9ca3af"}
                  onFocus={() => setFocusedField("address")}
                  onBlur={() => setFocusedField(null)}
                />
                {address.length > 0 && (
                  <TouchableOpacity onPress={() => setAddress("")} style={local.clearBtn}>
                    <Ionicons name="close-circle" size={18} color={isDark ? "#71717a" : "#9ca3af"} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={local.helperText}>Physical site location, landmark, or city</Text>
            </View>
          </View>

          {/* SECTION 2: Project Scope & Description */}
          <View style={local.card}>
            <View style={local.sectionHeader}>
              <View style={[local.sectionIconWrap, { backgroundColor: isDark ? "#27272a" : "#f4f4f5" }]}>
                <Ionicons name="document-text" size={18} color={isDark ? "#a1a1aa" : "#52525b"} />
              </View>
              <View>
                <Text style={local.sectionTitle}>Project Scope & Notes</Text>
                <Text style={local.sectionSubtitle}>Optional description, client info, or notes</Text>
              </View>
            </View>

            <View
              style={[
                local.textAreaContainer,
                focusedField === "description" && local.inputContainerFocused,
              ]}
            >
              <TextInput
                style={local.textArea}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter project scope, milestones, client details, or safety instructions..."
                placeholderTextColor={isDark ? "#71717a" : "#9ca3af"}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                onFocus={() => setFocusedField("description")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Form Action Buttons */}
          <View style={local.actionsWrap}>
            <TouchableOpacity
              style={local.cancelBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Text style={local.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[local.submitBtn, loading && local.submitBtnDisabled]}
              onPress={onSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={local.btnLoadingRow}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={local.submitBtnText}>Adding Site...</Text>
                </View>
              ) : (
                <View style={local.btnLoadingRow}>
                  <Ionicons name="add-circle" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={local.submitBtnText}>Add Site</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Status & Validation Modal */}
      <CustomModal
        visible={modalConfig.visible}
        onClose={() => setModalConfig((prev) => ({ ...prev, visible: false }))}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        actions={modalConfig.actions}
      />
    </KeyboardAvoidingView>
  );
}

const getStyles = (isDark: boolean) =>
  StyleSheet.create({
    screenContainer: {
      flex: 1,
      backgroundColor: isDark ? "#09090b" : "#f8fafc",
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: Platform.OS === "ios" ? 20 : 28,
      paddingBottom: 48,
    },
    centeredWrapper: {
      width: "100%",
      maxWidth: 640,
      alignSelf: "center",
    },

    // Header Styles
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 20,
      marginTop: 4,
    },
    backBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: isDark ? "#18181b" : "#ffffff",
      borderWidth: 1,
      borderColor: isDark ? "#27272a" : "#e2e8f0",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    headerTextWrap: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: isDark ? "#fafafa" : "#0f172a",
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 13,
      color: isDark ? "#a1a1aa" : "#64748b",
      marginTop: 2,
    },

    // Card Container
    card: {
      backgroundColor: isDark ? "#18181b" : "#ffffff",
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? "#27272a" : "#edf2f7",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 18,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#27272a" : "#f1f5f9",
    },
    sectionIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: isDark ? "#fafafa" : "#1e293b",
    },
    sectionSubtitle: {
      fontSize: 12,
      color: isDark ? "#71717a" : "#64748b",
      marginTop: 1,
    },

    // Field & Input Styles
    fieldGroup: {
      marginBottom: 16,
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: isDark ? "#e4e4e7" : "#334155",
    },
    requiredStar: {
      color: "#ef4444",
      fontSize: 14,
      marginLeft: 4,
      fontWeight: "700",
    },
    optionalBadge: {
      marginLeft: "auto",
      fontSize: 11,
      fontWeight: "500",
      color: isDark ? "#71717a" : "#94a3b8",
      backgroundColor: isDark ? "#27272a" : "#f1f5f9",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#27272a" : "#f8fafc",
      borderRadius: 12,
      borderWidth: 1.2,
      borderColor: isDark ? "#3f3f46" : "#e2e8f0",
      paddingHorizontal: 12,
      height: 48,
    },
    inputContainerFocused: {
      borderColor: "#059669",
      backgroundColor: isDark ? "#0f231c" : "#f0fdf4",
      shadowColor: "#059669",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
    },
    leadingIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: isDark ? "#fafafa" : "#0f172a",
      height: "100%",
    },
    clearBtn: {
      padding: 4,
    },
    helperText: {
      fontSize: 11.5,
      color: isDark ? "#71717a" : "#64748b",
      marginTop: 5,
      marginLeft: 2,
    },

    // Text Area
    textAreaContainer: {
      backgroundColor: isDark ? "#27272a" : "#f8fafc",
      borderRadius: 12,
      borderWidth: 1.2,
      borderColor: isDark ? "#3f3f46" : "#e2e8f0",
      padding: 12,
    },
    textArea: {
      fontSize: 14,
      color: isDark ? "#fafafa" : "#0f172a",
      minHeight: 85,
    },

    // Action Buttons
    actionsWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 10,
      marginBottom: 20,
    },
    cancelBtn: {
      flex: 1,
      height: 52,
      borderRadius: 12,
      backgroundColor: isDark ? "#27272a" : "#f1f5f9",
      borderWidth: 1,
      borderColor: isDark ? "#3f3f46" : "#e2e8f0",
      justifyContent: "center",
      alignItems: "center",
    },
    cancelBtnText: {
      fontSize: 15,
      fontWeight: "700",
      color: isDark ? "#e4e4e7" : "#475569",
    },
    submitBtn: {
      flex: 2,
      height: 52,
      borderRadius: 12,
      backgroundColor: "#059669",
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#059669",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    submitBtnDisabled: {
      opacity: 0.6,
      shadowOpacity: 0,
    },
    btnLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    submitBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#ffffff",
      letterSpacing: 0.2,
    },
  });

