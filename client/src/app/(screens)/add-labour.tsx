import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { CustomModal, ModalType } from "../../components/CustomModal";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";
import { styles as globalStyles, styles } from "../style/stylesheet";

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

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [rate, setRate] = useState("");
  const [notes, setNotes] = useState("");

  const [sites, setSites] = useState<Site[]>([]);
  const [showSitePicker, setShowSitePicker] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [modalConfig, setModalConfig] = useState<{
    visible: boolean;
    title?: string;
    message?: string;
    type?: ModalType;
    actions?: any[];
  }>({ visible: false });

  const showModal = (title: string, message: string, type: ModalType = 'default', actions?: any[]) => {
    setModalConfig({
      visible: true,
      title,
      message,
      type,
      actions: actions || [{ text: 'OK', onPress: () => setModalConfig(prev => ({ ...prev, visible: false })), style: 'default' }]
    });
  };

  useEffect(() => {
    loadUserAndSites();
  }, []);

  useEffect(() => {
    // If site params passed from supervisor home, set the selected site
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

        // Fetch sites based on role
        if (userData.role === "admin") {
          // Admin can see all sites
          const response = await api.get("/sites");
          const data = await response.json();
          if (response.ok) {
            setSites(data);
          }
        } else if (userData.role === "supervisor") {
          // Supervisor sees only assigned sites
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

  const onSubmit = async () => {
    if (!name.trim()) {
      showModal("Validation", "Please enter the labour name.", 'warning');
      return;
    }

    if (!phone || phone.length !== 10) {
      showModal("Validation", "Please enter a valid 10-digit phone number.", 'warning');
      return;
    }

    if (!password || password.length < 6) {
      showModal("Validation", "Please provide a password (minimum 6 characters).", 'warning');
      return;
    }

    if (aadhaar && aadhaar.length !== 12) {
      showModal("Validation", "Aadhaar number must be 12 digits.", 'warning');
      return;
    }

    if (userRole !== 'supervisor' && (!rate || isNaN(parseFloat(rate)) || parseFloat(rate) <= 0)) {
      showModal("Validation", "Please enter a valid positive hourly rate.", 'warning');
      return;
    }

    try {
      const payload = {
        name,
        phone,
        password,
        aadhaar,
        site: selectedSite?.name || "",
        site_id: selectedSite?.id || null,
        rate,
        notes,
        trade: "General",
        date_of_birth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : null
      };

      const response = await api.post("/labours", payload);

      if (response.ok) {
        const successMsg = userRole === 'supervisor'
          ? "Labour added successfully. It is pending admin approval."
          : "Labour added successfully.";
        showModal("Success", successMsg, 'success', [
          { text: "OK", onPress: () => { setModalConfig(prev => ({ ...prev, visible: false })); router.back(); }, style: 'default' },
        ]);
      } else {
        const errorData = await response.json();
        showModal("Error", errorData.error || "Failed to add labour", 'error');
      }
    } catch (error) {
      console.error(error);
      showModal("Error", "Failed to connect to server", 'error');
    }
  };

  return (
    <ScrollView contentContainerStyle={local.container}>
      <View style={local.header}>
        <Text style={[globalStyles.head1, { color: isDark ? "#fff" : "#000" }]}>Add Labour</Text>
        <Text style={local.sub}>Enter Labour details below</Text>
      </View>

      <View style={local.form}>
        <Text style={[styles.labelname, { color: isDark ? "#aaa" : "#333" }]}>Full name:</Text>
        <TextInput style={local.input} value={name} onChangeText={setName} placeholder="full name" placeholderTextColor={isDark ? "#888" : "#999"} />

        <Text style={[styles.labelname, { color: isDark ? "#aaa" : "#333" }]}>Phone:</Text>
        <TextInput style={local.input} value={phone} onChangeText={setPhone} placeholder="+9197589018" placeholderTextColor={isDark ? "#888" : "#999"} keyboardType="phone-pad" maxLength={10} />

        <Text style={[styles.labelname, { color: isDark ? "#aaa" : "#333" }]}>Password:</Text>
        <TextInput style={local.input} value={password} onChangeText={setPassword} placeholder="Minimum 6 characters" placeholderTextColor={isDark ? "#888" : "#999"} secureTextEntry />

        <Text style={[styles.labelname, { color: isDark ? "#aaa" : "#333" }]}>Aadhaar number:</Text>
        <TextInput style={local.input} value={aadhaar} onChangeText={setAadhaar} placeholder="" placeholderTextColor={isDark ? "#888" : "#999"} keyboardType="phone-pad" maxLength={12} />

        <Text style={[styles.labelname, { color: isDark ? "#aaa" : "#333" }]}>Date of Birth:</Text>
        <TouchableOpacity style={local.input} onPress={() => setShowDatePicker(true)}>
          <Text style={{ color: dateOfBirth ? (isDark ? "#fff" : "#000") : (isDark ? "#888" : "#999"), paddingVertical: 4 }}>
            {dateOfBirth ? formatDate(dateOfBirth) : "Select Date of Birth"}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={dateOfBirth || new Date()}
            mode="date"
            display="default"
            onChange={(event: any, selectedDate?: Date) => {
              setShowDatePicker(false);
              if (selectedDate) setDateOfBirth(selectedDate);
            }}
            maximumDate={new Date()}
          />
        )}

        <Text style={[styles.labelname, { color: isDark ? "#aaa" : "#333" }]}>Job site:</Text>
        <TouchableOpacity
          style={local.siteSelector}
          onPress={() => setShowSitePicker(true)}
        >
          <View style={local.siteSelectorContent}>
            <MaterialIcons name="location-city" size={20} color={selectedSite ? "#0a84ff" : (isDark ? "#888" : "#999")} />
            <Text style={[local.siteSelectorText, !selectedSite && local.siteSelectorPlaceholder]}>
              {selectedSite ? selectedSite.name : "Select a site"}
            </Text>
          </View>
          <MaterialIcons name="arrow-drop-down" size={24} color={isDark ? "#888" : "#666"} />
        </TouchableOpacity>

        {userRole !== 'supervisor' && (
          <>
            <Text style={[styles.labelname, { color: isDark ? "#aaa" : "#333" }]}>Hourly rate:</Text>
            <TextInput style={local.input} value={rate} onChangeText={setRate} placeholder="e.g., 15.00" placeholderTextColor={isDark ? "#888" : "#999"} keyboardType="decimal-pad" />
          </>
        )}

        <Text style={[styles.labelname, { color: isDark ? "#aaa" : "#333" }]}>Notes:</Text>
        <TextInput style={[local.input, { height: 90 }]} value={notes} onChangeText={setNotes} placeholder="Optional notes" placeholderTextColor={isDark ? "#888" : "#999"} multiline />

        <TouchableOpacity style={local.cancelBtn} onPress={() => router.back()}>
          <Text style={local.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity style={local.submit} onPress={onSubmit}>
          <Text style={local.submitText}>Add Labour</Text>
        </TouchableOpacity>
      </View>

      {/* Site Picker Modal */}
      <CustomModal
        visible={showSitePicker}
        onClose={() => setShowSitePicker(false)}
        title="Select Site"
        actions={[{ text: 'Cancel', onPress: () => setShowSitePicker(false), style: 'cancel' }]}
      >
        <View style={{ width: '100%', maxHeight: 300 }}>
          {sites.length === 0 ? (
            <View style={local.emptySites}>
              <MaterialIcons name="location-off" size={48} color={isDark ? "#555" : "#ccc"} />
              <Text style={local.emptySitesText}>
                {userRole === "supervisor"
                  ? "No sites assigned to you"
                  : "No sites available. Create one first."}
              </Text>
            </View>
          ) : (
            <FlatList
              data={sites}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    local.siteOption,
                    selectedSite?.id === item.id && local.siteOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedSite(item);
                    setShowSitePicker(false);
                  }}
                >
                  <MaterialIcons
                    name="location-city"
                    size={20}
                    color={selectedSite?.id === item.id ? "#0a84ff" : (isDark ? "#888" : "#666")}
                  />
                  <View style={local.siteOptionInfo}>
                    <Text style={local.siteOptionName}>{item.name}</Text>
                    {item.address && <Text style={local.siteOptionAddress}>{item.address}</Text>}
                  </View>
                  {selectedSite?.id === item.id && (
                    <MaterialIcons name="check-circle" size={24} color="#0a84ff" />
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </CustomModal>

      <CustomModal
        visible={modalConfig.visible}
        onClose={() => setModalConfig(prev => ({ ...prev, visible: false }))}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        actions={modalConfig.actions}
      />
    </ScrollView>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 40,
    minHeight: "100%",
    backgroundColor: isDark ? "#121212" : "#fff",
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  sub: {
    color: isDark ? "#aaa" : "#666",
    marginTop: 6,
    fontSize: 16,
  },
  form: {
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: isDark ? "#444" : "#e6e6e6",
    padding: 10,
    borderRadius: 8,
    backgroundColor: isDark ? "#2a2a2a" : "#fafafa",
    color: isDark ? "#fff" : "#000",
  },
  siteSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: isDark ? "#444" : "#e6e6e6",
    padding: 12,
    borderRadius: 8,
    backgroundColor: isDark ? "#2a2a2a" : "#fafafa",
  },
  siteSelectorContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  siteSelectorText: {
    fontSize: 16,
    color: isDark ? "#fff" : "#333",
  },
  siteSelectorPlaceholder: {
    color: isDark ? "#888" : "#999",
  },
  cancelBtn: {
    marginTop: 18,
    backgroundColor: isDark ? "#333" : "#ddd",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelBtnText: {
    color: isDark ? "#fff" : "#333",
    fontWeight: "700",
  },
  submit: {
    marginTop: 12,
    backgroundColor: "#eb9834",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  submitText: {
    color: "#fff",
    fontWeight: "700",
  },
  emptySites: {
    alignItems: "center",
    padding: 32,
  },
  emptySitesText: {
    color: isDark ? "#888" : "#999",
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
  },
  siteOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? "#333" : "#f0f0f0",
    gap: 12,
  },
  siteOptionSelected: {
    backgroundColor: isDark ? "#1a3b5c" : "#e8f4ff",
  },
  siteOptionInfo: {
    flex: 1,
  },
  siteOptionName: {
    fontSize: 16,
    fontWeight: "500",
    color: isDark ? "#fff" : "#333",
  },
  siteOptionAddress: {
    fontSize: 14,
    color: isDark ? "#aaa" : "#666",
    marginTop: 2,
  },
});
