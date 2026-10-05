import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { AppRefreshControl, LoadingScreen, TopRefreshLoader } from "../../components/RefreshFeedback";
import { API_URL } from "../../constants";
import { useTheme } from "../../context/ThemeContext";
import { getDailyWage } from "../../utils/wages";
import { EditProfileModal } from "../components/EditProfileModal";
import { styles } from "../style/stylesheet";

const BONUS_THRESHOLD = 285;
const INCREMENT_THRESHOLD = 300;

const LabourDashboard = () => {
    const router = useRouter();
    const { theme, toggleTheme, isDark } = useTheme();
    const [labour, setLabour] = useState<any>(null);

    useEffect(() => {
        const checkPasswordReset = async () => {
            const userData = await AsyncStorage.getItem("userData");
            if (userData) {
                const user = JSON.parse(userData);
                if (user.password_reset_required) {
                    router.replace("/auth/create-new-password" as any);
                }
            }
        };
        checkPasswordReset();
    }, []);

    const [attendance, setAttendance] = useState<any[]>([]);
    const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [showSideMenu, setShowSideMenu] = useState(false);

    // Month Selector State
    const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(new Date());
    const [showMonthPickerModal, setShowMonthPickerModal] = useState(false);

    // Report Feature State
    const [showReportModal, setShowReportModal] = useState(false);
    const [complaintText, setComplaintText] = useState("");
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);

    const fetchData = async () => {
        try {
            setError(null);
            const userDataStr = await AsyncStorage.getItem("userData");
            if (userDataStr) {
                const user = JSON.parse(userDataStr);
                if (user.password_reset_required) {
                    router.replace("/auth/create-new-password" as any);
                    return;
                }
            }

            const token = await AsyncStorage.getItem("token");
            if (!token) {
                router.replace("/auth/verificationau" as any);
                return;
            }

            // Fetch Labour Details
            const labourRes = await fetch(`${API_URL}/labours/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const labourData = await labourRes.json();

            if (labourRes.ok) {
                setLabour(labourData);
            } else {
                if (labourData.password_reset_required) {
                    router.replace("/auth/create-new-password" as any);
                    return;
                }
                if (labourRes.status === 401 || labourRes.status === 403) {
                    await handleLogout();
                    return;
                }
                const errorMessage = labourData.error || "Failed to fetch labour details";
                console.log("Fetch error:", errorMessage);
                setError(errorMessage);
                return;
            }

            // Fetch Attendance
            const attRes = await fetch(`${API_URL}/attendance/my-attendance`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const attData = await attRes.json();

            if (attRes.ok) {
                setAttendance(attData);
            } else {
                console.error("Failed to fetch attendance:", attData.error);
            }

        } catch (error: any) {
            console.error("Error fetching data:", error);
            setError(error.message || "Network error");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleLogout = async () => {
        await AsyncStorage.clear();
        router.replace("/auth/authentication");
    };

    const handleUpdateProfile = async (updatedData: any) => {
        try {
            const token = await AsyncStorage.getItem("token");
            const response = await fetch(`${API_URL}/labours/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(updatedData)
            });

            if (response.ok) {
                const updatedLabour = await response.json();
                setLabour(updatedLabour);
                setShowEditProfile(false);
            } else {
                const errorData = await response.json();
                alert(`Update failed: ${errorData.error}`);
            }
        } catch (error) {
            console.error("Update error:", error);
            alert("Failed to update profile");
        }
    };

    const handleReportSubmit = async () => {
        if (!complaintText.trim()) {
            Alert.alert("Validation", "Please enter a complaint.");
            return;
        }

        try {
            setIsSubmittingReport(true);
            const token = await AsyncStorage.getItem("token");
            const response = await fetch(`${API_URL}/reports/complaints`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ complaint: complaintText })
            });

            if (response.ok) {
                Alert.alert("Success", "Your grievance has been reported to the admin.");
                setShowReportModal(false);
                setComplaintText("");
            } else {
                const errorData = await response.json();
                Alert.alert("Error", errorData.error || "Failed to submit report.");
            }
        } catch (error) {
            console.error("Report submit error:", error);
            Alert.alert("Error", "Network error. Failed to submit report.");
        } finally {
            setIsSubmittingReport(false);
        }
    };

    // Month navigation helpers
    const changeMonth = (delta: number) => {
        const newDate = new Date(selectedMonthDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setSelectedMonthDate(newDate);
    };

    const getMonthList = () => {
        const list = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            list.push(d);
        }
        return list;
    };

    if (loading) {
        return <LoadingScreen label="Loading dashboard..." />;
    }

    if (error) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: isDark ? "#121212" : "#f5f5f5" }}>
                <Text style={{ fontSize: 18, color: 'red', marginBottom: 10, textAlign: 'center' }}>
                    {error}
                </Text>
                <TouchableOpacity
                    onPress={fetchData}
                    style={{
                        backgroundColor: '#007bff',
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 10,
                        width: '100%',
                        alignItems: 'center'
                    }}
                >
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleLogout}
                    style={{
                        backgroundColor: '#6c757d',
                        padding: 12,
                        borderRadius: 8,
                        width: '100%',
                        alignItems: 'center'
                    }}
                >
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Logout</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'full': return '#10b981';
            case 'half': return '#f59e0b';
            case 'absent': return '#ef4444';
            default: return '#6b7280';
        }
    };

    const calculateAge = (dobString: string) => {
        if (!dobString) return '-';
        const dob = new Date(dobString);
        const diffMs = Date.now() - dob.getTime();
        const ageDate = new Date(diffMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };

    // Calculations for Bonus and Increment Loaders
    const bonusDays = Number(labour?.continuous_working_days ?? labour?.worked_days_count ?? 0);
    const bonusProgressPct = Math.min(100, Math.round((bonusDays / BONUS_THRESHOLD) * 100));
    const bonusDaysLeft = Math.max(0, BONUS_THRESHOLD - bonusDays);
    const isBonusEligible = bonusDays >= BONUS_THRESHOLD;
    const totalBonusEarned = Number(labour?.total_bonus_earned || 0);

    const incDays = Number(labour?.increment_continuous_days ?? labour?.continuous_working_days ?? labour?.worked_days_count ?? 0);
    const incProgressPct = Math.min(100, Math.round((incDays / INCREMENT_THRESHOLD) * 100));
    const incDaysLeft = Math.max(0, INCREMENT_THRESHOLD - incDays);
    const isIncEligible = incDays >= INCREMENT_THRESHOLD;
    const incrementCycle = Number(labour?.increment_cycle_count || 0);

    // Monthwise Filtered Data & Statistics
    const filteredAttendance = attendance.filter((a) => {
        if (!a.date) return false;
        const d = new Date(a.date);
        return (
            d.getFullYear() === selectedMonthDate.getFullYear() &&
            d.getMonth() === selectedMonthDate.getMonth()
        );
    });

    const presentCount = filteredAttendance.filter(a => a.status === 'full').length;
    const halfCount = filteredAttendance.filter(a => a.status === 'half').length;
    const absentCount = filteredAttendance.filter(a => a.status === 'absent').length;
    const effectiveDays = presentCount + halfCount * 0.5;
    const dailyWageRate = labour ? getDailyWage(labour) : 0;
    const estimatedEarnings = effectiveDays * dailyWageRate;

    const formattedSelectedMonth = selectedMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const isCurrentMonth = selectedMonthDate.getFullYear() === new Date().getFullYear() && selectedMonthDate.getMonth() === new Date().getMonth();

    return (
        <View style={{ flex: 1, backgroundColor: isDark ? "#0f172a" : "#f8fafc" }}>
            {/* Header Section */}
            <View style={{
                backgroundColor: isDark ? "#1e293b" : "#1e40af",
                paddingHorizontal: 20,
                paddingTop: Platform.OS === 'ios' ? 50 : 20,
                paddingBottom: 20,
                borderBottomLeftRadius: 24,
                borderBottomRightRadius: 24,
                elevation: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 6,
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <TouchableOpacity
                        onPress={() => setShowSideMenu(true)}
                        style={{
                            padding: 8,
                            borderRadius: 12,
                            backgroundColor: 'rgba(255,255,255,0.15)'
                        }}
                    >
                        <MaterialIcons name="menu" size={26} color="#fff" />
                    </TouchableOpacity>

                    <View style={{ flex: 1, marginLeft: 16 }}>
                        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Labour Portal
                        </Text>
                        <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff' }}>
                            {labour?.name || "Welcome Back"}
                        </Text>
                    </View>

                    {labour?.profile_image ? (
                        <Image source={{ uri: labour.profile_image }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#ffffff' }} />
                    ) : (
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                            <MaterialIcons name="person" size={26} color="#ffffff" />
                        </View>
                    )}
                </View>

                {/* Quick Info Bar */}
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 16,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 14
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="currency-inr" size={18} color="#fef08a" />
                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14, marginLeft: 4 }}>
                            ₹{dailyWageRate.toFixed(0)} / day
                        </Text>
                    </View>
                    <View style={{ height: 14, width: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="briefcase-outline" size={16} color="#bfdbfe" />
                        <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 13, marginLeft: 6 }}>
                            {labour?.site || 'Active Labour'}
                        </Text>
                    </View>
                </View>
            </View>

            <ScrollView
                refreshControl={
                    <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                <TopRefreshLoader visible={refreshing} />

                {/* BONUS & INCREMENT COMPLETION RING LOADERS SECTION */}
                <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: isDark ? "#f8fafc" : "#0f172a", marginBottom: 4 }}>
                        Milestone Progress
                    </Text>

                    <Text style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 16 }}>
                        Continuous working days towards your next reward
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 12 }}>

                    {/* Bonus Ring Loader */}
                    <View style={{
                        flex: 1,
                        backgroundColor: isDark ? "#1e293b" : "#ffffff",
                        borderRadius: 20,
                        paddingVertical: 22,
                        paddingHorizontal: 14,
                        alignItems: 'center',
                        elevation: 4,
                        shadowColor: '#f59e0b',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.15,
                        shadowRadius: 6,
                    }}>
                        <RingProgress
                            pct={bonusProgressPct}
                            color={isBonusEligible ? '#10b981' : '#f59e0b'}
                            trackColor={isDark ? '#334155' : '#e2e8f0'}
                            size={110}
                            strokeWidth={10}
                            label={`${Math.round(bonusDays)}/${BONUS_THRESHOLD}`}
                            sublabel="days"
                            isDark={isDark}
                        />
                        <View style={{
                            marginTop: 12,
                            backgroundColor: isBonusEligible ? '#dcfce7' : (isDark ? '#3b2d13' : '#fef3c7'),
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 12,
                        }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: isBonusEligible ? '#15803d' : '#d97706' }}>
                                {isBonusEligible ? '🎉 Eligible!' : `${Math.ceil(bonusDaysLeft)} days left`}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'center', marginTop: 12 }}>
                            <MaterialCommunityIcons name="gift" size={22} color="#d97706" />
                            <Text style={{ fontSize: 14, fontWeight: '800', color: isDark ? '#ffffff' : '#1e293b', marginTop: 4 }}>
                                Bonus
                            </Text>
                            <Text style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', textAlign: 'center', marginTop: 2 }}>
                                Earned: ₹{totalBonusEarned.toFixed(0)}
                            </Text>
                        </View>
                    </View>

                    {/* Increment Ring Loader */}
                    <View style={{
                        flex: 1,
                        backgroundColor: isDark ? "#1e293b" : "#ffffff",
                        borderRadius: 20,
                        paddingVertical: 22,
                        paddingHorizontal: 14,
                        alignItems: 'center',
                        elevation: 4,
                        shadowColor: '#10b981',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.15,
                        shadowRadius: 6,
                    }}>
                        <RingProgress
                            pct={incProgressPct}
                            color='#10b981'
                            trackColor={isDark ? '#334155' : '#e2e8f0'}
                            size={110}
                            strokeWidth={10}
                            label={`${Math.round(incDays)}/${INCREMENT_THRESHOLD}`}
                            sublabel="days"
                            isDark={isDark}
                        />
                        <View style={{
                            marginTop: 12,
                            backgroundColor: isIncEligible ? '#dcfce7' : (isDark ? '#14382c' : '#d1fae5'),
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 12,
                        }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: isIncEligible ? '#15803d' : '#059669' }}>
                                {isIncEligible ? '🚀 Eligible!' : `${Math.ceil(incDaysLeft)} days left`}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'center', marginTop: 12 }}>
                            <MaterialCommunityIcons name="trending-up" size={22} color="#059669" />
                            <Text style={{ fontSize: 14, fontWeight: '800', color: isDark ? '#ffffff' : '#1e293b', marginTop: 4 }}>
                                Increment
                            </Text>
                            <Text style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', textAlign: 'center', marginTop: 2 }}>
                                Cycle #{incrementCycle}
                            </Text>
                        </View>
                    </View>

                    </View>
                </View>

                {/* MONTHWISE DATA SELECTOR & READOUT SECTION */}
                <View style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: isDark ? "#f8fafc" : "#0f172a" }}>
                            Monthwise Records
                        </Text>
                        <TouchableOpacity
                            onPress={() => setShowMonthPickerModal(true)}
                            style={{ flexDirection: 'row', alignItems: 'center' }}
                        >
                            <Text style={{ color: '#2563eb', fontWeight: '700', fontSize: 13, marginRight: 2 }}>
                                Change Month
                            </Text>
                            <MaterialIcons name="arrow-drop-down" size={20} color="#2563eb" />
                        </TouchableOpacity>
                    </View>

                    {/* Month Navigator Header Bar */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isDark ? "#1e293b" : "#ffffff",
                        borderRadius: 16,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        elevation: 2,
                        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
                        marginBottom: 14
                    }}>
                        <TouchableOpacity
                            onPress={() => changeMonth(-1)}
                            style={{ padding: 8, borderRadius: 10, backgroundColor: isDark ? "#334155" : "#f1f5f9" }}
                        >
                            <MaterialIcons name="chevron-left" size={22} color={isDark ? "#ffffff" : "#1e293b"} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setShowMonthPickerModal(true)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        >
                            <MaterialCommunityIcons name="calendar-month" size={20} color="#2563eb" />
                            <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? "#ffffff" : "#1e293b" }}>
                                {formattedSelectedMonth}
                            </Text>
                            {isCurrentMonth && (
                                <View style={{ backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                    <Text style={{ fontSize: 10, color: '#1e40af', fontWeight: '700' }}>CURRENT</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => changeMonth(1)}
                            style={{ padding: 8, borderRadius: 10, backgroundColor: isDark ? "#334155" : "#f1f5f9" }}
                        >
                            <MaterialIcons name="chevron-right" size={22} color={isDark ? "#ffffff" : "#1e293b"} />
                        </TouchableOpacity>
                    </View>

                    {/* Monthwise Analytics Grid */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                        {/* Present */}
                        <View style={{
                            flex: 1,
                            minWidth: '45%',
                            backgroundColor: isDark ? "#1e293b" : "#ffffff",
                            padding: 14,
                            borderRadius: 14,
                            borderLeftWidth: 4,
                            borderLeftColor: '#10b981',
                            elevation: 2
                        }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", fontWeight: '600' }}>Present Days</Text>
                                <MaterialIcons name="check-circle" size={18} color="#10b981" />
                            </View>
                            <Text style={{ fontSize: 22, fontWeight: '800', color: '#10b981', marginTop: 4 }}>
                                {presentCount} <Text style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", fontWeight: '500' }}>days</Text>
                            </Text>
                        </View>

                        {/* Half Day */}
                        <View style={{
                            flex: 1,
                            minWidth: '45%',
                            backgroundColor: isDark ? "#1e293b" : "#ffffff",
                            padding: 14,
                            borderRadius: 14,
                            borderLeftWidth: 4,
                            borderLeftColor: '#f59e0b',
                            elevation: 2
                        }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", fontWeight: '600' }}>Half Days</Text>
                                <MaterialIcons name="schedule" size={18} color="#f59e0b" />
                            </View>
                            <Text style={{ fontSize: 22, fontWeight: '800', color: '#f59e0b', marginTop: 4 }}>
                                {halfCount} <Text style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", fontWeight: '500' }}>days</Text>
                            </Text>
                        </View>

                        {/* Absent */}
                        <View style={{
                            flex: 1,
                            minWidth: '45%',
                            backgroundColor: isDark ? "#1e293b" : "#ffffff",
                            padding: 14,
                            borderRadius: 14,
                            borderLeftWidth: 4,
                            borderLeftColor: '#ef4444',
                            elevation: 2
                        }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", fontWeight: '600' }}>Absent Days</Text>
                                <MaterialIcons name="cancel" size={18} color="#ef4444" />
                            </View>
                            <Text style={{ fontSize: 22, fontWeight: '800', color: '#ef4444', marginTop: 4 }}>
                                {absentCount} <Text style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", fontWeight: '500' }}>days</Text>
                            </Text>
                        </View>

                        {/* Est Earnings */}
                        <View style={{
                            flex: 1,
                            minWidth: '45%',
                            backgroundColor: isDark ? "#1e293b" : "#ffffff",
                            padding: 14,
                            borderRadius: 14,
                            borderLeftWidth: 4,
                            borderLeftColor: '#3b82f6',
                            elevation: 2
                        }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", fontWeight: '600' }}>Est. Wages</Text>
                                <MaterialCommunityIcons name="cash-multiple" size={18} color="#3b82f6" />
                            </View>
                            <Text style={{ fontSize: 20, fontWeight: '800', color: '#3b82f6', marginTop: 4 }}>
                                ₹{estimatedEarnings.toFixed(0)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* MONTHWISE ATTENDANCE LIST */}
                <View style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: isDark ? "#f8fafc" : "#0f172a" }}>
                            Attendance Records
                        </Text>
                        <Text style={{ fontSize: 13, color: isDark ? "#94a3b8" : "#64748b", fontWeight: '600' }}>
                            {filteredAttendance.length} entries
                        </Text>
                    </View>

                    {filteredAttendance.length === 0 ? (
                        <View style={{
                            backgroundColor: isDark ? "#1e293b" : "#ffffff",
                            padding: 30,
                            borderRadius: 16,
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <MaterialCommunityIcons name="calendar-blank-outline" size={48} color={isDark ? "#475569" : "#cbd5e1"} />
                            <Text style={{ marginTop: 12, fontSize: 15, fontWeight: '600', color: isDark ? "#94a3b8" : "#64748b", textAlign: 'center' }}>
                                No attendance records logged for {formattedSelectedMonth}.
                            </Text>
                        </View>
                    ) : (
                        <View>
                            {filteredAttendance.map((item, index) => {
                                const dateObj = new Date(item.date);
                                const day = dateObj.getDate();
                                const weekday = dateObj.toLocaleString('default', { weekday: 'short' });
                                const statusColor = getStatusColor(item.status);

                                return (
                                    <TouchableOpacity
                                        key={index}
                                        onPress={() => setSelectedAttendance(item)}
                                        activeOpacity={0.7}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: isDark ? "#1e293b" : "#ffffff",
                                            borderRadius: 14,
                                            padding: 14,
                                            marginBottom: 10,
                                            elevation: 2,
                                            shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
                                            borderLeftWidth: 4,
                                            borderLeftColor: statusColor
                                        }}
                                    >
                                        <View style={{ width: 48, alignItems: 'center', justifyContent: 'center', paddingRight: 10 }}>
                                            <Text style={{ fontSize: 20, fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a' }}>{day}</Text>
                                            <Text style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>{weekday}</Text>
                                        </View>

                                        <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: isDark ? '#334155' : '#f1f5f9', paddingLeft: 12 }}>
                                            <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#f8fafc' : '#0f172a', marginBottom: 2 }}>
                                                {item.site_name || "Assigned Site"}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                                                Supervisor: {item.supervisor_name || "N/A"}
                                            </Text>
                                        </View>

                                        <View style={{
                                            backgroundColor: statusColor + '20',
                                            paddingHorizontal: 10,
                                            paddingVertical: 4,
                                            borderRadius: 16
                                        }}>
                                            <Text style={{
                                                color: statusColor,
                                                fontWeight: '800',
                                                fontSize: 12,
                                                textTransform: 'capitalize'
                                            }}>
                                                {item.status}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Attendance Details Modal */}
            {selectedAttendance && (
                <Modal visible={!!selectedAttendance} transparent animationType="fade" onRequestClose={() => setSelectedAttendance(null)}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
                        <View style={[styles.card, { width: '85%', padding: 22, backgroundColor: isDark ? "#1e293b" : "#ffffff", borderRadius: 20 }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: isDark ? "#ffffff" : "#0f172a" }}>
                                    Attendance Details
                                </Text>
                                <TouchableOpacity onPress={() => setSelectedAttendance(null)}>
                                    <MaterialIcons name="close" size={24} color={isDark ? "#ffffff" : "#0f172a"} />
                                </TouchableOpacity>
                            </View>
                            <View style={[styles.divider, { backgroundColor: isDark ? "#334155" : "#e2e8f0", marginBottom: 16 }]} />
                            <DetailRow label="Date" value={selectedAttendance.date} isDark={isDark} />
                            <DetailRow label="Status" value={selectedAttendance.status.toUpperCase()} isDark={isDark} />
                            <DetailRow label="Site" value={selectedAttendance.site_name || "Assigned Site"} isDark={isDark} />
                            <DetailRow label="Supervisor" value={selectedAttendance.supervisor_name || "N/A"} isDark={isDark} />
                        </View>
                    </View>
                </Modal>
            )}

            {/* Quick Month Picker Modal */}
            <Modal visible={showMonthPickerModal} transparent animationType="fade" onRequestClose={() => setShowMonthPickerModal(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <View style={{
                        backgroundColor: isDark ? "#1e293b" : "#ffffff",
                        width: '90%',
                        maxHeight: '70%',
                        borderRadius: 20,
                        padding: 20,
                        elevation: 5
                    }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: isDark ? "#ffffff" : "#0f172a" }}>
                                Select Month
                            </Text>
                            <TouchableOpacity onPress={() => setShowMonthPickerModal(false)}>
                                <MaterialIcons name="close" size={24} color={isDark ? "#ffffff" : "#0f172a"} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {getMonthList().map((d, i) => {
                                const isSelected = d.getFullYear() === selectedMonthDate.getFullYear() && d.getMonth() === selectedMonthDate.getMonth();
                                const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
                                return (
                                    <TouchableOpacity
                                        key={i}
                                        onPress={() => {
                                            setSelectedMonthDate(d);
                                            setShowMonthPickerModal(false);
                                        }}
                                        style={{
                                            paddingVertical: 14,
                                            paddingHorizontal: 16,
                                            borderRadius: 12,
                                            marginBottom: 8,
                                            backgroundColor: isSelected ? '#2563eb' : (isDark ? '#334155' : '#f8fafc'),
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Text style={{
                                            fontSize: 15,
                                            fontWeight: isSelected ? '700' : '500',
                                            color: isSelected ? '#ffffff' : (isDark ? '#f8fafc' : '#1e293b')
                                        }}>
                                            {label}
                                        </Text>
                                        {isSelected && (
                                            <MaterialIcons name="check" size={20} color="#ffffff" />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Side Menu Overlay */}
            <Modal visible={showSideMenu} transparent animationType="fade" onRequestClose={() => setShowSideMenu(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' }}>
                    <View style={{ width: '85%', backgroundColor: isDark ? "#0f172a" : "#f8fafc", height: '100%', padding: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 22, fontWeight: 'bold', color: isDark ? "#ffffff" : "#0f172a" }}>Menu</Text>
                            <TouchableOpacity onPress={() => setShowSideMenu(false)}>
                                <MaterialIcons name="close" size={28} color={isDark ? "#ffffff" : "#0f172a"} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                            {labour && (
                                <View style={[styles.card, { marginBottom: 20, backgroundColor: isDark ? "#1e293b" : "#ffffff" }]}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={[styles.cardTitle, { color: isDark ? "#ffffff" : "#0f172a" }]}>Personal Details</Text>
                                        <TouchableOpacity onPress={() => { setShowSideMenu(false); setShowEditProfile(true); }}>
                                            <MaterialIcons name="edit" size={24} color="#2563eb" />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={[styles.divider, { backgroundColor: isDark ? "#334155" : "#e2e8f0" }]} />

                                    <View style={{ alignItems: 'center', marginBottom: 15 }}>
                                        {labour.profile_image ? (
                                            <Image source={{ uri: labour.profile_image }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                                        ) : (
                                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: isDark ? '#334155' : '#e2e8f0', justifyContent: 'center', alignItems: 'center' }}>
                                                <MaterialIcons name="person" size={50} color={isDark ? "#94a3b8" : "#94a3b8"} />
                                            </View>
                                        )}
                                    </View>

                                    <DetailRow label="Name" value={labour.name} isDark={isDark} />
                                    <DetailRow label="Phone" value={labour.phone} isDark={isDark} />
                                    <DetailRow label="Age" value={labour.date_of_birth ? `${calculateAge(labour.date_of_birth)} yrs` : '-'} isDark={isDark} />
                                    <DetailRow label="Emergency Contact" value={labour.emergency_phone} isDark={isDark} />
                                    <DetailRow label="Rate" value={`₹${dailyWageRate.toFixed(2)}/day`} isDark={isDark} />
                                    <DetailRow label="Status" value={labour.status} isDark={isDark} />
                                </View>
                            )}

                            {/* Dark Mode Toggle */}
                            <View style={[styles.card, { marginBottom: 20, padding: 15, backgroundColor: isDark ? "#1e293b" : "#ffffff", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
                                <Text style={{ fontSize: 16, fontWeight: "500", color: isDark ? "#ffffff" : "#0f172a" }}>Dark Mode</Text>
                                <Switch
                                    value={isDark}
                                    onValueChange={toggleTheme}
                                    trackColor={{ false: "#cbd5e1", true: "#2563eb" }}
                                    thumbColor={isDark ? "#ffffff" : "#f4f3f4"}
                                />
                            </View>

                            {/* Report Grievance Button */}
                            <TouchableOpacity
                                style={[styles.card, { marginBottom: 20, padding: 18, backgroundColor: isDark ? "#2d1b1b" : "#fff0f0", flexDirection: "row", justifyContent: "center", alignItems: "center", borderColor: '#ef4444', borderWidth: 1 }]}
                                onPress={() => { setShowSideMenu(false); setShowReportModal(true); }}
                            >
                                <MaterialIcons name="report-problem" size={20} color="#ef4444" style={{ marginRight: 8 }} />
                                <Text style={{ fontSize: 16, fontWeight: "600", color: "#ef4444" }}>Report Issue / Grievance</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        {/* Logout Button */}
                        <TouchableOpacity
                            onPress={handleLogout}
                            style={{
                                backgroundColor: isDark ? '#3f1a1a' : '#ef4444',
                                padding: 15,
                                borderRadius: 12,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: 'auto'
                            }}
                        >
                            <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>Logout</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowSideMenu(false)} />
                </View>
            </Modal>

            <EditProfileModal
                visible={showEditProfile}
                onClose={() => setShowEditProfile(false)}
                labour={labour}
                onSave={handleUpdateProfile}
            />

            {/* Report Grievance Modal */}
            {showReportModal && (
                <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    justifyContent: 'center', alignItems: 'center',
                    zIndex: 1000, elevation: 10
                }}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ width: '100%', alignItems: 'center' }}
                        enabled={Platform.OS !== "web"}
                    >
                        <View style={{
                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
                            width: '85%',
                            borderRadius: 20,
                            padding: 24,
                            elevation: 5,
                            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84
                        }}>
                            <Text style={{ fontSize: 20, fontWeight: 'bold', color: isDark ? '#ffffff' : '#0f172a', marginBottom: 16 }}>
                                Report Issue to Admin
                            </Text>

                            <Text style={{ color: isDark ? '#94a3b8' : '#64748b', marginBottom: 12, fontSize: 14 }}>
                                Please describe your complaint or grievance below. This will be sent directly to the site administrators.
                            </Text>

                            <TextInput
                                style={{
                                    backgroundColor: isDark ? '#334155' : '#f8fafc',
                                    color: isDark ? '#ffffff' : '#0f172a',
                                    borderWidth: 1,
                                    borderColor: isDark ? '#475569' : '#e2e8f0',
                                    borderRadius: 12,
                                    padding: 12,
                                    height: 120,
                                    textAlignVertical: 'top',
                                    marginBottom: 20
                                }}
                                placeholder="Write your complaint here..."
                                placeholderTextColor={isDark ? '#94a3b8' : '#94a3b8'}
                                multiline
                                numberOfLines={4}
                                value={complaintText}
                                onChangeText={setComplaintText}
                            />

                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                                <TouchableOpacity
                                    onPress={() => { setShowReportModal(false); setComplaintText(''); }}
                                    style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 }}
                                    disabled={isSubmittingReport}
                                >
                                    <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: '600' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleReportSubmit}
                                    style={{
                                        backgroundColor: '#2563eb',
                                        paddingVertical: 10, paddingHorizontal: 20,
                                        borderRadius: 10,
                                        flexDirection: 'row', alignItems: 'center', gap: 8,
                                        opacity: isSubmittingReport ? 0.7 : 1
                                    }}
                                    disabled={isSubmittingReport}
                                >
                                    {isSubmittingReport ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <MaterialIcons name="send" size={16} color="#fff" />
                                    )}
                                    <Text style={{ color: '#fff', fontWeight: '600' }}>
                                        {isSubmittingReport ? 'Sending...' : 'Send to Admin'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            )}
        </View>
    );
};

// ─── Ring Progress Component ────────────────────────────────────────────────

interface RingProgressProps {
    pct: number;          // 0-100
    color: string;
    trackColor: string;
    size: number;
    strokeWidth: number;
    label: string;        // centre main text e.g. "120/285"
    sublabel: string;     // centre sub text e.g. "days"
    isDark: boolean;
}

const RingProgress = ({ pct, color, trackColor, size, strokeWidth, label, sublabel, isDark }: RingProgressProps) => {
    // Clamp pct
    const safePct = Math.min(100, Math.max(0, pct));
    const halfSize = size / 2;

    // Convert pct to degrees. We draw two half-arcs.
    // First half covers 0-50%, second half covers 50-100%.
    const leftDeg  = safePct <= 50 ? (safePct / 50) * 180 : 180;  // left arc rotation
    const rightDeg = safePct > 50  ? ((safePct - 50) / 50) * 180 : 0; // right arc rotation

    return (
        <View style={{ width: size, height: size, position: 'relative' }}>
            {/* Track (background ring) */}
            <View style={{
                width: size,
                height: size,
                borderRadius: halfSize,
                borderWidth: strokeWidth,
                borderColor: trackColor,
                position: 'absolute',
            }} />

            {/* Left half-circle clip container */}
            <View style={{
                position: 'absolute',
                width: halfSize,
                height: size,
                overflow: 'hidden',
                left: 0,
            }}>
                <View style={{
                    width: size,
                    height: size,
                    borderRadius: halfSize,
                    borderWidth: strokeWidth,
                    borderColor: 'transparent',
                    borderLeftColor: safePct > 0 ? color : 'transparent',
                    borderTopColor: safePct > 25 ? color : 'transparent',
                    transform: [{ rotate: `${-90 + leftDeg}deg` }],
                }} />
            </View>

            {/* Right half-circle clip container */}
            <View style={{
                position: 'absolute',
                width: halfSize,
                height: size,
                overflow: 'hidden',
                right: 0,
            }}>
                <View style={{
                    width: size,
                    height: size,
                    borderRadius: halfSize,
                    borderWidth: strokeWidth,
                    borderColor: 'transparent',
                    borderRightColor: safePct > 50 ? color : 'transparent',
                    borderBottomColor: safePct >= 100 ? color : 'transparent',
                    position: 'absolute',
                    left: -halfSize,
                    transform: [{ rotate: `${-90 + rightDeg}deg` }],
                }} />
            </View>

            {/* Centre label */}
            <View style={{
                position: 'absolute',
                top: strokeWidth,
                left: strokeWidth,
                right: strokeWidth,
                bottom: strokeWidth,
                borderRadius: halfSize - strokeWidth,
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: isDark ? '#f8fafc' : '#0f172a', textAlign: 'center', lineHeight: 20 }}>
                    {label}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', marginTop: 2 }}>
                    {sublabel}
                </Text>
            </View>
        </View>
    );
};


const DetailRow = ({ label, value, isDark }: { label: string; value: string; isDark: boolean }) => (
    <View
        style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 10,
        }}
    >
        <Text style={{ color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600" }}>{label}</Text>
        <Text style={{ fontWeight: "bold", color: isDark ? "#ffffff" : "#0f172a" }}>{value || "-"}</Text>
    </View>
);


export default LabourDashboard;
