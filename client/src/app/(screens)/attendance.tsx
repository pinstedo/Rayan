import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from "react-native";
import { Calendar } from "../../components/Calendar";
import { CustomModal, ModalType } from "../../components/CustomModal";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";

interface Labour {
	id: number;
	name: string;
	role: string;
	site?: string;
	rate?: number;
}

export default function AttendanceScreen() {
	const router = useRouter();
	const { isDark } = useTheme();
	const local = getStyles(isDark);
	const { siteId, siteName, dateStr } = useLocalSearchParams();
	const [labours, setLabours] = useState<Labour[]>([]);
	const [attendance, setAttendance] = useState<Map<number, 'full' | 'half' | 'absent'>>(new Map());
	const [overtimeData, setOvertimeData] = useState<Map<number, number>>(new Map());
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [date, setDate] = useState(dateStr && typeof dateStr === 'string' ? new Date(dateStr) : new Date());
	const [locked, setLocked] = useState(false);
	const [foodProvided, setFoodProvided] = useState(false);
	const [filter, setFilter] = useState<'all' | 'full' | 'half' | 'absent'>('all');
	const [refreshing, setRefreshing] = useState(false);
	const [isAdmin, setIsAdmin] = useState(false);

	// State for calendar summary
	const [markedDates, setMarkedDates] = useState<string[]>([]);
	const [showCalendar, setShowCalendar] = useState(false);
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

	const isGlobalView = !siteId;
	const isToday = date.toDateString() === new Date().toDateString();
	const canEdit = !isGlobalView && (!locked || isAdmin);

	useEffect(() => {
		const checkAdmin = async () => {
			const userDataStr = await AsyncStorage.getItem("userData");
			if (userDataStr) {
				const userData = JSON.parse(userDataStr);
				setIsAdmin(userData.role === 'admin');
			}
		};
		checkAdmin();
	}, []);

	useEffect(() => {
		fetchLabours();
		if (!isGlobalView) {
			fetchLockStatus();
		}
	}, [siteId]);

	useEffect(() => {
		if (!isGlobalView) {
			fetchLockStatus();
		}
		// If global view, we need to refetch attendance when date changes
		// For site view, fetchLabours calls fetchExistingAttendance initially, but date change should also trigger it
		fetchExistingAttendance();
		fetchExistingOvertime();
	}, [date]);

	const fetchLabours = async (isRefresh = false) => {
		try {
			if (!isRefresh) setLoading(true);
			let response;
			if (siteId) {
				response = await api.get(`/sites/${siteId}/labours`);
			} else {
				response = await api.post('/labours/filter', { status: 'active' });
			}
			const data = await response.json();

			if (response.ok) {
				setLabours(data);
				// fetchExistingAttendance(data); // Removed argument as it's not used in implementation, and useEffect calls it anyway
			} else {
				showModal("Error", "Failed to fetch labours", 'error');
			}
		} catch (error) {
			console.error("Fetch labours error:", error);
			showModal("Error", error instanceof Error ? error.message : "Unable to connect to server", 'error');
		} finally {
			if (!isRefresh) setLoading(false);
		}
	};

	const fetchLockStatus = async () => {
		if (!siteId) return;
		try {
			// Using local time date string for consistency with Calendar component
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const dateStr = `${year}-${month}-${day}`;

			const response = await api.post(`/attendance/lock-status`, { site_id: siteId, date: dateStr });
			if (response.ok) {
				const data = await response.json();
				setLocked(data.is_locked);
				setFoodProvided(data.food_provided);
			}
		} catch (error) {
			console.error("Fetch lock status error:", error);
		}
	};

	const fetchAttendanceSummary = async (month: number, year: number) => {
		if (!siteId) return;
		try {
			const response = await api.post(`/attendance/summary`, { site_id: siteId, month, year });
			if (response.ok) {
				const data = await response.json();
				setMarkedDates(data.dates || []);
			}
		} catch (error) {
			console.error("Fetch summary error:", error);
		}
	};

	const fetchExistingAttendance = async () => {
		try {
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const dateStr = `${year}-${month}-${day}`;

			const response = await api.post('/attendance/fetch', { date: dateStr, site_id: siteId || undefined });
			const data = await response.json();

			if (response.ok && Array.isArray(data)) {
				const newAttendance = new Map();
				data.forEach((record: any) => {
					newAttendance.set(record.labour_id, record.status);
				});
				setAttendance(newAttendance);
			} else {
				// If fetching fails or empty (new day), clear attendance map
				setAttendance(new Map());
			}
		} catch (error) {
			console.error("Fetch existing attendance error", error);
		}
	};

	const fetchExistingOvertime = async () => {
		try {
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const dateStr = `${year}-${month}-${day}`;

			const response = await api.post('/overtime/fetch', { date: dateStr, site_id: siteId || undefined });
			const data = await response.json();

			if (response.ok && Array.isArray(data)) {
				const newOvertime = new Map();
				data.forEach((record: any) => {
					// Backend might return float for hours
					newOvertime.set(record.labour_id, typeof record.hours === 'number' ? record.hours : parseFloat(record.hours) || 0);
				});
				setOvertimeData(newOvertime);
			} else {
				setOvertimeData(new Map());
			}
		} catch (error) {
			console.error("Fetch existing overtime error", error);
			setOvertimeData(new Map());
		}
	};

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await Promise.all([
				fetchLabours(true),
				fetchExistingAttendance(),
				fetchExistingOvertime(),
				!isGlobalView ? fetchLockStatus() : Promise.resolve()
			]);
		} finally {
			setRefreshing(false);
		}
	};

	const handleStatusChange = (labourId: number, status: 'full' | 'half' | 'absent') => {
		if (isGlobalView || !canEdit) return; // Read-only in global view or if locked

		setAttendance(prev => {
			const newMap = new Map(prev);
			newMap.set(labourId, status);
			return newMap;
		});
	};

	const handleOvertimeChange = (labourId: number, delta: number) => {
		if (isGlobalView || !canEdit) return;

		setOvertimeData(prev => {
			const newMap = new Map(prev);
			const current = newMap.get(labourId) || 0;
			const newValue = Math.max(0, current + delta);
			newMap.set(labourId, newValue);
			return newMap;
		});
	};

	const handleSubmit = async () => {
		if (isGlobalView) return;

		if (attendance.size === 0) {
			showModal("Warning", "No attendance marked.", 'warning');
			return;
		}

		try {
			setSubmitting(true);
			const userDataStr = await AsyncStorage.getItem("userData");
			if (!userDataStr) {
				showModal("Error", "User session not found.", 'error');
				return;
			}
			const userData = JSON.parse(userDataStr);

			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const dateStr = `${year}-${month}-${day}`;

			const records = Array.from(attendance.entries()).map(([labourId, status]) => ({
				labour_id: labourId,
				site_id: siteId,
				supervisor_id: userData.id,
				date: dateStr,
				status
			}));

			const response = await api.post("/attendance", { records, food_provided: foodProvided });

			// If attendance submit succeeds, also submit overtime
			if (response.ok) {
				const overtimeRecords: any[] = [];
				for (const [labourId, hours] of overtimeData.entries()) {
					if (hours >= 0) { // Send 0 to allow clearing
						const labour = labours.find(l => l.id === labourId);
						const rate = labour?.rate || 0;
						overtimeRecords.push({
							labour_id: labourId,
							site_id: siteId,
							date: dateStr,
							hours: hours,
							amount: hours * rate,
							created_by: userData.id
						});
					}
				}

				if (overtimeRecords.length > 0) {
					await api.post("/overtime", overtimeRecords);
				}

				showModal("Success", "Attendance and Overtime marked successfully", 'success', [
					{
						text: "OK", onPress: () => {
							setModalConfig(prev => ({ ...prev, visible: false }));
							fetchLockStatus(); // Refresh lock status
							// Refresh calendar to show green
							fetchAttendanceSummary(date.getMonth() + 1, date.getFullYear());
						},
						style: 'default'
					}
				]);
			} else {
				const data = await response.json();
				showModal("Error", data.error || "Failed to submit attendance", 'error');
			}
		} catch (error) {
			console.error("Submit attendance error:", error);
			showModal("Error", error instanceof Error ? error.message : "Unable to connect to server", 'error');
		} finally {
			setSubmitting(false);
		}
	};

	const getFilteredLabours = () => {
		if (filter === 'all') return labours;
		return labours.filter(l => {
			const status = attendance.get(l.id);
			if (filter === 'absent') return !status || status === 'absent';
			return status === filter;
		});
	};

	const renderItem = ({ item }: { item: Labour }) => {
		const status = attendance.get(item.id);
		const itemLocked = !canEdit;

		return (
			<View style={local.card}>
				<View style={local.labourInfo}>
					<Text style={local.labourName}>{item.name}</Text>
					<Text style={local.labourRole}>{item.role}</Text>
					{isGlobalView && item.site && (
						<Text style={local.siteInfo}>Site: {item.site}</Text>
					)}
				</View>

				<View style={local.statusContainer}>
					<Pressable
						style={[local.statusBtn, status === 'full' && local.statusBtnActive, { backgroundColor: status === 'full' ? (isDark ? '#2e7d32' : '#4CAF50') : (isDark ? '#2a2a2a' : '#f0f0f0'), opacity: itemLocked ? 0.6 : 1 }]}
						onPress={() => !itemLocked && handleStatusChange(item.id, 'full')}
						disabled={itemLocked}
					>
						<Text style={[local.statusText, status === 'full' && local.statusTextActive]}>Full</Text>
					</Pressable>

					<Pressable
						style={[local.statusBtn, status === 'half' && local.statusBtnActive, { backgroundColor: status === 'half' ? (isDark ? '#f57f17' : '#FFC107') : (isDark ? '#2a2a2a' : '#f0f0f0'), opacity: itemLocked ? 0.6 : 1 }]}
						onPress={() => !itemLocked && handleStatusChange(item.id, 'half')}
						disabled={itemLocked}
					>
						<Text style={[local.statusText, status === 'half' && local.statusTextActive]}>Half</Text>
					</Pressable>

					<Pressable
						style={[local.statusBtn, status === 'absent' && local.statusBtnActive, { backgroundColor: status === 'absent' ? (isDark ? '#c62828' : '#F44336') : (isDark ? '#2a2a2a' : '#f0f0f0'), opacity: itemLocked ? 0.6 : 1 }]}
						onPress={() => !itemLocked && handleStatusChange(item.id, 'absent')}
						disabled={itemLocked}
					>
						<Text style={[local.statusText, status === 'absent' && local.statusTextActive]}>Absent</Text>
					</Pressable>
				</View>

				<View style={local.overtimeContainer}>
					<Text style={local.overtimeLabel}>OT Hours:</Text>
					<View style={local.overtimeControls}>
						<Pressable
							style={[local.otBtn, itemLocked && local.otBtnDisabled]}
							onPress={() => handleOvertimeChange(item.id, -0.5)}
							disabled={itemLocked || (overtimeData.get(item.id) || 0) <= 0}
						>
							<MaterialIcons name="remove" size={18} color={isDark ? "#fff" : "#333"} />
						</Pressable>
						<Text style={[local.otValue, itemLocked && local.otValueDisabled]}>
							{overtimeData.get(item.id) || 0}
						</Text>
						<Pressable
							style={[local.otBtn, itemLocked && local.otBtnDisabled]}
							onPress={() => handleOvertimeChange(item.id, 0.5)}
							disabled={itemLocked}
						>
							<MaterialIcons name="add" size={18} color={isDark ? "#fff" : "#333"} />
						</Pressable>
					</View>
				</View>
			</View>
		);
	};

	const onDateSelect = (selectedDate: Date) => {
		setDate(selectedDate);
		setShowCalendar(false);
	};

	// Header component for FlatList to avoid nesting ScrollViews
	const ListHeader = () => (
		<View style={local.subHeader}>
			{isGlobalView ? (
				<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
					<View style={local.filterContainer}>
						<Text style={local.filterLabel}>Filter:</Text>
						<Pressable onPress={() => setFilter(f => {
							if (f === 'all') return 'full';
							if (f === 'full') return 'half';
							if (f === 'half') return 'absent';
							return 'all';
						})} style={local.filterBtn}>
							<Text style={local.filterText}>{filter.toUpperCase()}</Text>
						</Pressable>
					</View>

					<Pressable
						style={local.dateSelector}
						onPress={() => setShowCalendar(true)}
					>
						<MaterialIcons name="calendar-today" size={20} color={isDark ? "#64b5f6" : "#0a84ff"} />
						<Text style={local.dateSelectorText}>{date.toLocaleDateString()}</Text>
					</Pressable>
				</View>
			) : (
				<View>
					<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
						<Text style={local.siteName}>{decodeURIComponent(siteName as string)}</Text>

						<Pressable
							style={local.dateSelector}
							onPress={() => setShowCalendar(true)}
						>
							<MaterialIcons name="calendar-today" size={20} color={isDark ? "#64b5f6" : "#0a84ff"} />
							<Text style={local.dateSelectorText}>{date.toLocaleDateString()}</Text>
						</Pressable>
					</View>

					<View style={local.foodToggleContainer}>
						<Text style={local.foodToggleText}>Food Provided by Supervisor</Text>
						<Switch
							value={foodProvided}
							onValueChange={(val) => { if (canEdit) setFoodProvided(val); }}
							disabled={!canEdit}
							trackColor={{ false: isDark ? "#444" : "#767577", true: isDark ? "#64b5f6" : "#81b0ff" }}
							thumbColor={foodProvided ? (isDark ? "#4da6ff" : "#0a84ff") : (isDark ? "#ccc" : "#f4f3f4")}
						/>
					</View>
				</View>
			)}
		</View>
	);

	return (
		<View style={local.container}>
			<View style={local.headerRow}>
				<Pressable onPress={() => router.back()} style={local.backBtnText}>
					<MaterialIcons name="arrow-back" size={20} color={isDark ? "#4da6ff" : "#0a84ff"} />
					<Text style={local.backText}>Back</Text>
				</Pressable>
				<Text style={local.headerTitle}>{isGlobalView ? "All Attendance" : "Mark Attendance"}</Text>
				<View style={{ width: 24 }} />
			</View>

			<FlatList
				data={getFilteredLabours()}
				renderItem={renderItem}
				keyExtractor={(item) => item.id.toString()}
				contentContainerStyle={local.listContent}
				ListHeaderComponent={ListHeader}
				ListEmptyComponent={
					!loading ? (
						<Text style={local.emptyText}>No labours found.</Text>
					) : null
				}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0a84ff']} />
				}
			/>

			<CustomModal
				visible={showCalendar}
				onClose={() => setShowCalendar(false)}
				title="Select Date"
				// type="date"
				actions={[
					{ text: "Cancel", onPress: () => setShowCalendar(false), style: "cancel" }
				]}
			>
				<Calendar
					selectedDate={date}
					onDateSelect={onDateSelect}
					markedDates={markedDates}
					onMonthChange={fetchAttendanceSummary}
				/>
			</CustomModal>

			<CustomModal
				visible={modalConfig.visible}
				onClose={() => setModalConfig(prev => ({ ...prev, visible: false }))}
				title={modalConfig.title}
				message={modalConfig.message}
				type={modalConfig.type}
				actions={modalConfig.actions}
			/>

			{!isGlobalView && (
				<View style={local.footer}>
					<Pressable
						style={[local.submitBtn, (submitting || !canEdit) && local.submitBtnDisabled]}
						onPress={handleSubmit}
						disabled={submitting || !canEdit}
					>
						<Text style={local.submitBtnText}>
							{submitting ? "Submitting..." : !canEdit ? "Attendance Locked" : "Submit Attendance"}
						</Text>
					</Pressable>
				</View>
			)}
		</View>
	);
}

const getStyles = (isDark: boolean) => StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: isDark ? "#121212" : "#f5f5f5",
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		paddingVertical: 15,
		paddingBottom: 15,
		backgroundColor: isDark ? '#1e1e1e' : '#fff',
		borderBottomWidth: 1,
		borderBottomColor: isDark ? '#333' : '#eee',
		marginTop: 20
	},
	backBtnText: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4
	},
	backText: {
		color: isDark ? '#4da6ff' : '#0a84ff',
		fontSize: 16
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: isDark ? "#fff" : "#333",
	},
	subHeader: {
		padding: 16,
		backgroundColor: isDark ? "#1e1e1e" : "#fff",
		marginTop: 1,
	},
	siteName: {
		fontSize: 16,
		fontWeight: "600",
		color: isDark ? "#4da6ff" : "#0a84ff",
		marginBottom: 8,
	},
	listContent: {
		padding: 16,
		paddingBottom: 100,
	},
	card: {
		backgroundColor: isDark ? "#1e1e1e" : "#fff",
		borderRadius: 12,
		padding: 16,
		marginBottom: 12,
		elevation: 1,
	},
	labourInfo: {
		marginBottom: 12,
	},
	labourName: {
		fontSize: 16,
		fontWeight: "600",
		color: isDark ? "#fff" : "#333",
	},
	labourRole: {
		fontSize: 14,
		color: isDark ? "#aaa" : "#666",
		marginTop: 2,
	},
	statusContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: 8,
	},
	statusBtn: {
		flex: 1,
		paddingVertical: 8,
		alignItems: "center",
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "transparent",
	},
	statusBtnActive: {
		borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
	},
	statusText: {
		fontSize: 14,
		fontWeight: "500",
		color: isDark ? "#aaa" : "#666",
	},
	statusTextActive: {
		color: "#fff",
		fontWeight: "bold",
	},
	footer: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: isDark ? "#1e1e1e" : "#fff",
		padding: 16,
		elevation: 4,
		borderTopWidth: 1,
		borderTopColor: isDark ? "#333" : "#eee",
	},
	submitBtn: {
		backgroundColor: "#0a84ff",
		paddingVertical: 14,
		borderRadius: 12,
		alignItems: "center",
	},
	submitBtnDisabled: {
		backgroundColor: isDark ? "#555" : "#a0cfff",
	},
	submitBtnText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "bold",
	},
	emptyText: {
		textAlign: "center",
		marginTop: 40,
		color: isDark ? "#aaa" : "#999",
		fontSize: 16,
	},
	filterContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	filterLabel: {
		fontSize: 14,
		color: isDark ? "#ccc" : "#666",
	},
	filterBtn: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		backgroundColor: isDark ? "#333" : "#e0e0e0",
		borderRadius: 16,
	},
	filterText: {
		fontSize: 12,
		fontWeight: "600",
		color: isDark ? "#fff" : "#333",
	},
	siteInfo: {
		fontSize: 12,
		color: isDark ? "#64b5f6" : "#0a84ff",
		marginTop: 2,
		fontWeight: "500",
	},
	// New Styles
	dateSelector: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: isDark ? "#173a5a" : '#e8f4ff',
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 8,
		gap: 8,
	},
	dateSelectorText: {
		fontSize: 14,
		color: isDark ? "#64b5f6" : '#0a84ff',
		fontWeight: '600',
	},
	foodToggleContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		backgroundColor: isDark ? "#1e1e1e" : '#fff',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: isDark ? "#333" : '#eee',
	},
	foodToggleText: {
		fontSize: 14,
		color: isDark ? "#fff" : '#333',
		flex: 1,
		marginRight: 8,
	},
	overtimeContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginTop: 12,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: isDark ? "#333" : "#eee",
	},
	overtimeLabel: {
		fontSize: 14,
		fontWeight: "500",
		color: isDark ? "#aaa" : "#666",
	},
	overtimeControls: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		backgroundColor: isDark ? "#2a2a2a" : "#f0f0f0",
		borderRadius: 8,
		paddingHorizontal: 8,
		paddingVertical: 4,
	},
	otBtn: {
		padding: 4,
		backgroundColor: isDark ? "#444" : "#e0e0e0",
		borderRadius: 4,
	},
	otBtnDisabled: {
		opacity: 0.5,
	},
	otValue: {
		fontSize: 16,
		fontWeight: "bold",
		color: isDark ? "#fff" : "#333",
		minWidth: 24,
		textAlign: "center",
	},
	otValueDisabled: {
		color: isDark ? "#666" : "#aaa",
	}
});
