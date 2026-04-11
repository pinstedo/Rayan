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
    RefreshControl,
    ScrollView,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { API_URL } from "../../constants";
import { useTheme } from "../../context/ThemeContext";
import { EditProfileModal } from "../components/EditProfileModal";
import { styles } from "../style/stylesheet";

const LabourDashboard = () => {
    const router = useRouter();
    const { theme, toggleTheme, isDark } = useTheme();
    const [labour, setLabour] = useState<any>(null);
    const [attendance, setAttendance] = useState<any[]>([]);
    const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [showSideMenu, setShowSideMenu] = useState(false);

    // Report Feature State
    const [showReportModal, setShowReportModal] = useState(false);
    const [complaintText, setComplaintText] = useState("");
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);

    const fetchData = async () => {
        try {
            setError(null);
            const token = await AsyncStorage.getItem("token");
            if (!token) {
                router.replace("/auth/labour-login" as any);
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
                if (attData.length > 0) {
                    setSelectedAttendance(attData[0]);
                }
            } else {
                console.error("Failed to fetch attendance:", attData.error);
                // Non-critical error, don't block dashboard
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

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? "#121212" : "#f5f5f5" }}>
                <ActivityIndicator size="large" color="#007bff" />
            </View>
        );
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
                        padding: 10,
                        borderRadius: 5,
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
                        padding: 10,
                        borderRadius: 5,
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
            case 'full': return 'green';
            case 'half': return 'orange';
            case 'absent': return 'red';
            default: return 'gray';
        }
    };

    const calculateAge = (dobString: string) => {
        if (!dobString) return '-';
        const dob = new Date(dobString);
        const diffMs = Date.now() - dob.getTime();
        const ageDate = new Date(diffMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };

    return (
        <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#f5f5f5" }}>
            <View style={[styles.header, {
                backgroundColor: isDark ? "#1e1e1e" : "#0056b3",
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 18,
                borderBottomLeftRadius: 20,
                borderBottomRightRadius: 20,
                elevation: 6,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                marginBottom: 10
            }]}>
                <TouchableOpacity onPress={() => setShowSideMenu(true)} style={{ marginRight: 20 }}>
                    <MaterialIcons name="menu" size={30} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { textAlign: 'left', fontSize: 22, fontWeight: '800' }]}>
                        Overview
                    </Text>
                    {labour && (
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 }}>
                            Welcome back, {labour.name.split(' ')[0]}
                        </Text>
                    )}
                </View>
                {labour?.profile_image && (
                    <Image source={{ uri: labour.profile_image }} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' }} />
                )}
            </View>

            <ScrollView
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0a84ff']} />
                }
                contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
            >
                {/* Attendance Summary Card (Current Month) */}
                <View style={[styles.card, {
                    padding: 20,
                    marginBottom: 25,
                    backgroundColor: isDark ? "#1e1e1e" : "#fff",
                    borderRadius: 16,
                    elevation: 3,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3
                }]}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? "#fff" : "#1a1a1a", marginBottom: 15, textAlign: 'center' }}>
                        This Month ({new Date().toLocaleString('default', { month: 'long', year: 'numeric' })})
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#28a745' }}>
                                {attendance.filter(a => {
                                    const date = new Date(a.date);
                                    const now = new Date();
                                    return a.status === 'full' && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                                }).length}
                            </Text>
                            <Text style={{ fontSize: 13, color: isDark ? '#aaa' : '#666', marginTop: 4, fontWeight: '600' }}>Present</Text>
                        </View>
                        <View style={{ width: 1, backgroundColor: isDark ? '#333' : '#eee', height: '100%' }} />
                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fd7e14' }}>
                                {attendance.filter(a => {
                                    const date = new Date(a.date);
                                    const now = new Date();
                                    return a.status === 'half' && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                                }).length}
                            </Text>
                            <Text style={{ fontSize: 13, color: isDark ? '#aaa' : '#666', marginTop: 4, fontWeight: '600' }}>Half Day</Text>
                        </View>
                        <View style={{ width: 1, backgroundColor: isDark ? '#333' : '#eee', height: '100%' }} />
                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#dc3545' }}>
                                {attendance.filter(a => {
                                    const date = new Date(a.date);
                                    const now = new Date();
                                    return a.status === 'absent' && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                                }).length}
                            </Text>
                            <Text style={{ fontSize: 13, color: isDark ? '#aaa' : '#666', marginTop: 4, fontWeight: '600' }}>Absent</Text>
                        </View>
                    </View>
                </View>

                {/* Attendance List Header */}
                <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 15, color: isDark ? "#fff" : "#1a1a1a", marginLeft: 4 }}>
                    Recent Attendance
                </Text>

                {attendance.length === 0 ? (
                    <Text style={{ textAlign: "center", marginTop: 20, color: isDark ? "#aaa" : "#666" }}>
                        No attendance records found.
                    </Text>
                ) : (
                    <View style={{ marginBottom: 20 }}>
                        {attendance.map((item, index) => {
                            const dateObj = new Date(item.date);
                            const day = dateObj.getDate();
                            const month = dateObj.toLocaleString('default', { month: 'short' });

                            return (
                                <TouchableOpacity
                                    key={index}
                                    onPress={() => setSelectedAttendance(item)}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: isDark ? "#1e1e1e" : "#fff",
                                        borderRadius: 12,
                                        padding: 15,
                                        marginBottom: 10,
                                        elevation: 2,
                                        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
                                        borderLeftWidth: 4,
                                        borderLeftColor: getStatusColor(item.status)
                                    }}
                                >
                                    <View style={{ width: 50, alignItems: 'center', justifyContent: 'center', marginRight: 15 }}>
                                        <Text style={{ fontSize: 22, fontWeight: 'bold', color: isDark ? '#fff' : '#000' }}>{day}</Text>
                                        <Text style={{ fontSize: 12, color: isDark ? '#aaa' : '#666', textTransform: 'uppercase' }}>{month}</Text>
                                    </View>

                                    <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: isDark ? '#333' : '#eee', paddingLeft: 15 }}>
                                        <Text style={{ fontSize: 16, fontWeight: '600', color: isDark ? '#fff' : '#000', marginBottom: 4 }}>
                                            {item.site_name || "Unknown Site"}
                                        </Text>
                                        <Text style={{ fontSize: 13, color: isDark ? '#aaa' : '#666' }}>
                                            Supervisor: {item.supervisor_name || "N/A"}
                                        </Text>
                                    </View>

                                    <View style={{
                                        backgroundColor: getStatusColor(item.status) + '20',
                                        paddingHorizontal: 10,
                                        paddingVertical: 5,
                                        borderRadius: 20
                                    }}>
                                        <Text style={{
                                            color: getStatusColor(item.status) === 'gray' ? (isDark ? '#aaa' : '#666') : getStatusColor(item.status),
                                            fontWeight: 'bold',
                                            fontSize: 12,
                                            textTransform: 'capitalize'
                                        }}>
                                            {item.status}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}

                        {/* Detailed View Modal Form replacing the inline view */}
                        {selectedAttendance && (
                            <Modal visible={!!selectedAttendance} transparent animationType="fade" onRequestClose={() => setSelectedAttendance(null)}>
                                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                                    <View style={[styles.card, { width: '85%', padding: 20, backgroundColor: isDark ? "#1e1e1e" : "#fff", borderRadius: 16 }]}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: isDark ? "#fff" : "#000" }}>
                                                Attendance Details
                                            </Text>
                                            <TouchableOpacity onPress={() => setSelectedAttendance(null)}>
                                                <MaterialIcons name="close" size={24} color={isDark ? "#fff" : "#000"} />
                                            </TouchableOpacity>
                                        </View>
                                        <View style={[styles.divider, { backgroundColor: isDark ? "#333" : "#ccc", marginBottom: 15 }]} />
                                        <DetailRow label="Date" value={selectedAttendance.date} isDark={isDark} />
                                        <DetailRow label="Status" value={selectedAttendance.status.toUpperCase()} isDark={isDark} />
                                        <DetailRow label="Site" value={selectedAttendance.site_name || "Unknown Site"} isDark={isDark} />
                                        <DetailRow label="Supervisor" value={selectedAttendance.supervisor_name || "N/A"} isDark={isDark} />
                                    </View>
                                </View>
                            </Modal>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Side Menu Overlay */}
            <Modal visible={showSideMenu} transparent animationType="fade" onRequestClose={() => setShowSideMenu(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' }}>
                    {/* Menu Content */}
                    <View style={{ width: '85%', backgroundColor: isDark ? "#121212" : "#f5f5f5", height: '100%', padding: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 22, fontWeight: 'bold', color: isDark ? "#fff" : "#000" }}>Menu</Text>
                            <TouchableOpacity onPress={() => setShowSideMenu(false)}>
                                <MaterialIcons name="close" size={28} color={isDark ? "#fff" : "#000"} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                            {/* Personal Details inside Menu */}
                            {labour && (
                                <View style={[styles.card, { marginBottom: 20, backgroundColor: isDark ? "#1e1e1e" : "#fff" }]}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={[styles.cardTitle, { color: isDark ? "#fff" : "#000" }]}>Personal Details</Text>
                                        <TouchableOpacity onPress={() => { setShowSideMenu(false); setShowEditProfile(true); }}>
                                            <MaterialIcons name="edit" size={24} color="#007bff" />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={[styles.divider, { backgroundColor: isDark ? "#333" : "#ccc" }]} />

                                    <View style={{ alignItems: 'center', marginBottom: 15 }}>
                                        {labour.profile_image ? (
                                            <Image source={{ uri: labour.profile_image }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                                        ) : (
                                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: isDark ? '#333' : '#eee', justifyContent: 'center', alignItems: 'center' }}>
                                                <MaterialIcons name="person" size={50} color={isDark ? "#888" : "#ccc"} />
                                            </View>
                                        )}
                                    </View>

                                    <DetailRow label="Name" value={labour.name} isDark={isDark} />
                                    <DetailRow label="Phone" value={labour.phone} isDark={isDark} />
                                    <DetailRow label="Age" value={labour.date_of_birth ? `${calculateAge(labour.date_of_birth)} yrs` : '-'} isDark={isDark} />
                                    <DetailRow label="Emergency Contact" value={labour.emergency_phone} isDark={isDark} />
                                    <DetailRow label="Rate" value={`₹${labour.rate}/hour`} isDark={isDark} />
                                    <DetailRow label="Status" value={labour.status} isDark={isDark} />
                                </View>
                            )}

                            {/* Dark Mode Toggle */}
                            <View style={[styles.card, { marginBottom: 20, padding: 15, backgroundColor: isDark ? "#1e1e1e" : "#fff", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
                                <Text style={{ fontSize: 16, fontWeight: "500", color: isDark ? "#fff" : "#000" }}>Dark Mode</Text>
                                <Switch
                                    value={isDark}
                                    onValueChange={toggleTheme}
                                    trackColor={{ false: "#ccc", true: "#0a84ff" }}
                                    thumbColor={isDark ? "#fff" : "#f4f3f4"}
                                />
                            </View>

                            {/* Report Grievance Button */}
                            <TouchableOpacity
                                style={[styles.card, { marginBottom: 20, padding: 18, backgroundColor: isDark ? "#2d1b1b" : "#fff0f0", flexDirection: "row", justifyContent: "center", alignItems: "center", borderColor: '#ff4d4f', borderWidth: 1 }]}
                                onPress={() => { setShowSideMenu(false); setShowReportModal(true); }}
                            >
                                <MaterialIcons name="report-problem" size={20} color="#ff4d4f" style={{ marginRight: 8 }} />
                                <Text style={{ fontSize: 16, fontWeight: "600", color: "#ff4d4f" }}>Report Issue / Grievance</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        {/* Logout Button at bottom of Menu */}
                        <TouchableOpacity
                            onPress={handleLogout}
                            style={{
                                backgroundColor: isDark ? '#3f1a1a' : '#FF3B30',
                                padding: 15,
                                borderRadius: 8,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: 'auto'
                            }}
                        >
                            <Text style={{ color: isDark ? "#ef4444" : "white", fontWeight: "bold", fontSize: 16 }}>Logout</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Clickable Overlay to close menu */}
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowSideMenu(false)} />
                </View>
            </Modal>

            <EditProfileModal
                visible={showEditProfile}
                onClose={() => setShowEditProfile(false)}
                labour={labour}
                onSave={handleUpdateProfile}
            />

            {/* Report Grievance Modal Overlay */}
            {showReportModal && (
                <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    justifyContent: 'center', alignItems: 'center',
                    zIndex: 1000, elevation: 10
                }}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ width: '100%', alignItems: 'center' }}
                        enabled={Platform.OS !== "web"}
                    >
                        <View style={{
                            backgroundColor: isDark ? '#1e1e1e' : '#fff',
                            width: '85%',
                            borderRadius: 16,
                            padding: 24,
                            elevation: 5,
                            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84
                        }}>
                            <Text style={{ fontSize: 20, fontWeight: 'bold', color: isDark ? '#fff' : '#000', marginBottom: 16 }}>
                                Report Issue to Admin
                            </Text>

                            <Text style={{ color: isDark ? '#aaa' : '#666', marginBottom: 12, fontSize: 14 }}>
                                Please describe your complaint or grievance below. This will be sent directly to the site administrators.
                            </Text>

                            <TextInput
                                style={{
                                    backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
                                    color: isDark ? '#fff' : '#000',
                                    borderWidth: 1,
                                    borderColor: isDark ? '#444' : '#e0e0e0',
                                    borderRadius: 8,
                                    padding: 12,
                                    height: 120,
                                    textAlignVertical: 'top',
                                    marginBottom: 20
                                }}
                                placeholder="Write your complaint here..."
                                placeholderTextColor={isDark ? '#888' : '#aaa'}
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
                                    <Text style={{ color: isDark ? '#aaa' : '#666', fontWeight: '600' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleReportSubmit}
                                    style={{
                                        backgroundColor: '#0a84ff',
                                        paddingVertical: 10, paddingHorizontal: 20,
                                        borderRadius: 8,
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

const DetailRow = ({ label, value, isDark }: { label: string; value: string; isDark: boolean }) => (
    <View
        style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 8,
        }}
    >
        <Text style={{ color: isDark ? "#aaa" : "#666", fontWeight: "600" }}>{label}</Text>
        <Text style={{ fontWeight: "bold", color: isDark ? "#fff" : "#000" }}>{value || "-"}</Text>
    </View>
);

export default LabourDashboard;
