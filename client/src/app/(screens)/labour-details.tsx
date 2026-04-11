
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { CustomModal } from "../../components/CustomModal";
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
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Labour {
    id: number;
    name: string;
    phone: string;
    aadhaar: string;
    trade: string;
    rate: number;
    site: string;
    site_id: number;
    status: 'active' | 'unassigned';
    profile_image?: string;
    date_of_birth?: string;
    emergency_phone?: string;
    notes?: string;
}

interface AttendanceRecord {
    id: number;
    date: string;
    status: 'full' | 'half' | 'absent';
    site_id: number;
    site_name: string;
    created_at: string;
}

interface OvertimeRecord {
    id: number;
    date: string;
    hours: number;
    amount: number;
    notes?: string;
    site_id: number;
    site_name: string;
    created_at: string;
}

interface AdvanceRecord {
    id: number;
    date: string;
    amount: number;
    notes?: string;
    created_at: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LabourDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { isDark } = useTheme();
    const local = getStyles(isDark);

    // Labour info
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isPersonalInfoExpanded, setIsPersonalInfoExpanded] = useState(false);
    const [isWorkDetailsExpanded, setIsWorkDetailsExpanded] = useState(false);
    const [labour, setLabour] = useState<Labour | null>(null);
    const [formData, setFormData] = useState<Partial<Labour>>({});

    // Section data
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [overtime, setOvertime] = useState<OvertimeRecord[]>([]);
    const [advances, setAdvances] = useState<AdvanceRecord[]>([]);

    // Section loading states
    const [loadingAttendance, setLoadingAttendance] = useState(false);
    const [loadingOvertime, setLoadingOvertime] = useState(false);
    const [loadingAdvances, setLoadingAdvances] = useState(false);

    // Section error states
    const [errorAttendance, setErrorAttendance] = useState<string | null>(null);
    const [errorOvertime, setErrorOvertime] = useState<string | null>(null);
    const [errorAdvances, setErrorAdvances] = useState<string | null>(null);

    // Bonus modal
    const [showBonusModal, setShowBonusModal] = useState(false);
    const [bonusAmount, setBonusAmount] = useState("");
    const [bonusNotes, setBonusNotes] = useState("");
    const [savingBonus, setSavingBonus] = useState(false);

    // Increment modal
    const [showIncrementModal, setShowIncrementModal] = useState(false);
    const [newRate, setNewRate] = useState("");
    const [savingIncrement, setSavingIncrement] = useState(false);

    // ─── Data Fetching ─────────────────────────────────────────────────────────

    useEffect(() => {
        if (!id) return;
        fetchLabourDetails();
        fetchAttendance();
        fetchOvertime();
        fetchAdvances();
    }, [id]);

    const fetchLabourDetails = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/labours/${id}`);
            if (response.ok) {
                const data = await response.json();
                setLabour(data);
                setFormData(data);
            } else {
                Alert.alert("Error", "Failed to fetch labour details");
                router.back();
            }
        } catch (error) {
            console.error("Error fetching labour:", error);
            Alert.alert("Error", "Unable to connect to server");
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const fetchAttendance = async () => {
        try {
            setLoadingAttendance(true);
            setErrorAttendance(null);
            const response = await api.get(`/attendance/labour/${id}`);
            if (response.ok) {
                const data = await response.json();
                setAttendance(data);
            } else {
                setErrorAttendance("Failed to load attendance");
            }
        } catch {
            setErrorAttendance("Unable to connect to server");
        } finally {
            setLoadingAttendance(false);
        }
    };

    const fetchOvertime = async () => {
        try {
            setLoadingOvertime(true);
            setErrorOvertime(null);
            const response = await api.get(`/overtime/labour/${id}`);
            if (response.ok) {
                const data = await response.json();
                setOvertime(data);
            } else {
                setErrorOvertime("Failed to load overtime");
            }
        } catch {
            setErrorOvertime("Unable to connect to server");
        } finally {
            setLoadingOvertime(false);
        }
    };

    const fetchAdvances = async () => {
        try {
            setLoadingAdvances(true);
            setErrorAdvances(null);
            const response = await api.get(`/labours/${id}/advances`);
            if (response.ok) {
                const data = await response.json();
                setAdvances(data);
            } else {
                setErrorAdvances("Failed to load advances");
            }
        } catch {
            setErrorAdvances("Unable to connect to server");
        } finally {
            setLoadingAdvances(false);
        }
    };

    // ─── Edit Handlers ─────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!formData.name?.trim() || !formData.phone?.trim()) {
            Alert.alert("Error", "Name and Phone are required");
            return;
        }
        try {
            setSaving(true);
            const payload = { ...formData, rate: Number(formData.rate) };
            const response = await api.put(`/labours/${id}`, payload);
            const data = await response.json();
            if (response.ok) {
                setLabour(data as Labour);
                setIsEditing(false);
                Alert.alert("Success", "Labour details updated successfully");
            } else {
                Alert.alert("Error", data.error || "Failed to update labour");
            }
        } catch {
            Alert.alert("Error", "Unable to connect to server");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBonus = async () => {
        if (!bonusAmount || isNaN(Number(bonusAmount)) || Number(bonusAmount) <= 0) {
            Alert.alert("Error", "Please enter a valid amount");
            return;
        }
        try {
            setSavingBonus(true);
            const response = await api.post(`/labours/${id}/bonus`, {
                amount: Number(bonusAmount),
                date: new Date().toISOString(),
                notes: bonusNotes,
            });
            const data = await response.json();
            if (response.ok) {
                Alert.alert("Success", "Bonus recorded successfully");
                setShowBonusModal(false);
                setBonusAmount("");
                setBonusNotes("");
            } else {
                Alert.alert("Error", data.error || "Failed to record bonus");
            }
        } catch {
            Alert.alert("Error", "Unable to connect to server");
        } finally {
            setSavingBonus(false);
        }
    };

    const handleSaveIncrement = async () => {
        if (!newRate || isNaN(Number(newRate)) || Number(newRate) <= 0) {
            Alert.alert("Error", "Please enter a valid rate");
            return;
        }
        try {
            setSavingIncrement(true);
            const payload = { ...labour, rate: Number(newRate) };
            const response = await api.put(`/labours/${id}`, payload);
            const data = await response.json();
            if (response.ok) {
                setLabour(data as Labour);
                setFormData(data as Labour);
                setShowIncrementModal(false);
                Alert.alert("Success", "Daily rate updated successfully");
            } else {
                Alert.alert("Error", data.error || "Failed to update rate");
            }
        } catch {
            Alert.alert("Error", "Unable to connect to server");
        } finally {
            setSavingIncrement(false);
        }
    };

    // ─── Helpers ───────────────────────────────────────────────────────────────

    const calculateAge = (dobString?: string) => {
        if (!dobString) return null;
        const dob = new Date(dobString);
        const diffMs = Date.now() - dob.getTime();
        const ageDate = new Date(diffMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    const getAttendanceStats = () => {
        const total = attendance.length;
        const full = attendance.filter(r => r.status === 'full').length;
        const half = attendance.filter(r => r.status === 'half').length;
        const absent = attendance.filter(r => r.status === 'absent').length;
        return { total, full, half, absent };
    };

    const getOvertimeStats = () => {
        const totalHours = overtime.reduce((sum, r) => sum + (r.hours || 0), 0);
        const totalAmount = overtime.reduce((sum, r) => sum + (r.amount || 0), 0);
        return { totalHours, totalAmount };
    };

    const getAdvancesStats = () => {
        const total = advances.reduce((sum, r) => sum + (r.amount || 0), 0);
        return { total };
    };

    const getSitesWorked = () => {
        const siteMap: Record<number, { name: string; count: number }> = {};
        attendance.forEach(r => {
            if (r.site_id) {
                if (!siteMap[r.site_id]) {
                    siteMap[r.site_id] = { name: r.site_name || 'Unknown Site', count: 0 };
                }
                siteMap[r.site_id].count += 1;
            }
        });
        return Object.entries(siteMap).map(([id, val]) => ({ id: Number(id), ...val }));
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'full': return { bg: isDark ? '#1b4323' : '#e8f5e9', text: isDark ? '#81c784' : '#2e7d32' };
            case 'half': return { bg: isDark ? '#3d2c00' : '#fff3e0', text: isDark ? '#ffb74d' : '#e65100' };
            case 'absent': return { bg: isDark ? '#3b0a0a' : '#ffebee', text: isDark ? '#ef9a9a' : '#c62828' };
            default: return { bg: isDark ? '#333' : '#eee', text: isDark ? '#aaa' : '#555' };
        }
    };

    // ─── Sub-components ────────────────────────────────────────────────────────

    const renderDetailItem = ({ label, value, icon, isEditable = false, field, keyboardType = 'default' }: any) => (
        <View style={local.inputGroup}>
            <Text style={local.label}>{label}</Text>
            <View style={[local.inputContainer, !isEditing && local.readOnlyContainer]}>
                <Ionicons name={icon} size={20} color={isDark ? "#aaa" : "#666"} style={local.inputIcon} />
                {isEditing && isEditable ? (
                    <TextInput
                        style={local.input}
                        value={String(field ? (formData as any)[field] || "" : value)}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, [field]: text }))}
                        editable
                        keyboardType={keyboardType}
                        placeholderTextColor={isDark ? "#888" : "#999"}
                    />
                ) : (
                    <Text style={local.inputText}>{value || "—"}</Text>
                )}
            </View>
        </View>
    );

    const SectionHeader = ({ title, icon, count }: { title: string; icon: string; count?: number }) => (
        <View style={local.sectionHeaderRow}>
            <View style={local.sectionHeaderLeft}>
                <MaterialCommunityIcons name={icon as any} size={18} color={isDark ? '#64b5f6' : '#0a84ff'} />
                <Text style={local.sectionTitle}>{title}</Text>
            </View>
            {count !== undefined && (
                <View style={local.countBadge}>
                    <Text style={local.countBadgeText}>{count}</Text>
                </View>
            )}
        </View>
    );

    const SectionCard = ({ children }: { children: React.ReactNode }) => (
        <View style={local.sectionCard}>{children}</View>
    );

    const SectionLoading = () => (
        <View style={local.sectionCenter}>
            <ActivityIndicator size="small" color={isDark ? "#64b5f6" : "#0a84ff"} />
            <Text style={local.sectionSubText}>Loading…</Text>
        </View>
    );

    const SectionEmpty = ({ message }: { message: string }) => (
        <View style={local.sectionCenter}>
            <MaterialCommunityIcons name="inbox-outline" size={32} color={isDark ? '#444' : '#ddd'} />
            <Text style={local.sectionSubText}>{message}</Text>
        </View>
    );

    const SectionError = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
        <View style={local.sectionCenter}>
            <MaterialCommunityIcons name="alert-circle-outline" size={28} color="#e53935" />
            <Text style={[local.sectionSubText, { color: '#e53935' }]}>{message}</Text>
            <TouchableOpacity onPress={onRetry} style={local.retryBtn}>
                <Text style={local.retryBtnText}>Retry</Text>
            </TouchableOpacity>
        </View>
    );

    const StatBox = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
        <View style={local.statBox}>
            <Text style={[local.statValue, color ? { color } : {}]}>{value}</Text>
            <Text style={local.statLabel}>{label}</Text>
        </View>
    );

    // ─── Guard: loading/null ───────────────────────────────────────────────────

    if (loading) {
        return (
            <View style={local.loadingContainer}>
                <ActivityIndicator size="large" color="#0a84ff" />
                <Text style={local.loadingText}>Loading labour details…</Text>
            </View>
        );
    }

    if (!labour) return null;

    // ─── Derived data ──────────────────────────────────────────────────────────

    const attStats = getAttendanceStats();
    const otStats = getOvertimeStats();
    const advStats = getAdvancesStats();
    const sitesWorked = getSitesWorked();

    // ─── Render ────────────────────────────────────────────────────────────────

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={local.container}
            enabled={Platform.OS !== "web"}
        >
            <ScrollView contentContainerStyle={local.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── Header ── */}
                <View style={local.header}>
                    <TouchableOpacity onPress={() => router.back()} style={local.backButton}>
                        <Ionicons name="arrow-back" size={24} color={isDark ? "#fff" : "#333"} />
                    </TouchableOpacity>
                    <Text style={local.title}>Labour Details</Text>
                    <TouchableOpacity
                        onPress={() => {
                            if (isEditing) { setFormData(labour); setIsEditing(false); }
                            else setIsEditing(true);
                        }}
                        style={local.editButton}
                    >
                        <Text style={local.editButtonText}>{isEditing ? "Cancel" : "Edit"}</Text>
                    </TouchableOpacity>
                </View>

                {/* ── Profile Card ── */}
                <View style={local.profileCard}>
                    <View style={local.avatarContainer}>
                        <Ionicons name="person" size={40} color={isDark ? "#333" : "#fff"} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={local.profileName}>{labour.name}</Text>
                        <Text style={local.profileId}>ID #{labour.id} · {labour.trade || 'General'}</Text>
                        <View style={[
                            local.statusBadge,
                            { backgroundColor: labour.status === 'active' ? (isDark ? '#1b4323' : '#2e7d32') : (isDark ? '#444' : '#9e9e9e') }
                        ]}>
                            <Text style={local.statusText}>{labour.status.toUpperCase()}</Text>
                        </View>
                    </View>
                    <View style={local.rateBox}>
                        <Text style={local.rateAmount}>₹{labour.rate || 0}</Text>
                        <Text style={local.rateLabel}>per day</Text>
                    </View>
                </View>

                {/* ── Quick Actions ── */}
                <View style={local.actionRow}>
                    <TouchableOpacity style={local.actionBtn} onPress={() => setShowBonusModal(true)}>
                        <Ionicons name="gift-outline" size={20} color="#fff" />
                        <Text style={local.actionBtnText}>Record Bonus</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[local.actionBtn, { backgroundColor: isDark ? '#2e7d32' : '#4CAF50' }]}
                        onPress={() => { setNewRate(String(labour.rate || "")); setShowIncrementModal(true); }}
                    >
                        <Ionicons name="trending-up-outline" size={20} color="#fff" />
                        <Text style={local.actionBtnText}>Update Rate</Text>
                    </TouchableOpacity>
                </View>

                {/* ── Personal Information ── */}
                <View style={local.formContainer}>
                    <TouchableOpacity
                        style={local.sectionHeaderRowAccordion}
                        onPress={() => setIsPersonalInfoExpanded(!isPersonalInfoExpanded)}
                        activeOpacity={0.7}
                    >
                        <Text style={[local.sectionCategory, { marginBottom: 0 }]}>Personal Information</Text>
                        <Ionicons
                            name={isPersonalInfoExpanded ? "chevron-up" : "chevron-down"}
                            size={20}
                            color={isDark ? "#aaa" : "#666"}
                        />
                    </TouchableOpacity>

                    {isPersonalInfoExpanded && (
                        <View style={local.accordionBody}>
                            {renderDetailItem({ label: "Full Name", value: labour.name, field: "name", icon: "person-outline", isEditable: true })}
                            {renderDetailItem({ label: "Phone Number", value: labour.phone, field: "phone", icon: "call-outline", isEditable: true, keyboardType: "phone-pad" })}
                            {renderDetailItem({ label: "Date of Birth (YYYY-MM-DD)", value: labour.date_of_birth, field: "date_of_birth", icon: "calendar-outline", isEditable: true })}

                            {labour.date_of_birth && (
                                <View style={local.inputGroup}>
                                    <Text style={local.label}>Age</Text>
                                    <View style={[local.inputContainer, local.readOnlyContainer]}>
                                        <Ionicons name="hourglass-outline" size={20} color={isDark ? "#aaa" : "#666"} style={local.inputIcon} />
                                        <Text style={local.inputText}>{calculateAge(labour.date_of_birth)} yrs</Text>
                                    </View>
                                </View>
                            )}

                            {renderDetailItem({ label: "Aadhaar Number", value: labour.aadhaar, field: "aadhaar", icon: "card-outline", isEditable: true, keyboardType: "numeric" })}
                            {renderDetailItem({ label: "Emergency Contact", value: labour.emergency_phone, field: "emergency_phone", icon: "medical-outline", isEditable: true, keyboardType: "phone-pad" })}
                        </View>
                    )}

                    <View style={local.divider} />
                    <TouchableOpacity
                        style={local.sectionHeaderRowAccordion}
                        onPress={() => setIsWorkDetailsExpanded(!isWorkDetailsExpanded)}
                        activeOpacity={0.7}
                    >
                        <Text style={[local.sectionCategory, { marginBottom: 0 }]}>Work Details</Text>
                        <Ionicons
                            name={isWorkDetailsExpanded ? "chevron-up" : "chevron-down"}
                            size={20}
                            color={isDark ? "#aaa" : "#666"}
                        />
                    </TouchableOpacity>

                    {isWorkDetailsExpanded && (
                        <View style={local.accordionBody}>
                            {renderDetailItem({ label: "Trade / Role", value: labour.trade, field: "trade", icon: "briefcase-outline", isEditable: true })}
                            {renderDetailItem({ label: "Daily Rate (₹)", value: String(labour.rate || 0), field: "rate", icon: "cash-outline", isEditable: true, keyboardType: "numeric" })}
                            {renderDetailItem({ label: "Current Site", value: labour.site, field: "site", icon: "location-outline", isEditable: true })}
                            {renderDetailItem({ label: "Status", value: labour.status, icon: "flag-outline", isEditable: false })}

                            <View style={local.divider} />
                            {renderDetailItem({ label: "Notes", value: labour.notes, field: "notes", icon: "document-text-outline", isEditable: true })}
                        </View>
                    )}

                    {isEditing && (
                        <TouchableOpacity
                            style={[local.saveButton, saving && local.disabledButton]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            <Text style={local.saveButtonText}>{saving ? "Saving…" : "Save Changes"}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ══════════════════════════════════════ */}
                {/* ── ATTENDANCE SECTION ── */}
                {/* ══════════════════════════════════════ */}
                <SectionCard>
                    <SectionHeader title="Attendance" icon="calendar-check" count={attStats.total} />

                    {loadingAttendance ? (
                        <SectionLoading />
                    ) : errorAttendance ? (
                        <SectionError message={errorAttendance} onRetry={fetchAttendance} />
                    ) : attendance.length === 0 ? (
                        <SectionEmpty message="No attendance records found" />
                    ) : (
                        <>
                            {/* Stats row */}
                            <View style={local.statsRow}>
                                <StatBox label="Total" value={attStats.total} />
                                <StatBox label="Full" value={attStats.full} color={isDark ? '#81c784' : '#2e7d32'} />
                                <StatBox label="Half" value={attStats.half} color={isDark ? '#ffb74d' : '#e65100'} />
                                <StatBox label="Absent" value={attStats.absent} color={isDark ? '#ef9a9a' : '#c62828'} />
                            </View>

                            <View style={local.divider} />

                            {/* Attendance records (most recent 20) */}
                            {attendance.slice(0, 20).map((rec) => {
                                const sc = getStatusColor(rec.status);
                                return (
                                    <View key={rec.id} style={local.recordRow}>
                                        <View style={local.recordLeft}>
                                            <Text style={local.recordDate}>{formatDate(rec.date)}</Text>
                                            <Text style={local.recordSub} numberOfLines={1}>{rec.site_name || '—'}</Text>
                                        </View>
                                        <View style={[local.statusChip, { backgroundColor: sc.bg }]}>
                                            <Text style={[local.statusChipText, { color: sc.text }]}>
                                                {rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                            {attendance.length > 20 && (
                                <Text style={local.moreText}>+ {attendance.length - 20} more records</Text>
                            )}
                        </>
                    )}
                </SectionCard>

                {/* ══════════════════════════════════════ */}
                {/* ── OVERTIME SECTION ── */}
                {/* ══════════════════════════════════════ */}
                <SectionCard>
                    <SectionHeader title="Overtime" icon="clock-time-four-outline" count={overtime.length} />

                    {loadingOvertime ? (
                        <SectionLoading />
                    ) : errorOvertime ? (
                        <SectionError message={errorOvertime} onRetry={fetchOvertime} />
                    ) : overtime.length === 0 ? (
                        <SectionEmpty message="No overtime records found" />
                    ) : (
                        <>
                            {/* Stats row */}
                            <View style={local.statsRow}>
                                <StatBox label="Total Hours" value={`${otStats.totalHours.toFixed(1)}h`} color={isDark ? '#64b5f6' : '#0a84ff'} />
                                <StatBox label="Total Amount" value={`₹${otStats.totalAmount.toFixed(0)}`} color={isDark ? '#81c784' : '#2e7d32'} />
                                <StatBox label="Sessions" value={overtime.length} />
                            </View>

                            <View style={local.divider} />

                            {overtime.slice(0, 20).map((rec) => (
                                <View key={rec.id} style={local.recordRow}>
                                    <View style={local.recordLeft}>
                                        <Text style={local.recordDate}>{formatDate(rec.date)}</Text>
                                        <Text style={local.recordSub} numberOfLines={1}>{rec.site_name || '—'}</Text>
                                    </View>
                                    <View style={local.recordRight}>
                                        <Text style={local.recordPrimary}>{rec.hours}h</Text>
                                        <Text style={local.recordSecondary}>₹{rec.amount}</Text>
                                    </View>
                                </View>
                            ))}
                            {overtime.length > 20 && (
                                <Text style={local.moreText}>+ {overtime.length - 20} more records</Text>
                            )}
                        </>
                    )}
                </SectionCard>

                {/* ══════════════════════════════════════ */}
                {/* ── SITES WORKED SECTION ── */}
                {/* ══════════════════════════════════════ */}
                <SectionCard>
                    <SectionHeader title="Sites Worked" icon="map-marker-multiple-outline" count={sitesWorked.length} />

                    {loadingAttendance ? (
                        <SectionLoading />
                    ) : errorAttendance ? (
                        <SectionError message="Could not load site history" onRetry={fetchAttendance} />
                    ) : sitesWorked.length === 0 ? (
                        <SectionEmpty message="No site history found" />
                    ) : (
                        sitesWorked.map((site) => (
                            <View key={site.id} style={local.recordRow}>
                                <View style={local.siteIconWrap}>
                                    <MaterialCommunityIcons name="office-building-outline" size={18} color={isDark ? '#64b5f6' : '#0a84ff'} />
                                </View>
                                <Text style={[local.recordDate, { flex: 1 }]}>{site.name}</Text>
                                <View style={local.countBadge}>
                                    <Text style={local.countBadgeText}>{site.count} days</Text>
                                </View>
                            </View>
                        ))
                    )}
                </SectionCard>

                {/* ══════════════════════════════════════ */}
                {/* ── ADVANCES SECTION ── */}
                {/* ══════════════════════════════════════ */}
                <SectionCard>
                    <SectionHeader title="Advances" icon="cash-multiple" count={advances.length} />

                    {loadingAdvances ? (
                        <SectionLoading />
                    ) : errorAdvances ? (
                        <SectionError message={errorAdvances} onRetry={fetchAdvances} />
                    ) : advances.length === 0 ? (
                        <SectionEmpty message="No advance records found" />
                    ) : (
                        <>
                            {/* Total */}
                            <View style={local.statsRow}>
                                <StatBox label="Total Advanced" value={`₹${advStats.total.toFixed(0)}`} color={isDark ? '#ef9a9a' : '#c62828'} />
                                <StatBox label="No. of Advances" value={advances.length} />
                            </View>

                            <View style={local.divider} />

                            {advances.slice(0, 20).map((rec) => (
                                <View key={rec.id} style={local.recordRow}>
                                    <View style={local.recordLeft}>
                                        <Text style={local.recordDate}>{formatDate(rec.date)}</Text>
                                        {rec.notes ? (
                                            <Text style={local.recordSub} numberOfLines={1}>{rec.notes}</Text>
                                        ) : null}
                                    </View>
                                    <Text style={[local.recordPrimary, { color: isDark ? '#ef9a9a' : '#c62828' }]}>
                                        ₹{rec.amount}
                                    </Text>
                                </View>
                            ))}
                            {advances.length > 20 && (
                                <Text style={local.moreText}>+ {advances.length - 20} more records</Text>
                            )}
                        </>
                    )}
                </SectionCard>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* ── Bonus Modal ── */}
            <CustomModal
                visible={showBonusModal}
                onClose={() => setShowBonusModal(false)}
                title="Record Bonus"
                actions={[
                    { text: "Cancel", onPress: () => setShowBonusModal(false), style: "cancel" },
                    { text: savingBonus ? "Saving…" : "Save Bonus", onPress: handleSaveBonus, style: "default" },
                ]}
            >
                <View style={local.modalForm}>
                    <View style={local.inputGroup}>
                        <Text style={local.label}>Amount (₹)</Text>
                        <TextInput
                            style={local.input}
                            keyboardType="numeric"
                            placeholder="Enter amount"
                            value={bonusAmount}
                            onChangeText={setBonusAmount}
                            placeholderTextColor={isDark ? "#888" : "#999"}
                        />
                    </View>
                    <View style={local.inputGroup}>
                        <Text style={local.label}>Notes</Text>
                        <TextInput
                            style={[local.input, { height: 80, textAlignVertical: 'top' }]}
                            placeholder="Optional notes"
                            value={bonusNotes}
                            onChangeText={setBonusNotes}
                            multiline
                            numberOfLines={3}
                            placeholderTextColor={isDark ? "#888" : "#999"}
                        />
                    </View>
                </View>
            </CustomModal>

            {/* ── Increment Modal ── */}
            <CustomModal
                visible={showIncrementModal}
                onClose={() => setShowIncrementModal(false)}
                title="Update Daily Rate"
                actions={[
                    { text: "Cancel", onPress: () => setShowIncrementModal(false), style: "cancel" },
                    { text: savingIncrement ? "Saving…" : "Update Rate", onPress: handleSaveIncrement, style: "default" },
                ]}
            >
                <View style={local.modalForm}>
                    <View style={local.inputGroup}>
                        <Text style={local.label}>Current Rate: ₹{labour.rate || 0}</Text>
                    </View>
                    <View style={local.inputGroup}>
                        <Text style={local.label}>New Daily Rate (₹)</Text>
                        <TextInput
                            style={local.input}
                            keyboardType="numeric"
                            placeholder="Enter new rate"
                            value={newRate}
                            onChangeText={setNewRate}
                            placeholderTextColor={isDark ? "#888" : "#999"}
                        />
                    </View>
                </View>
            </CustomModal>
        </KeyboardAvoidingView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: isDark ? "#0e0e0e" : "#f0f2f5",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: isDark ? "#0e0e0e" : "#f0f2f5",
        gap: 12,
    },
    loadingText: {
        color: isDark ? '#aaa' : '#666',
        fontSize: 15,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 16,
        paddingTop: 20,
    },

    // Header
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 18,
        marginTop: 10,
    },
    backButton: {
        padding: 8,
        borderRadius: 10,
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    editButton: {
        paddingVertical: 8,
        paddingHorizontal: 18,
        borderRadius: 10,
        backgroundColor: isDark ? "#173a5a" : "#e3f2fd",
    },
    editButtonText: {
        color: isDark ? "#64b5f6" : "#0a84ff",
        fontWeight: "700",
        fontSize: 14,
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        color: isDark ? "#fff" : "#1e1e2e",
    },

    // Profile card
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? "#1e1e1e" : '#fff',
        borderRadius: 18,
        padding: 18,
        marginBottom: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.3 : 0.07,
        shadowRadius: 10,
        elevation: 3,
        gap: 14,
    },
    avatarContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: isDark ? '#333' : '#bdbdbd',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    profileName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: isDark ? '#fff' : '#1e1e2e',
        marginBottom: 2,
    },
    profileId: {
        fontSize: 12,
        color: isDark ? '#888' : '#999',
        marginBottom: 6,
    },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 5,
    },
    statusText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    rateBox: {
        alignItems: 'flex-end',
        flexShrink: 0,
    },
    rateAmount: {
        fontSize: 20,
        fontWeight: '800',
        color: isDark ? '#81c784' : '#2e7d32',
    },
    rateLabel: {
        fontSize: 11,
        color: isDark ? '#888' : '#999',
    },

    // Quick actions
    actionRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 14,
        gap: 10,
    },
    actionBtn: {
        flex: 1,
        flexDirection: "row",
        backgroundColor: "#0a84ff",
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#0a84ff",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
        gap: 8,
    },
    actionBtnText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 14,
    },

    // Form container (personal/work info)
    formContainer: {
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        borderRadius: 18,
        padding: 20,
        marginBottom: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.25 : 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionCategory: {
        fontSize: 11,
        fontWeight: "700",
        color: isDark ? "#666" : "#999",
        marginBottom: 16,
        marginTop: 4,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    sectionHeaderRowAccordion: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 4,
    },
    accordionBody: {
        marginTop: 16,
    },
    inputGroup: {
        marginBottom: 14,
    },
    label: {
        fontSize: 12,
        fontWeight: "600",
        color: isDark ? "#bbb" : "#636e72",
        marginBottom: 6,
        marginLeft: 2,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: isDark ? "#2a2a2a" : "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isDark ? "#444" : "#e1e1e1",
        paddingHorizontal: 14,
        height: 50,
    },
    readOnlyContainer: {
        backgroundColor: isDark ? "#1a1a1a" : "#f8f9fa",
        borderColor: isDark ? "#2e2e2e" : "#f0f0f0",
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: isDark ? "#fff" : "#2d3436",
        height: "100%",
    },
    inputText: {
        flex: 1,
        fontSize: 15,
        color: isDark ? "#fff" : "#2d3436",
    },
    divider: {
        height: 1,
        backgroundColor: isDark ? "#2a2a2a" : "#f0f0f0",
        marginVertical: 16,
    },
    saveButton: {
        backgroundColor: "#0a84ff",
        borderRadius: 12,
        height: 52,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 16,
        shadowColor: "#0a84ff",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledButton: {
        backgroundColor: "#a0cfff",
        shadowOpacity: 0,
    },
    saveButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },

    // ── Section cards ──
    sectionCard: {
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        borderRadius: 18,
        padding: 18,
        marginBottom: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.25 : 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: isDark ? "#e0e0e0" : "#1e1e2e",
    },
    countBadge: {
        backgroundColor: isDark ? "#2a2a2a" : "#f0f4ff",
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    countBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: isDark ? '#64b5f6' : '#0a84ff',
    },

    // Section states
    sectionCenter: {
        alignItems: 'center',
        paddingVertical: 24,
        gap: 8,
    },
    sectionSubText: {
        fontSize: 14,
        color: isDark ? '#555' : '#bbb',
        textAlign: 'center',
    },
    retryBtn: {
        marginTop: 4,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: isDark ? '#2a2a2a' : '#f0f4ff',
        borderRadius: 8,
    },
    retryBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: isDark ? '#64b5f6' : '#0a84ff',
    },

    // Stats row
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 4,
    },
    statBox: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
        color: isDark ? '#fff' : '#1e1e2e',
    },
    statLabel: {
        fontSize: 11,
        color: isDark ? '#666' : '#999',
        marginTop: 2,
        textAlign: 'center',
    },

    // Record rows
    recordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? '#2a2a2a' : '#f5f5f5',
        gap: 10,
    },
    recordLeft: {
        flex: 1,
    },
    recordRight: {
        alignItems: 'flex-end',
    },
    recordDate: {
        fontSize: 14,
        fontWeight: '600',
        color: isDark ? '#e0e0e0' : '#333',
    },
    recordSub: {
        fontSize: 12,
        color: isDark ? '#666' : '#aaa',
        marginTop: 2,
    },
    recordPrimary: {
        fontSize: 15,
        fontWeight: '700',
        color: isDark ? '#64b5f6' : '#0a84ff',
    },
    recordSecondary: {
        fontSize: 12,
        color: isDark ? '#888' : '#aaa',
        marginTop: 2,
    },

    // Status chips
    statusChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusChipText: {
        fontSize: 12,
        fontWeight: '700',
    },

    // Sites worked
    siteIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: isDark ? '#1a2a3a' : '#e3f2fd',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // More text
    moreText: {
        textAlign: 'center',
        marginTop: 12,
        fontSize: 13,
        color: isDark ? '#555' : '#bbb',
        fontStyle: 'italic',
    },

    // Modals
    modalForm: {
        paddingTop: 10,
        width: "100%",
    },
});
