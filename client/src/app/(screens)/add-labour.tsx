import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

interface Site {
  id: number;
  name: string;
  address: string;
}

export default function AddLabour() {
  const router = useRouter();
  const { isDark } = useTheme();
  const local = getStyles(isDark);
  const params = useLocalSearchParams<{ siteId?: string; siteName?: string }>();

  // Form States
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [aadhaar, setAadhaar] = useState("");
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [rate, setRate] = useState("");
  const [openingWorkingDays, setOpeningWorkingDays] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [notes, setNotes] = useState("");

  // Site & Datepicker States
  const [sites, setSites] = useState<Site[]>([]);
  const [siteSearchQuery, setSiteSearchQuery] = useState("");
  const [showSitePicker, setShowSitePicker] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // App & User States
  const [userRole, setUserRole] = useState<string>("");
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

  useEffect(() => {
    loadUserAndSites();
  }, []);

  useEffect(() => {
    if (params.siteId && params.siteName) {
      setSelectedSite({
        id: parseInt(params.siteId),
        name: decodeURIComponent(params.siteName),
        address: "",
      });
    }
  }, [params.siteId, params.siteName]);

  const loadUserAndSites = async () => {
    try {
      const userDataStr = await AsyncStorage.getItem("userData");
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        setUserRole(userData.role);

        if (userData.role === "admin") {
          const response = await api.get("/sites?status=active");
          const data = await response.json();
          if (response.ok) {
            setSites(data);
          }
        } else if (userData.role === "supervisor" || userData.role === "special_supervisor") {
          const response = await api.get(`/sites/supervisor/${userData.id}`);
          const data = await response.json();
          if (response.ok) {
            setSites(data);
          }
        }
      }
    } catch (error) {
      console.error("Error loading user/sites:", error);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Filtered sites for searchable site picker modal
  const filteredSites = useMemo(() => {
    if (!siteSearchQuery.trim()) return sites;
    const query = siteSearchQuery.toLowerCase();
    return sites.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        (s.address && s.address.toLowerCase().includes(query))
    );
  }, [sites, siteSearchQuery]);

  const onSubmit = async () => {
    if (!name.trim()) {
      showModal("Required Field", "Please enter the labour full name.", "warning");
      return;
    }

    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length !== 10 || !/^\d{10}$/.test(cleanPhone)) {
      showModal("Validation Error", "Please enter a valid 10-digit mobile number.", "warning");
      return;
    }

    if (!password || password.length < 6) {
      showModal(
        "Validation Error",
        "Please provide a secure password (minimum 6 characters).",
        "warning"
      );
      return;
    }

    const cleanAadhaar = aadhaar.trim();
    if (cleanAadhaar && (cleanAadhaar.length !== 12 || !/^\d{12}$/.test(cleanAadhaar))) {
      showModal("Validation Error", "Aadhaar number must be exactly 12 digits.", "warning");
      return;
    }

    if (
      userRole !== "supervisor" &&
      (!rate || isNaN(parseFloat(rate)) || parseFloat(rate) <= 0)
    ) {
      showModal(
        "Validation Error",
        "Please enter a valid positive daily wage rate.",
        "warning"
      );
      return;
    }

    if (
      openingWorkingDays &&
      (isNaN(parseFloat(openingWorkingDays)) || parseFloat(openingWorkingDays) < 0)
    ) {
      showModal(
        "Validation Error",
        "Opening working days must be a valid non-negative number.",
        "warning"
      );
      return;
    }

    if (openingBalance && isNaN(parseFloat(openingBalance))) {
      showModal(
        "Validation Error",
        "Opening balance must be a valid numerical amount.",
        "warning"
      );
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        phone: cleanPhone,
        password: password.trim(),
        aadhaar: cleanAadhaar,
        site: selectedSite?.name || "",
        site_id: selectedSite?.id || null,
        daily_wage: rate ? parseFloat(rate) : null,
        opening_working_days: openingWorkingDays ? parseFloat(openingWorkingDays) : 0,
        opening_balance: openingBalance ? parseFloat(openingBalance) : 0,
        notes: notes.trim(),
        date_of_birth: dateOfBirth ? dateOfBirth.toISOString().split("T")[0] : null,
      };

      const response = await api.post("/labours", payload);

      if (response.ok) {
        const successMsg =
          userRole === "supervisor"
            ? "Labour added successfully. It is pending admin approval."
            : "Labour profile created successfully.";

        if (Platform.OS === "web") {
          window.alert(successMsg);
        } else {
          Alert.alert("Success", successMsg);
        }
        router.back();
      } else {
        const errorData = await response.json();
        showModal("Error", errorData.error || "Failed to add labour", "error");
      }
    } catch (error) {
      console.error("Add labour error:", error);
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
              <Text style={local.headerTitle}>Add New Labour</Text>
              <Text style={local.headerSubtitle}>
                Register worker profile and configure assignment
              </Text>
            </View>
          </View>

          {/* SECTION 1: Personal Information */}
          <View style={local.card}>
            <View style={local.sectionHeader}>
              <View style={[local.sectionIconWrap, { backgroundColor: isDark ? "#2d2417" : "#fff7ed" }]}>
                <Ionicons name="person" size={18} color="#ea580c" />
              </View>
              <View>
                <Text style={local.sectionTitle}>Personal Details</Text>
                <Text style={local.sectionSubtitle}>Basic identification & contact info</Text>
              </View>
            </View>

            {/* Full Name */}
            <View style={local.fieldGroup}>
              <View style={local.labelRow}>
                <Text style={local.label}>Full Name</Text>
                <Text style={local.requiredStar}>*</Text>
              </View>
              <View
                style={[
                  local.inputContainer,
                  focusedField === "name" && local.inputContainerFocused,
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={19}
                  color={focusedField === "name" ? "#ea580c" : isDark ? "#71717a" : "#9ca3af"}
                  style={local.leadingIcon}
                />
                <TextInput
                  style={local.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Ramesh Kumar"
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
            </View>

            {/* Phone Number */}
            <View style={local.fieldGroup}>
              <View style={local.labelRow}>
                <Text style={local.label}>Mobile Phone Number</Text>
                <Text style={local.requiredStar}>*</Text>
              </View>
              <View
                style={[
                  local.inputContainer,
                  focusedField === "phone" && local.inputContainerFocused,
                ]}
              >
                <View style={local.phonePrefix}>
                  <Ionicons
                    name="call-outline"
                    size={17}
                    color={focusedField === "phone" ? "#ea580c" : isDark ? "#71717a" : "#9ca3af"}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={local.phonePrefixText}>+91</Text>
                </View>
                <View style={local.prefixDivider} />
                <TextInput
                  style={local.input}
                  value={phone}
                  onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ""))}
                  placeholder="98765 43210"
                  placeholderTextColor={isDark ? "#71717a" : "#9ca3af"}
                  keyboardType="phone-pad"
                  maxLength={10}
                  onFocus={() => setFocusedField("phone")}
                  onBlur={() => setFocusedField(null)}
                />
                <Text style={local.charCounter}>{phone.length}/10</Text>
              </View>
              <Text style={local.helperText}>Used as the login username for the worker app</Text>
            </View>

            {/* Date of Birth */}
            <View style={local.fieldGroup}>
              <View style={local.labelRow}>
                <Text style={local.label}>Date of Birth</Text>
                <Text style={local.optionalBadge}>Optional</Text>
              </View>

              {Platform.OS === "web" ? (
                <View
                  style={[
                    local.inputContainer,
                    focusedField === "dob" && local.inputContainerFocused,
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={19}
                    color={isDark ? "#71717a" : "#9ca3af"}
                    style={local.leadingIcon}
                  />
                  <input
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    value={dateOfBirth ? dateOfBirth.toISOString().split("T")[0] : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDateOfBirth(val ? new Date(val + "T00:00:00") : null);
                    }}
                    onFocus={() => setFocusedField("dob")}
                    onBlur={() => setFocusedField(null)}
                    style={{
                      border: "none",
                      outline: "none",
                      backgroundColor: "transparent",
                      color: isDark ? "#f4f4f5" : "#18181b",
                      fontSize: 15,
                      width: "100%",
                      fontFamily: "inherit",
                    }}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      local.inputContainer,
                      focusedField === "dob" && local.inputContainerFocused,
                    ]}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={19}
                      color={isDark ? "#71717a" : "#9ca3af"}
                      style={local.leadingIcon}
                    />
                    <Text
                      style={[
                        local.pickerText,
                        !dateOfBirth && local.placeholderColor,
                      ]}
                    >
                      {dateOfBirth ? formatDate(dateOfBirth) : "Select Date of Birth"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={18}
                      color={isDark ? "#71717a" : "#9ca3af"}
                    />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={dateOfBirth || new Date(2000, 0, 1)}
                      mode="date"
                      display="default"
                      maximumDate={new Date()}
                      onChange={(event: any, selectedDate?: Date) => {
                        setShowDatePicker(false);
                        if (selectedDate) setDateOfBirth(selectedDate);
                      }}
                    />
                  )}
                </>
              )}
            </View>

            {/* Aadhaar Number */}
            <View style={[local.fieldGroup, { marginBottom: 0 }]}>
              <View style={local.labelRow}>
                <Text style={local.label}>Aadhaar Card Number</Text>
                <Text style={local.optionalBadge}>Optional</Text>
              </View>
              <View
                style={[
                  local.inputContainer,
                  focusedField === "aadhaar" && local.inputContainerFocused,
                ]}
              >
                <Ionicons
                  name="card-outline"
                  size={19}
                  color={focusedField === "aadhaar" ? "#ea580c" : isDark ? "#71717a" : "#9ca3af"}
                  style={local.leadingIcon}
                />
                <TextInput
                  style={local.input}
                  value={aadhaar}
                  onChangeText={(text) => setAadhaar(text.replace(/[^0-9]/g, ""))}
                  placeholder="12-digit UIDAI number"
                  placeholderTextColor={isDark ? "#71717a" : "#9ca3af"}
                  keyboardType="phone-pad"
                  maxLength={12}
                  onFocus={() => setFocusedField("aadhaar")}
                  onBlur={() => setFocusedField(null)}
                />
                {aadhaar.length > 0 && (
                  <Text style={local.charCounter}>{aadhaar.length}/12</Text>
                )}
              </View>
            </View>
          </View>

          {/* SECTION 2: Security & Login Credentials */}
          <View style={local.card}>
            <View style={local.sectionHeader}>
              <View style={[local.sectionIconWrap, { backgroundColor: isDark ? "#1e293b" : "#f0f9ff" }]}>
                <Ionicons name="lock-closed" size={18} color="#0284c7" />
              </View>
              <View>
                <Text style={local.sectionTitle}>Security & Credentials</Text>
                <Text style={local.sectionSubtitle}>Access credentials for worker login</Text>
              </View>
            </View>

            <View style={[local.fieldGroup, { marginBottom: 0 }]}>
              <View style={local.labelRow}>
                <Text style={local.label}>Worker Password</Text>
                <Text style={local.requiredStar}>*</Text>
              </View>
              <View
                style={[
                  local.inputContainer,
                  focusedField === "password" && local.inputContainerFocused,
                ]}
              >
                <Ionicons
                  name="key-outline"
                  size={19}
                  color={focusedField === "password" ? "#0284c7" : isDark ? "#71717a" : "#9ca3af"}
                  style={local.leadingIcon}
                />
                <TextInput
                  style={local.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={isDark ? "#71717a" : "#9ca3af"}
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={local.eyeBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={isDark ? "#9ca3af" : "#6b7280"}
                  />
                </TouchableOpacity>
              </View>
              <Text style={local.helperText}>Minimum 6 characters required for security</Text>
            </View>
          </View>

          {/* SECTION 3: Job Site & Wage Assignment */}
          <View style={local.card}>
            <View style={local.sectionHeader}>
              <View style={[local.sectionIconWrap, { backgroundColor: isDark ? "#143328" : "#ecfdf5" }]}>
                <Ionicons name="business" size={18} color="#059669" />
              </View>
              <View>
                <Text style={local.sectionTitle}>Work & Site Assignment</Text>
                <Text style={local.sectionSubtitle}>Designate workplace and compensation</Text>
              </View>
            </View>

            {/* Site Picker Trigger */}
            <View style={local.fieldGroup}>
              <View style={local.labelRow}>
                <Text style={local.label}>Job Site</Text>
                <Text style={local.optionalBadge}>Optional</Text>
              </View>
              <TouchableOpacity
                style={[
                  local.siteCard,
                  selectedSite && local.siteCardSelected,
                ]}
                onPress={() => {
                  setSiteSearchQuery("");
                  setShowSitePicker(true);
                }}
                activeOpacity={0.7}
              >
                <View style={local.siteCardLeft}>
                  <View
                    style={[
                      local.siteBadgeIcon,
                      selectedSite && { backgroundColor: isDark ? "#064e3b" : "#d1fae5" },
                    ]}
                  >
                    <MaterialIcons
                      name="location-city"
                      size={22}
                      color={selectedSite ? "#059669" : isDark ? "#71717a" : "#9ca3af"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        local.siteCardTitle,
                        !selectedSite && local.placeholderColor,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedSite ? selectedSite.name : "Assign to a job site"}
                    </Text>
                    {selectedSite?.address ? (
                      <Text style={local.siteCardAddress} numberOfLines={1}>
                        {selectedSite.address}
                      </Text>
                    ) : (
                      <Text style={local.siteCardHelp}>
                        {selectedSite ? "Site selected" : "Tap to browse available sites"}
                      </Text>
                    )}
                  </View>
                </View>

                {selectedSite ? (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      setSelectedSite(null);
                    }}
                    style={local.clearSiteBtn}
                  >
                    <Ionicons name="close" size={18} color={isDark ? "#a1a1aa" : "#64748b"} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={isDark ? "#71717a" : "#9ca3af"} />
                )}
              </TouchableOpacity>
            </View>

            {/* Daily Wage Rate (Admin only) */}
            {userRole !== "supervisor" && (
              <View style={[local.fieldGroup, { marginBottom: 0 }]}>
                <View style={local.labelRow}>
                  <Text style={local.label}>Daily Wage Rate</Text>
                  <Text style={local.requiredStar}>*</Text>
                </View>
                <View
                  style={[
                    local.inputContainer,
                    focusedField === "rate" && local.inputContainerFocused,
                  ]}
                >
                  <View style={local.currencyPrefix}>
                    <Text style={local.currencySymbol}>₹</Text>
                  </View>
                  <View style={local.prefixDivider} />
                  <TextInput
                    style={local.input}
                    value={rate}
                    onChangeText={setRate}
                    placeholder="e.g. 500.00"
                    placeholderTextColor={isDark ? "#71717a" : "#9ca3af"}
                    keyboardType="decimal-pad"
                    onFocus={() => setFocusedField("rate")}
                    onBlur={() => setFocusedField(null)}
                  />
                  <Text style={local.perDaySuffix}>/ day</Text>
                </View>
                <Text style={local.helperText}>Base salary paid per full working day</Text>
              </View>
            )}
          </View>

          {/* SECTION 4: Opening Balances & Historical Data */}
          <View style={local.card}>
            <View style={local.sectionHeader}>
              <View style={[local.sectionIconWrap, { backgroundColor: isDark ? "#312e81" : "#eef2ff" }]}>
                <Ionicons name="time" size={18} color="#4f46e5" />
              </View>
              <View>
                <Text style={local.sectionTitle}>Opening Balances</Text>
                <Text style={local.sectionSubtitle}>Pre-existing balances & working milestone days</Text>
              </View>
            </View>

            <View style={local.twoColGrid}>
              {/* Opening Working Days */}
              <View style={local.gridCol}>
                <View style={local.labelRow}>
                  <Text style={local.label}>Opening Days</Text>
                </View>
                <View
                  style={[
                    local.inputContainer,
                    focusedField === "openingDays" && local.inputContainerFocused,
                  ]}
                >
                  <Ionicons
                    name="calendar-number-outline"
                    size={18}
                    color={focusedField === "openingDays" ? "#4f46e5" : isDark ? "#71717a" : "#9ca3af"}
                    style={local.leadingIcon}
                  />
                  <TextInput
                    style={local.input}
                    value={openingWorkingDays}
                    onChangeText={setOpeningWorkingDays}
                    placeholder="e.g. 100"
                    placeholderTextColor={isDark ? "#71717a" : "#9ca3af"}
                    keyboardType="numeric"
                    onFocus={() => setFocusedField("openingDays")}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
                <Text style={local.smallHelperText}>For bonus cycle calculation</Text>
              </View>

              {/* Opening Balance */}
              <View style={local.gridCol}>
                <View style={local.labelRow}>
                  <Text style={local.label}>Opening Balance</Text>
                </View>
                <View
                  style={[
                    local.inputContainer,
                    focusedField === "openingBalance" && local.inputContainerFocused,
                  ]}
                >
                  <View style={local.currencyPrefixMini}>
                    <Text style={local.currencySymbolMini}>₹</Text>
                  </View>
                  <TextInput
                    style={local.input}
                    value={openingBalance}
                    onChangeText={setOpeningBalance}
                    placeholder="e.g. 2000"
                    placeholderTextColor={isDark ? "#71717a" : "#9ca3af"}
                    keyboardType="numbers-and-punctuation"
                    onFocus={() => setFocusedField("openingBalance")}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
                <Text style={local.smallHelperText}>Existing advance/pending</Text>
              </View>
            </View>
          </View>

          {/* SECTION 5: Additional Remarks & Notes */}
          <View style={local.card}>
            <View style={local.sectionHeader}>
              <View style={[local.sectionIconWrap, { backgroundColor: isDark ? "#27272a" : "#f4f4f5" }]}>
                <Ionicons name="document-text" size={18} color={isDark ? "#a1a1aa" : "#52525b"} />
              </View>
              <View>
                <Text style={local.sectionTitle}>Additional Notes</Text>
                <Text style={local.sectionSubtitle}>Special skills, emergency contacts, or remarks</Text>
              </View>
            </View>

            <View
              style={[
                local.textAreaContainer,
                focusedField === "notes" && local.inputContainerFocused,
              ]}
            >
              <TextInput
                style={local.textArea}
                value={notes}
                onChangeText={setNotes}
                placeholder="Enter any additional remarks, skills, or emergency contact details..."
                placeholderTextColor={isDark ? "#71717a" : "#9ca3af"}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                onFocus={() => setFocusedField("notes")}
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
                  <Text style={local.submitBtnText}>Adding Labour...</Text>
                </View>
              ) : (
                <View style={local.btnLoadingRow}>
                  <Ionicons name="person-add" size={19} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={local.submitBtnText}>Add Labour</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Searchable Site Picker Modal */}
      <CustomModal
        visible={showSitePicker}
        onClose={() => setShowSitePicker(false)}
        title="Select Job Site"
        actions={[
          {
            text: "Cancel",
            onPress: () => setShowSitePicker(false),
            style: "cancel",
          },
        ]}
      >
        <View style={local.modalInner}>
          {/* Search Box */}
          <View style={local.modalSearchContainer}>
            <Ionicons name="search" size={18} color={isDark ? "#71717a" : "#9ca3af"} />
            <TextInput
              style={local.modalSearchInput}
              placeholder="Search site by name or address..."
              placeholderTextColor={isDark ? "#71717a" : "#9ca3af"}
              value={siteSearchQuery}
              onChangeText={setSiteSearchQuery}
              autoCorrect={false}
            />
            {siteSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSiteSearchQuery("")}>
                <Ionicons name="close-circle" size={16} color={isDark ? "#71717a" : "#9ca3af"} />
              </TouchableOpacity>
            )}
          </View>

          {/* List or Empty State */}
          <View style={{ maxHeight: 320, width: "100%" }}>
            {filteredSites.length === 0 ? (
              <View style={local.emptySitesBox}>
                <MaterialIcons
                  name="location-off"
                  size={42}
                  color={isDark ? "#52525b" : "#cbd5e1"}
                />
                <Text style={local.emptySitesTitle}>
                  {sites.length === 0 ? "No Sites Found" : "No Matching Sites"}
                </Text>
                <Text style={local.emptySitesSubtitle}>
                  {sites.length === 0
                    ? userRole === "supervisor"
                      ? "No sites assigned to you currently."
                      : "No active sites available in system."
                    : "Try adjusting your search query."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredSites}
                keyExtractor={(item) => item.id.toString()}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isSelected = selectedSite?.id === item.id;
                  return (
                    <TouchableOpacity
                      style={[
                        local.siteItemRow,
                        isSelected && local.siteItemRowSelected,
                      ]}
                      onPress={() => {
                        setSelectedSite(item);
                        setShowSitePicker(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          local.siteItemIcon,
                          isSelected && { backgroundColor: isDark ? "#064e3b" : "#d1fae5" },
                        ]}
                      >
                        <MaterialIcons
                          name="location-city"
                          size={20}
                          color={isSelected ? "#059669" : isDark ? "#a1a1aa" : "#64748b"}
                        />
                      </View>
                      <View style={local.siteItemContent}>
                        <Text
                          style={[
                            local.siteItemName,
                            isSelected && { color: isDark ? "#34d399" : "#059669", fontWeight: "700" },
                          ]}
                        >
                          {item.name}
                        </Text>
                        {item.address ? (
                          <Text style={local.siteItemAddress} numberOfLines={1}>
                            {item.address}
                          </Text>
                        ) : null}
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={22} color="#059669" />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </CustomModal>

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
      borderColor: "#ea580c",
      backgroundColor: isDark ? "#1f1d1b" : "#fffaf5",
      shadowColor: "#ea580c",
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
    eyeBtn: {
      padding: 6,
    },
    pickerText: {
      flex: 1,
      fontSize: 15,
      color: isDark ? "#fafafa" : "#0f172a",
    },
    placeholderColor: {
      color: isDark ? "#71717a" : "#9ca3af",
    },
    helperText: {
      fontSize: 11.5,
      color: isDark ? "#71717a" : "#64748b",
      marginTop: 5,
      marginLeft: 2,
    },
    smallHelperText: {
      fontSize: 11,
      color: isDark ? "#71717a" : "#94a3b8",
      marginTop: 4,
      marginLeft: 2,
    },
    charCounter: {
      fontSize: 12,
      color: isDark ? "#71717a" : "#94a3b8",
      marginLeft: 6,
    },

    // Prefix Styles
    phonePrefix: {
      flexDirection: "row",
      alignItems: "center",
      paddingRight: 8,
    },
    phonePrefixText: {
      fontSize: 14,
      fontWeight: "600",
      color: isDark ? "#e4e4e7" : "#334155",
    },
    prefixDivider: {
      width: 1,
      height: 22,
      backgroundColor: isDark ? "#3f3f46" : "#cbd5e1",
      marginRight: 10,
    },
    currencyPrefix: {
      paddingRight: 8,
    },
    currencySymbol: {
      fontSize: 16,
      fontWeight: "700",
      color: isDark ? "#e4e4e7" : "#0f172a",
    },
    currencyPrefixMini: {
      marginRight: 8,
    },
    currencySymbolMini: {
      fontSize: 15,
      fontWeight: "700",
      color: isDark ? "#a1a1aa" : "#64748b",
    },
    perDaySuffix: {
      fontSize: 13,
      fontWeight: "600",
      color: isDark ? "#71717a" : "#64748b",
      marginLeft: 6,
    },

    // Site Card Selector
    siteCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: isDark ? "#27272a" : "#f8fafc",
      borderRadius: 12,
      borderWidth: 1.2,
      borderColor: isDark ? "#3f3f46" : "#e2e8f0",
      padding: 12,
    },
    siteCardSelected: {
      borderColor: "#059669",
      backgroundColor: isDark ? "#0f231c" : "#f0fdf4",
    },
    siteCardLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: 12,
    },
    siteBadgeIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: isDark ? "#3f3f46" : "#e2e8f0",
      justifyContent: "center",
      alignItems: "center",
    },
    siteCardTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: isDark ? "#fafafa" : "#0f172a",
    },
    siteCardAddress: {
      fontSize: 12,
      color: isDark ? "#a1a1aa" : "#64748b",
      marginTop: 2,
    },
    siteCardHelp: {
      fontSize: 12,
      color: isDark ? "#71717a" : "#94a3b8",
      marginTop: 2,
    },
    clearSiteBtn: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: isDark ? "#3f3f46" : "#e2e8f0",
    },

    // Grid Layout
    twoColGrid: {
      flexDirection: "row",
      gap: 12,
    },
    gridCol: {
      flex: 1,
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
      minHeight: 70,
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
      backgroundColor: "#ea580c",
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#ea580c",
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

    // Modal Components
    modalInner: {
      width: "100%",
    },
    modalSearchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#27272a" : "#f1f5f9",
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 42,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: isDark ? "#3f3f46" : "#e2e8f0",
    },
    modalSearchInput: {
      flex: 1,
      fontSize: 14,
      color: isDark ? "#fafafa" : "#0f172a",
      marginLeft: 8,
    },
    emptySitesBox: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 32,
      paddingHorizontal: 16,
    },
    emptySitesTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: isDark ? "#e4e4e7" : "#334155",
      marginTop: 10,
    },
    emptySitesSubtitle: {
      fontSize: 13,
      color: isDark ? "#71717a" : "#64748b",
      textAlign: "center",
      marginTop: 4,
    },
    siteItemRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#27272a" : "#f1f5f9",
      gap: 12,
    },
    siteItemRowSelected: {
      backgroundColor: isDark ? "#0f231c" : "#f0fdf4",
    },
    siteItemIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: isDark ? "#27272a" : "#f1f5f9",
      justifyContent: "center",
      alignItems: "center",
    },
    siteItemContent: {
      flex: 1,
    },
    siteItemName: {
      fontSize: 15,
      fontWeight: "600",
      color: isDark ? "#fafafa" : "#1e293b",
    },
    siteItemAddress: {
      fontSize: 12,
      color: isDark ? "#a1a1aa" : "#64748b",
      marginTop: 2,
    },
  });

