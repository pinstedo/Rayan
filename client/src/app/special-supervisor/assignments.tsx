import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AdvanceModal } from "../../components/AdvanceModal";
import { CustomModal, ModalType } from "../../components/CustomModal";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";

interface Site {
  id: number;
  name: string;
  address?: string;
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

type SiteStatusFilter = "all" | "active" | "leave";

export default function SpecialSupervisorAssignments() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const local = getStyles(isDark, colors);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [labours, setLabours] = useState<Labour[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  // Search & Filter for labours assigned to currently selected site
  const [siteWorkerQuery, setSiteWorkerQuery] = useState("");
  const [siteStatusFilter, setSiteStatusFilter] = useState<SiteStatusFilter>("all");

  // Site Picker Modal
  const [sitePickerVisible, setSitePickerVisible] = useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = useState("");
  const [sitePickerTab, setSitePickerTab] = useState<"assigned" | "all">("assigned");
  const [assignedSiteIds, setAssignedSiteIds] = useState<Set<number>>(new Set());

  // Assign Labour Modal
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignSearchQuery, setAssignSearchQuery] = useState("");
  const [assignFilter, setAssignFilter] = useState<"unassigned" | "all">("unassigned");
  const [selectedLabourIds, setSelectedLabourIds] = useState<number[]>([]);
  const [assigningBatch, setAssigningBatch] = useState(false);

  // Transfer Modal
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [labourToTransfer, setLabourToTransfer] = useState<Labour | null>(null);

  // Advance Modal & Global Labour Picker for Advance
  const [advanceModalVisible, setAdvanceModalVisible] = useState(false);
  const [selectedLabourForAdvance, setSelectedLabourForAdvance] = useState<Labour | null>(null);
  const [globalAdvancePickerVisible, setGlobalAdvancePickerVisible] = useState(false);
  const [globalAdvanceSearchQuery, setGlobalAdvanceSearchQuery] = useState("");
  const [globalAdvanceFilter, setGlobalAdvanceFilter] = useState<"all" | "unassigned" | "site">("all");

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [modal, setModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: ModalType;
  }>({
    visible: false,
    title: "",
    message: "",
    type: "default",
  });

  const showModal = (title: string, message: string, type: ModalType = "default") => {
    setModal({ visible: true, title, message, type });
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userDataStr = await AsyncStorage.getItem("userData");
        if (userDataStr) {
          const user = JSON.parse(userDataStr);
          setCurrentUserId(user.id);
        }
      } catch (e) {
        console.error("Failed to load user data", e);
      }
    };
    loadUser();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const userDataStr = await AsyncStorage.getItem("userData");
      let userId = null;
      if (userDataStr) {
        const user = JSON.parse(userDataStr);
        userId = user.id;
        setCurrentUserId(user.id);
      }

      const [allSitesRes, assignedSitesRes, laboursRes] = await Promise.all([
        api.get("/sites?status=active"),
        userId ? api.get(`/sites/supervisor/${userId}`) : Promise.resolve({ ok: false, json: async () => [] }),
        api.get("/labours"),
      ]);

      const allSitesData = await allSitesRes.json();
      const assignedSitesData = assignedSitesRes.ok ? await assignedSitesRes.json() : [];
      const laboursData = await laboursRes.json();

      const assignedIds = new Set((Array.isArray(assignedSitesData) ? assignedSitesData : []).map((s: Site) => s.id));
      setAssignedSiteIds(assignedIds);

      if (allSitesRes.ok) {
        const sortedSites = Array.isArray(allSitesData) ? [...allSitesData].sort((a: Site, b: Site) => (a.name || "").localeCompare(b.name || "")) : [];
        setSites(sortedSites);

        setSelectedSite((current) => {
          if (current) {
            const updated = sortedSites.find((s: Site) => s.id === current.id);
            if (updated) return updated;
          }
          // Default to first assigned site if available, else first active site
          const firstAssigned = sortedSites.find((s: Site) => assignedIds.has(s.id));
          return firstAssigned || sortedSites[0] || null;
        });
      }

      if (laboursRes.ok) {
        setLabours(Array.isArray(laboursData) ? laboursData : []);
      }
    } catch (error) {
      console.error("Special supervisor fetch error:", error);
      showModal("Error", "Unable to load assignments data", "error");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  // Labours currently working on the selected active site
  const siteLabours = useMemo(() => {
    if (!selectedSite) return [];
    return labours.filter(
      (l) => l.site_id === selectedSite.id || (l.site && l.site.toLowerCase() === selectedSite.name.toLowerCase())
    );
  }, [labours, selectedSite]);

  // Filtered labours for the main view (only on active site)
  const filteredSiteLabours = useMemo(() => {
    const text = siteWorkerQuery.trim().toLowerCase();
    return siteLabours
      .filter((labour) => {
        if (siteStatusFilter === "all") return true;
        return (labour.status || "active") === siteStatusFilter;
      })
      .filter((labour) => {
        if (!text) return true;
        return `${labour.name} ${labour.phone || ""}`.toLowerCase().includes(text);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [siteLabours, siteWorkerQuery, siteStatusFilter]);

  // Labours available to assign to this site
  const assignableLabours = useMemo(() => {
    const text = assignSearchQuery.trim().toLowerCase();
    return labours
      .filter((l) => {
        if (assignFilter === "unassigned") {
          return !l.site_id || l.status === "unassigned";
        }
        return selectedSite ? l.site_id !== selectedSite.id : true;
      })
      .filter((l) => {
        if (!text) return true;
        return `${l.name} ${l.phone || ""} ${l.site || ""}`.toLowerCase().includes(text);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [labours, assignFilter, assignSearchQuery, selectedSite]);

  // All labours matching search for Advance picker
  const filteredAllLaboursForAdvance = useMemo(() => {
    const text = globalAdvanceSearchQuery.trim().toLowerCase();
    return labours
      .filter((l) => {
        if (globalAdvanceFilter === "unassigned") {
          return !l.site_id || l.status === "unassigned";
        }
        if (globalAdvanceFilter === "site" && selectedSite) {
          return l.site_id === selectedSite.id || (l.site && l.site.toLowerCase() === selectedSite.name.toLowerCase());
        }
        return true;
      })
      .filter((l) => {
        if (!text) return true;
        return `${l.name} ${l.phone || ""} ${l.site || ""}`.toLowerCase().includes(text);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [labours, globalAdvanceFilter, globalAdvanceSearchQuery, selectedSite]);

  // Sites matching search in site picker modal
  const filteredSites = useMemo(() => {
    const text = siteSearchQuery.trim().toLowerCase();
    let result = sites;
    if (sitePickerTab === "assigned") {
      result = sites.filter((s) => assignedSiteIds.has(s.id));
    }
    if (!text) return result;
    return result.filter(
      (s) =>
        s.name.toLowerCase().includes(text) ||
        (s.address && s.address.toLowerCase().includes(text))
    );
  }, [sites, assignedSiteIds, sitePickerTab, siteSearchQuery]);

  const logout = async () => {
    await AsyncStorage.multiRemove(["token", "refreshToken", "userData"]);
    router.replace("/auth/verificationau" as any);
  };

  const runAction = async (labourId: number, action: () => Promise<Response>, successMsg: string) => {
    try {
      setBusyId(labourId);
      const response = await action();
      const body = await response.json();
      if (response.ok) {
        showModal("Success", successMsg, "success");
        await fetchData();
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

  const unassignLabour = (labour: Labour) => {
    if (!selectedSite) return;
    runAction(
      labour.id,
      () => api.delete(`/sites/${labour.site_id || selectedSite.id}/unassign-labour/${labour.id}`),
      `${labour.name} unassigned from ${selectedSite.name}`
    );
  };

  const changeStatus = (labour: Labour, newStatus: "leave" | "unassigned" | "active") => {
    runAction(
      labour.id,
      () => api.put(`/labours/${labour.id}/status`, { status: newStatus }),
      `${labour.name} status updated to ${newStatus}`
    );
  };

  const toggleLabourSelection = (id: number) => {
    setSelectedLabourIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllAssignable = () => {
    if (selectedLabourIds.length === assignableLabours.length) {
      setSelectedLabourIds([]);
    } else {
      setSelectedLabourIds(assignableLabours.map((l) => l.id));
    }
  };

  const handleSingleAssign = async (labour: Labour) => {
    if (!selectedSite) {
      showModal("Select Site", "Please select an active site first.", "warning");
      return;
    }
    await runAction(
      labour.id,
      () => api.post(`/sites/${selectedSite.id}/assign-labour`, { labour_id: labour.id }),
      `${labour.name} assigned to ${selectedSite.name}`
    );
  };

  const handleBatchAssign = async () => {
    if (!selectedSite) {
      showModal("Select Site", "Please select an active site first.", "warning");
      return;
    }
    if (selectedLabourIds.length === 0) {
      showModal("No Selection", "Please select at least one labour to assign.", "warning");
      return;
    }

    try {
      setAssigningBatch(true);
      let successCount = 0;
      let failCount = 0;
      let lastErrorMessage = "";

      for (const labourId of selectedLabourIds) {
        try {
          const res = await api.post(`/sites/${selectedSite.id}/assign-labour`, { labour_id: labourId });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            successCount++;
          } else {
            failCount++;
            lastErrorMessage = data.error || "Assignment failed";
          }
        } catch (err: any) {
          failCount++;
          lastErrorMessage = err?.message || "Network error";
        }
      }

      setSelectedLabourIds([]);
      setAssignModalVisible(false);
      await fetchData();

      if (failCount === 0) {
        showModal("Success", `Successfully assigned ${successCount} labour(s) to ${selectedSite.name}.`, "success");
      } else {
        showModal(
          successCount > 0 ? "Partial Complete" : "Assignment Failed",
          `Assigned ${successCount} labour(s). ${failCount} failed.${lastErrorMessage ? ` (${lastErrorMessage})` : ""}`,
          successCount > 0 ? "warning" : "error"
        );
      }
    } finally {
      setAssigningBatch(false);
    }
  };

  const handleTransferLabour = async (targetSite: Site) => {
    if (!labourToTransfer) return;
    setTransferModalVisible(false);
    await runAction(
      labourToTransfer.id,
      () => api.post(`/sites/${targetSite.id}/assign-labour`, { labour_id: labourToTransfer.id }),
      `${labourToTransfer.name} transferred to ${targetSite.name}`
    );
    setLabourToTransfer(null);
  };

  // Render Labour on current active site
  const renderSiteLabour = ({ item }: { item: Labour }) => {
    const disabled = busyId === item.id;
    const isLeave = item.status === "leave";

    return (
      <View style={local.labourCard}>
        <View style={local.labourTop}>
          <View style={local.avatarCircle}>
            <MaterialIcons name="person" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={local.labourName}>{item.name}</Text>
            <Text style={local.labourSub}>{item.phone || "No phone number"}</Text>
          </View>
          <View style={[local.badgeContainer, isLeave ? local.leaveBadge : local.activeBadge]}>
            <Text style={[local.badgeText, isLeave ? local.leaveBadgeText : local.activeBadgeText]}>
              {isLeave ? "On Leave" : "Active"}
            </Text>
          </View>
        </View>

        <View style={local.actionRow}>
          {/* Direct Advance Button */}
          <TouchableOpacity
            style={[local.advanceButton, disabled && local.disabled]}
            disabled={disabled}
            onPress={() => {
              setSelectedLabourForAdvance(item);
              setAdvanceModalVisible(true);
            }}
          >
            <MaterialIcons name="payments" size={15} color="#fff" />
            <Text style={local.actionText}>Advance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[local.actionButton, disabled && local.disabled]}
            disabled={disabled}
            onPress={() => unassignLabour(item)}
          >
            <MaterialIcons name="person-remove" size={15} color="#fff" />
            <Text style={local.actionText}>Unassign</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[local.secondaryButton, disabled && local.disabled]}
            disabled={disabled}
            onPress={() => {
              setLabourToTransfer(item);
              setTransferModalVisible(true);
            }}
          >
            <MaterialIcons name="swap-horiz" size={15} color={colors.primary} />
            <Text style={local.secondaryButtonText}>Transfer</Text>
          </TouchableOpacity>

          {isLeave ? (
            <TouchableOpacity
              style={[local.successButton, disabled && local.disabled]}
              disabled={disabled}
              onPress={() => changeStatus(item, "active")}
            >
              <MaterialIcons name="check" size={15} color="#fff" />
              <Text style={local.actionText}>End Leave</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[local.warningButton, disabled && local.disabled]}
              disabled={disabled}
              onPress={() => changeStatus(item, "leave")}
            >
              <MaterialIcons name="beach-access" size={15} color="#fff" />
              <Text style={local.actionText}>Leave</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={local.container}>
      {/* Header */}
      <View style={local.header}>
        <View>
          <Text style={local.kicker}>Special Supervisor</Text>
          <Text style={local.title}>Site Labours & Advances</Text>
        </View>
        <TouchableOpacity style={local.iconButton} onPress={logout}>
          <MaterialIcons name="logout" size={22} color={colors.error} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={local.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={local.loadingText}>Loading sites & labours...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Active Site Selection Card */}
          <View style={local.siteSelectorSection}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={local.sectionLabel}>ACTIVE SITE</Text>
              {selectedSite && assignedSiteIds.has(selectedSite.id) && (
                <View style={local.assignedCardBadge}>
                  <MaterialIcons name="stars" size={13} color="#ff9500" />
                  <Text style={local.assignedCardBadgeText}>ASSIGNED TO YOU</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={local.siteSelectCard}
              onPress={() => {
                setSiteSearchQuery("");
                setSitePickerVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={local.siteIconBox}>
                <MaterialIcons name="domain" size={26} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={local.siteCardName} numberOfLines={1}>
                  {selectedSite ? selectedSite.name : "Select an Active Site"}
                </Text>
                <Text style={local.siteCardSub} numberOfLines={1}>
                  {selectedSite?.address || "Tap to choose from active sites list"}
                </Text>
              </View>
              <View style={local.siteCountBadge}>
                <Text style={local.siteCountText}>
                  {siteLabours.length} {siteLabours.length === 1 ? "Worker" : "Workers"}
                </Text>
              </View>
              <MaterialIcons name="keyboard-arrow-down" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {selectedSite ? (
            <>
              {/* Site Workers Header & Action Bar */}
              <View style={local.workerActionBar}>
                <View style={{ flex: 1 }}>
                  <Text style={local.workerSectionTitle}>
                    Assigned Labours
                    <Text style={local.workerCountInline}> ({filteredSiteLabours.length})</Text>
                  </Text>
                  <Text style={local.workerSectionSub}>
                    Workers on {selectedSite.name}
                  </Text>
                </View>

                <View style={local.actionButtonsRow}>
                  {/* Mark Attendance Button */}
                  <TouchableOpacity
                    style={local.markAttendanceBtn}
                    onPress={() => {
                      if (selectedSite) {
                        router.push(`/(screens)/attendance?siteId=${selectedSite.id}&siteName=${encodeURIComponent(selectedSite.name)}` as any);
                      }
                    }}
                  >
                    <MaterialIcons name="check-circle" size={16} color="#fff" />
                    <Text style={local.markAttendanceText}>Attendance</Text>
                  </TouchableOpacity>

                  {/* Global Give Advance Button */}
                  <TouchableOpacity
                    style={local.giveAdvanceBtn}
                    onPress={() => {
                      setGlobalAdvanceSearchQuery("");
                      setGlobalAdvanceFilter("all");
                      setGlobalAdvancePickerVisible(true);
                    }}
                  >
                    <MaterialIcons name="payments" size={16} color={colors.primary} />
                    <Text style={local.giveAdvanceText}>+ Advance</Text>
                  </TouchableOpacity>

                  {/* Assign Labours Button */}
                  <TouchableOpacity
                    style={local.assignNewButton}
                    onPress={() => {
                      setAssignSearchQuery("");
                      setSelectedLabourIds([]);
                      setAssignFilter("unassigned");
                      setAssignModalVisible(true);
                    }}
                  >
                    <MaterialIcons name="person-add" size={16} color="#fff" />
                    <Text style={local.assignNewText}>+ Assign</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Search & Status Filters for Site Workers */}
              <View style={local.filtersContainer}>
                <View style={local.searchBox}>
                  <MaterialIcons name="search" size={20} color={colors.textSecondary} />
                  <TextInput
                    value={siteWorkerQuery}
                    onChangeText={setSiteWorkerQuery}
                    placeholder={`Search workers on ${selectedSite.name}...`}
                    placeholderTextColor={colors.textSecondary}
                    style={local.searchInput}
                  />
                  {siteWorkerQuery ? (
                    <TouchableOpacity onPress={() => setSiteWorkerQuery("")}>
                      <MaterialIcons name="close" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={local.statusTabs}>
                  {(["all", "active", "leave"] as SiteStatusFilter[]).map((tab) => (
                    <TouchableOpacity
                      key={tab}
                      style={[local.statusTab, siteStatusFilter === tab && local.statusTabActive]}
                      onPress={() => setSiteStatusFilter(tab)}
                    >
                      <Text
                        style={[
                          local.statusTabText,
                          siteStatusFilter === tab && local.statusTabTextActive,
                        ]}
                      >
                        {tab === "all" ? "All Workers" : tab === "active" ? "Active" : "On Leave"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Labours List on Active Site */}
              <FlatList
                data={filteredSiteLabours}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderSiteLabour}
                contentContainerStyle={local.listContent}
                ListEmptyComponent={
                  <View style={local.emptyContainer}>
                    <MaterialIcons name="group-off" size={48} color={colors.textSecondary} />
                    <Text style={local.emptyTitle}>No labours found</Text>
                    <Text style={local.emptySub}>
                      {siteWorkerQuery || siteStatusFilter !== "all"
                        ? "Try clearing the search or status filters."
                        : `No labours are currently assigned to ${selectedSite.name}. Tap "+ Assign" to add workers.`}
                    </Text>
                    <TouchableOpacity
                      style={local.emptyAddButton}
                      onPress={() => {
                        setAssignSearchQuery("");
                        setSelectedLabourIds([]);
                        setAssignFilter("unassigned");
                        setAssignModalVisible(true);
                      }}
                    >
                      <MaterialIcons name="person-add" size={18} color="#fff" />
                      <Text style={local.emptyAddButtonText}>Assign Labours to {selectedSite.name}</Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            </>
          ) : (
            <View style={local.emptyContainer}>
              <MaterialIcons name="domain-disabled" size={48} color={colors.textSecondary} />
              <Text style={local.emptyTitle}>No Active Site Selected</Text>
              <Text style={local.emptySub}>Please select an active site above to view and assign labours.</Text>
            </View>
          )}
        </View>
      )}

      {/* MODAL 1: Select Active Site (Selectable List) */}
      <Modal
        visible={sitePickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSitePickerVisible(false)}
      >
        <View style={local.modalBackdrop}>
          <View style={local.modalSheet}>
            <View style={local.modalHeader}>
              <View>
                <Text style={local.modalTitle}>Select Active Site</Text>
                <Text style={local.modalSubtitle}>Choose a site to view and manage its assigned labours</Text>
              </View>
              <TouchableOpacity
                style={local.modalCloseBtn}
                onPress={() => setSitePickerVisible(false)}
              >
                <MaterialIcons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={local.modalSearchBox}>
              <MaterialIcons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                value={siteSearchQuery}
                onChangeText={setSiteSearchQuery}
                placeholder="Search active sites by name or location..."
                placeholderTextColor={colors.textSecondary}
                style={local.searchInput}
                autoFocus={false}
              />
            </View>

            {/* Site Picker Filter Tabs */}
            <View style={local.siteTabGroup}>
              <TouchableOpacity
                style={[local.siteTab, sitePickerTab === "assigned" && local.siteTabActive]}
                onPress={() => setSitePickerTab("assigned")}
              >
                <MaterialIcons
                  name="star"
                  size={14}
                  color={sitePickerTab === "assigned" ? "#fff" : colors.textSecondary}
                />
                <Text style={[local.siteTabText, sitePickerTab === "assigned" && local.siteTabTextActive]}>
                  Assigned ({assignedSiteIds.size})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[local.siteTab, sitePickerTab === "all" && local.siteTabActive]}
                onPress={() => setSitePickerTab("all")}
              >
                <MaterialIcons
                  name="domain"
                  size={14}
                  color={sitePickerTab === "all" ? "#fff" : colors.textSecondary}
                />
                <Text style={[local.siteTabText, sitePickerTab === "all" && local.siteTabTextActive]}>
                  All Sites ({sites.length})
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredSites}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => {
                const isSelected = selectedSite?.id === item.id;
                const workerCount = labours.filter((l) => l.site_id === item.id).length;

                return (
                  <TouchableOpacity
                    style={[local.selectableSiteItem, isSelected && local.selectableSiteItemActive]}
                    onPress={() => {
                      setSelectedSite(item);
                      setSitePickerVisible(false);
                    }}
                  >
                    <View
                      style={[
                        local.selectableSiteRadio,
                        isSelected && local.selectableSiteRadioActive,
                      ]}
                    >
                      {isSelected && <View style={local.selectableSiteRadioDot} />}
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={[
                          local.selectableSiteName,
                          isSelected && local.selectableSiteNameActive,
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text style={local.selectableSiteAddress} numberOfLines={1}>
                        {item.address || "No address specified"}
                      </Text>
                    </View>
                    {assignedSiteIds.has(item.id) && (
                      <View style={local.assignedTagBadge}>
                        <Text style={local.assignedTagText}>Assigned</Text>
                      </View>
                    )}
                    <View
                      style={[
                        local.selectableSiteBadge,
                        isSelected && local.selectableSiteBadgeActive,
                      ]}
                    >
                      <MaterialIcons
                        name="people"
                        size={14}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          local.selectableSiteBadgeText,
                          isSelected && local.selectableSiteBadgeTextActive,
                        ]}
                      >
                        {workerCount}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={local.emptySearchText}>No matching active sites found.</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Assign Labours to Site */}
      <Modal
        visible={assignModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={local.modalBackdrop}>
          <View style={local.modalSheetLarge}>
            <View style={local.modalHeader}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={local.modalTitle}>
                  Assign Labours to {selectedSite?.name || "Site"}
                </Text>
                <Text style={local.modalSubtitle}>
                  Select labours from available pool to assign to this site
                </Text>
              </View>
              <TouchableOpacity
                style={local.modalCloseBtn}
                onPress={() => setAssignModalVisible(false)}
              >
                <MaterialIcons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Filter Pills & Select All Row */}
            <View style={local.assignToolRow}>
              <View style={local.filterPillGroup}>
                <TouchableOpacity
                  style={[
                    local.filterPill,
                    assignFilter === "unassigned" && local.filterPillActive,
                  ]}
                  onPress={() => setAssignFilter("unassigned")}
                >
                  <Text
                    style={[
                      local.filterPillText,
                      assignFilter === "unassigned" && local.filterPillTextActive,
                    ]}
                  >
                    Unassigned ({labours.filter((l) => !l.site_id || l.status === "unassigned").length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[local.filterPill, assignFilter === "all" && local.filterPillActive]}
                  onPress={() => setAssignFilter("all")}
                >
                  <Text
                    style={[
                      local.filterPillText,
                      assignFilter === "all" && local.filterPillTextActive,
                    ]}
                  >
                    All Available
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={local.selectAllBtn}
                onPress={selectAllAssignable}
                disabled={assignableLabours.length === 0}
              >
                <Text style={local.selectAllText}>
                  {selectedLabourIds.length > 0 &&
                  selectedLabourIds.length === assignableLabours.length
                    ? "Deselect All"
                    : "Select All"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search Box */}
            <View style={local.modalSearchBox}>
              <MaterialIcons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                value={assignSearchQuery}
                onChangeText={setAssignSearchQuery}
                placeholder="Search labours by name or phone..."
                placeholderTextColor={colors.textSecondary}
                style={local.searchInput}
              />
            </View>

            {/* Assignable Labours List */}
            <FlatList
              data={assignableLabours}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingBottom: 10 }}
              renderItem={({ item }) => {
                const isChecked = selectedLabourIds.includes(item.id);
                return (
                  <View
                    style={[
                      local.assignableCard,
                      isChecked && local.assignableCardChecked,
                    ]}
                  >
                    <TouchableOpacity
                      style={local.assignableCheckRow}
                      onPress={() => toggleLabourSelection(item.id)}
                    >
                      <View
                        style={[
                          local.checkbox,
                          isChecked && local.checkboxChecked,
                        ]}
                      >
                        {isChecked && (
                          <MaterialIcons name="check" size={16} color="#fff" />
                        )}
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={local.assignableName}>{item.name}</Text>
                        <Text style={local.assignableSub}>
                          {item.phone || "No phone"} •{" "}
                          {item.site ? `Current: ${item.site}` : "Unassigned"}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={local.quickAssignBtn}
                      onPress={() => handleSingleAssign(item)}
                    >
                      <Text style={local.quickAssignText}>Assign</Text>
                    </TouchableOpacity>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={{ padding: 24, alignItems: "center" }}>
                  <MaterialIcons name="person-search" size={40} color={colors.textSecondary} />
                  <Text style={local.emptySearchText}>
                    No labours available in this category.
                  </Text>
                </View>
              }
            />

            {/* Footer Action Bar */}
            <View style={local.assignFooter}>
              <Text style={local.selectedCountText}>
                {selectedLabourIds.length} labour(s) selected
              </Text>
              <TouchableOpacity
                style={[
                  local.confirmAssignBtn,
                  (selectedLabourIds.length === 0 || assigningBatch) && local.disabled,
                ]}
                disabled={selectedLabourIds.length === 0 || assigningBatch}
                onPress={handleBatchAssign}
              >
                {assigningBatch ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="check" size={20} color="#fff" />
                    <Text style={local.confirmAssignText}>
                      Assign {selectedLabourIds.length > 0 ? `(${selectedLabourIds.length})` : ""} to Site
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Transfer Labour to Another Site */}
      <Modal
        visible={transferModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTransferModalVisible(false)}
      >
        <View style={local.modalBackdrop}>
          <View style={local.modalSheet}>
            <View style={local.modalHeader}>
              <View>
                <Text style={local.modalTitle}>Transfer Labour</Text>
                <Text style={local.modalSubtitle}>
                  Move {labourToTransfer?.name} to another active site
                </Text>
              </View>
              <TouchableOpacity
                style={local.modalCloseBtn}
                onPress={() => {
                  setTransferModalVisible(false);
                  setLabourToTransfer(null);
                }}
              >
                <MaterialIcons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={sites.filter((s) => s.id !== selectedSite?.id)}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={local.selectableSiteItem}
                  onPress={() => handleTransferLabour(item)}
                >
                  <View style={local.siteIconBoxSmall}>
                    <MaterialIcons name="domain" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={local.selectableSiteName}>{item.name}</Text>
                    <Text style={local.selectableSiteAddress}>
                      {item.address || "Active Site"}
                    </Text>
                  </View>
                  <View style={local.transferArrowBtn}>
                    <Text style={local.transferArrowText}>Transfer</Text>
                    <MaterialIcons name="arrow-forward" size={16} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={local.emptySearchText}>No other active sites available.</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* MODAL 4: Select Any Labour for Advance (Global Picker) */}
      <Modal
        visible={globalAdvancePickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setGlobalAdvancePickerVisible(false)}
      >
        <View style={local.modalBackdrop}>
          <View style={local.modalSheetLarge}>
            <View style={local.modalHeader}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={local.modalTitle}>Give Advance to Labour</Text>
                <Text style={local.modalSubtitle}>Select any labour across the system to give advance</Text>
              </View>
              <TouchableOpacity
                style={local.modalCloseBtn}
                onPress={() => setGlobalAdvancePickerVisible(false)}
              >
                <MaterialIcons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Filter Pills */}
            <View style={local.assignToolRow}>
              <View style={local.filterPillGroup}>
                <TouchableOpacity
                  style={[local.filterPill, globalAdvanceFilter === "all" && local.filterPillActive]}
                  onPress={() => setGlobalAdvanceFilter("all")}
                >
                  <Text style={[local.filterPillText, globalAdvanceFilter === "all" && local.filterPillTextActive]}>
                    All ({labours.length})
                  </Text>
                </TouchableOpacity>
                {selectedSite && (
                  <TouchableOpacity
                    style={[local.filterPill, globalAdvanceFilter === "site" && local.filterPillActive]}
                    onPress={() => setGlobalAdvanceFilter("site")}
                  >
                    <Text style={[local.filterPillText, globalAdvanceFilter === "site" && local.filterPillTextActive]}>
                      {selectedSite.name} ({siteLabours.length})
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[local.filterPill, globalAdvanceFilter === "unassigned" && local.filterPillActive]}
                  onPress={() => setGlobalAdvanceFilter("unassigned")}
                >
                  <Text style={[local.filterPillText, globalAdvanceFilter === "unassigned" && local.filterPillTextActive]}>
                    Unassigned ({labours.filter((l) => !l.site_id || l.status === "unassigned").length})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Search Box */}
            <View style={local.modalSearchBox}>
              <MaterialIcons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                value={globalAdvanceSearchQuery}
                onChangeText={setGlobalAdvanceSearchQuery}
                placeholder="Search labours by name, phone, or site..."
                placeholderTextColor={colors.textSecondary}
                style={local.searchInput}
              />
            </View>

            {/* Labours List for Advance */}
            <FlatList
              data={filteredAllLaboursForAdvance}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={local.selectableLabourAdvanceCard}
                  onPress={() => {
                    setGlobalAdvancePickerVisible(false);
                    setSelectedLabourForAdvance(item);
                    setAdvanceModalVisible(true);
                  }}
                >
                  <View style={local.avatarCircle}>
                    <MaterialIcons name="person" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={local.assignableName}>{item.name}</Text>
                    <Text style={local.assignableSub}>
                      {item.phone || "No phone"} • {item.site ? `Site: ${item.site}` : "Unassigned"}
                    </Text>
                  </View>
                  <View style={local.giveAdvanceItemBtn}>
                    <MaterialIcons name="payments" size={16} color="#fff" />
                    <Text style={local.giveAdvanceItemText}>Give Advance</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 24, alignItems: "center" }}>
                  <MaterialIcons name="person-search" size={40} color={colors.textSecondary} />
                  <Text style={local.emptySearchText}>No matching labours found.</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Advance Modal */}
      <AdvanceModal
        visible={advanceModalVisible}
        onClose={() => {
          setAdvanceModalVisible(false);
          setSelectedLabourForAdvance(null);
        }}
        onSuccess={() => {
          fetchData();
        }}
        labour={selectedLabourForAdvance}
        currentUserId={currentUserId}
      />

      {/* Alert / Feedback Modal */}
      <CustomModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal((m) => ({ ...m, visible: false }))}
        actions={[
          {
            text: "OK",
            style: "default",
            onPress: () => setModal((m) => ({ ...m, visible: false })),
          },
        ]}
      />
    </View>
  );
}

const getStyles = (isDark: boolean, colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    kicker: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    title: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
      marginTop: 2,
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 12,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },

    // Site Selector Card
    siteSelectorSection: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.textSecondary,
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    siteSelectCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#1f1f23" : "#F3F4F6",
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    siteIconBox: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: isDark ? "#1e293b" : "#e0e7ff",
      alignItems: "center",
      justifyContent: "center",
    },
    siteCardName: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    siteCardSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    siteCountBadge: {
      backgroundColor: isDark ? "#312e81" : "#dbeafe",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    siteCountText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
    },

    // Worker Action Bar
    workerActionBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    workerSectionTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    workerCountInline: {
      color: colors.primary,
      fontWeight: "800",
    },
    workerSectionSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    actionButtonsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    giveAdvanceBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#27272a" : "#eff6ff",
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
      gap: 4,
    },
    giveAdvanceText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "800",
    },
    assignNewButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
      gap: 4,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 2,
    },
    assignNewText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "800",
    },

    // Filters & Search
    filtersContainer: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 10,
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 44,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
    },
    statusTabs: {
      flexDirection: "row",
      gap: 8,
    },
    statusTab: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    statusTabActive: {
      borderColor: colors.primary,
      backgroundColor: isDark ? "#1e293b" : "#e0e7ff",
    },
    statusTabText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    statusTabTextActive: {
      color: colors.primary,
    },

    // Main Worker List
    listContent: {
      padding: 16,
      paddingBottom: 90,
      gap: 12,
    },
    labourCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    labourTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    },
    avatarCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? "#27272a" : "#f1f5f9",
      alignItems: "center",
      justifyContent: "center",
    },
    labourName: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    labourSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    badgeContainer: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    activeBadge: {
      backgroundColor: isDark ? "#064e3b" : "#d1fae5",
    },
    activeBadgeText: {
      color: isDark ? "#6ee7b7" : "#065f46",
      fontSize: 11,
      fontWeight: "800",
    },
    leaveBadge: {
      backgroundColor: isDark ? "#78350f" : "#fef3c7",
    },
    leaveBadgeText: {
      color: isDark ? "#fde68a" : "#92400e",
      fontSize: 11,
      fontWeight: "800",
    },
    badgeText: {
      textTransform: "capitalize",
    },
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
    },
    advanceButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#059669",
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      gap: 4,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.error,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      gap: 4,
    },
    actionText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "800",
    },
    secondaryButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#27272a" : "#f3f4f6",
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      gap: 4,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
    },
    warningButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.warning,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      gap: 4,
    },
    successButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.success,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      gap: 4,
    },
    disabled: {
      opacity: 0.5,
    },

    // Empty state
    emptyContainer: {
      padding: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
      marginTop: 12,
    },
    emptySub: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 6,
      lineHeight: 18,
      paddingHorizontal: 20,
    },
    emptyAddButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      gap: 8,
      marginTop: 18,
    },
    emptyAddButtonText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 13,
    },

    // Modal Common Styles
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      maxHeight: "80%",
    },
    modalSheetLarge: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      height: "88%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 14,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    modalSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 3,
    },
    modalCloseBtn: {
      padding: 4,
    },
    modalSearchBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#27272a" : "#f3f4f6",
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 42,
      gap: 8,
      marginBottom: 14,
    },
    emptySearchText: {
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 20,
      fontSize: 13,
    },

    // Selectable Site List
    selectableSiteItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      marginBottom: 10,
    },
    selectableSiteItemActive: {
      borderColor: colors.primary,
      backgroundColor: isDark ? "#1e293b" : "#eff6ff",
    },
    selectableSiteRadio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.textSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    selectableSiteRadioActive: {
      borderColor: colors.primary,
    },
    selectableSiteRadioDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    selectableSiteName: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    selectableSiteNameActive: {
      color: colors.primary,
    },
    selectableSiteAddress: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    selectableSiteBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: isDark ? "#27272a" : "#e5e7eb",
      gap: 4,
    },
    selectableSiteBadgeActive: {
      backgroundColor: isDark ? "#312e81" : "#dbeafe",
    },
    selectableSiteBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    selectableSiteBadgeTextActive: {
      color: colors.primary,
    },
    siteIconBoxSmall: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: isDark ? "#1e293b" : "#e0e7ff",
      alignItems: "center",
      justifyContent: "center",
    },
    transferArrowBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    transferArrowText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "700",
    },

    // Assign Labours Modal
    assignToolRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    filterPillGroup: {
      flexDirection: "row",
      gap: 6,
    },
    filterPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    filterPillActive: {
      borderColor: colors.primary,
      backgroundColor: isDark ? "#1e293b" : "#e0e7ff",
    },
    filterPillText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    filterPillTextActive: {
      color: colors.primary,
    },
    selectAllBtn: {
      paddingVertical: 4,
      paddingHorizontal: 6,
    },
    selectAllText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    assignableCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      marginBottom: 8,
    },
    assignableCardChecked: {
      borderColor: colors.primary,
      backgroundColor: isDark ? "#1e293b" : "#f0f7ff",
    },
    markAttendanceBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#34c759",
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
    },
    markAttendanceText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "700",
    },
    assignedCardBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: isDark ? "#3d2e00" : "#fff8e7",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: isDark ? "#ff9500" : "#ffe0b2",
    },
    assignedCardBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: isDark ? "#ffb340" : "#b27b00",
      letterSpacing: 0.5,
    },
    siteTabGroup: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
    },
    siteTab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: isDark ? "#27272a" : "#e5e7eb",
    },
    siteTabActive: {
      backgroundColor: colors.primary,
    },
    siteTabText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    siteTabTextActive: {
      color: "#fff",
    },
    assignedTagBadge: {
      backgroundColor: isDark ? "#3d2e00" : "#fff8e7",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: isDark ? "#ff9500" : "#ffe0b2",
      marginRight: 6,
    },
    assignedTagText: {
      fontSize: 10,
      fontWeight: "800",
      color: isDark ? "#ffb340" : "#b27b00",
    },
    assignableCheckRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.textSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    assignableName: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    assignableSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    quickAssignBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    quickAssignText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "800",
    },
    assignFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
      marginTop: 6,
    },
    selectedCountText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    confirmAssignBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      gap: 6,
    },
    confirmAssignText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "800",
    },

    // Global Advance Picker Card
    selectableLabourAdvanceCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      marginBottom: 8,
    },
    giveAdvanceItemBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#059669",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      gap: 4,
    },
    giveAdvanceItemText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "800",
    },
  });
