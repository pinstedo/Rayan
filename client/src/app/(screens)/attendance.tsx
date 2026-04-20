import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Calendar } from "../../components/Calendar";
import { CustomModal, ModalType } from "../../components/CustomModal";
import { FilterOption, FilterPanel, SearchBar, SortOption, SortSelector } from "../../components/list";
import { useTheme } from "../../context/ThemeContext";
import { useListManager } from "../../hooks/useListManager";
import { api } from "../../services/api";

interface Labour {
	id: number;
	name: string;
	role: string;
	site?: string;
	site_id?: number | string;
	rate?: number;
	status?: string;
}
const sortOptions: SortOption[] = [
	{ label: "Name", field: "name", type: "string" },
	{ label: "Role", field: "role", type: "string" }
];

const filterOptions: FilterOption[] = [
	{
		label: "Attendance Status",
		field: "attendance_status",
		type: "select",
		options: [
			{ label: "Pending", value: "pending" },
			{ label: "Full", value: "full" },
			{ label: "Half", value: "half" },
			{ label: "Absent", value: "absent" }
		]
	}
];

export default function AttendanceScreen() {
	const router = useRouter();
	const { isDark } = useTheme();
	const local = getStyles(isDark);
	const { siteId, siteName, dateStr } = useLocalSearchParams();
	const [labours, setLabours] = useState<Labour[]>([]);
	const [attendance, setAttendance] = useState<Map<number, 'full' | 'half' | 'absent'>>(new Map());
	const [overtimeData, setOvertimeData] = useState<Map<number, number>>(new Map());
	const [foodAllowanceData, setFoodAllowanceData] = useState<Map<number, { enabled: boolean; amount: string }>>(new Map());
	const [globalFoodRate, setGlobalFoodRate] = useState(70);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [date, setDate] = useState(dateStr && typeof dateStr === 'string' ? new Date(dateStr) : new Date());
	const [locked, setLocked] = useState(false);
	const [foodProvided, setFoodProvided] = useState(false);
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

	const initialData = useMemo(() => labours.map(l => ({
		...l,
		attendance_status: attendance.get(l.id) || 'pending'
	})), [labours, attendance]);

	const listManager = useListManager<Labour & { attendance_status: string }>({
		initialData,
		initialConfig: {
			search: { text: "", fields: ["name", "role", "site"] },
			sort: [{ field: "name", order: "asc", type: "string" }]
		}
	});

	useEffect(() => {
		const checkAdmin = async () => {
			const userDataStr = await AsyncStorage.getItem("userData");
			if (userDataStr) {
				const userData = JSON.parse(userDataStr);
				setIsAdmin(userData.role === 'admin');
			}
		};
		checkAdmin();
		// Fetch global food allowance rate
		const fetchRate = async () => {
			try {
				const res = await api.get('/settings/food-allowance-rate');
				if (res.ok) {
					const data = await res.json();
					setGlobalFoodRate(data.rate ?? 70);
				}
			} catch { /* use default */ }
		};
		fetchRate();
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
		fetchLabours();
		fetchExistingAttendance();
		fetchExistingOvertime();
	}, [date]);

	const fetchLabours = async (isRefresh = false) => {
		try {
			if (!isRefresh) setLoading(true);
			let response;
			if (siteId) {
				const year = date.getFullYear();
				const month = String(date.getMonth() + 1).padStart(2, '0');
				const day = String(date.getDate()).padStart(2, '0');
				const dateStrForApi = `${year}-${month}-${day}`;
				response = await api.get(`/labours/by-site-date?siteId=${siteId}&date=${dateStrForApi}`);
			} else {
				response = await api.get('/labours?status=active');
			}
			const data = await response.json();

			if (response.ok) {
				const filteredData = data.filter((l: any) => {
					if (siteId) return true; // Backend already filters for specific site and date
					const s = l.status?.toLowerCase() || 'active';
					// Skip unassigned/pending as they shouldn't be here, keep active, on_leave, inactive (to show disabled states)
					return s !== 'unassigned' && s !== 'pending';
				}).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
				setLabours(filteredData); // List manager handles sorting
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
				const newFoodAllowance = new Map<number, { enabled: boolean; amount: string }>();
				data.forEach((record: any) => {
					newAttendance.set(record.labour_id, record.status);
					newFoodAllowance.set(record.labour_id, {
						enabled: !!record.food_allowance,
						amount: record.food_allowance ? String(record.food_allowance_amount ?? globalFoodRate) : String(globalFoodRate),
					});
				});
				setAttendance(newAttendance);
				setFoodAllowanceData(newFoodAllowance);
			} else {
				setAttendance(new Map());
				setFoodAllowanceData(new Map());
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

			const records = Array.from(attendance.entries()).map(([labourId, status]) => {
				const fa = foodAllowanceData.get(labourId);
				return {
					labour_id: labourId,
					site_id: siteId,
					supervisor_id: userData.id,
					date: dateStr,
					status,
					food_allowance: fa?.enabled ?? false,
					food_allowance_amount: fa?.enabled ? (parseFloat(fa.amount) || 0) : 0,
				};
			});

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

	// Filter logic replaced by listManager

	const renderItem = ({ item }: { item: Labour & { attendance_status: string } }) => {
		const status = attendance.get(item.id);
		const labourStatus = item.status?.toLowerCase() || 'active';
		// If we are looking at a specific site (not global view), the backend has already verified 
		// they were active and assigned to this site on the selected date. So we don't lock them based on their *current* status/site.
		const isLabourActive = siteId ? true : (labourStatus === 'active');
		const isSiteMatch = isGlobalView || !siteId || true; // Always true if siteId is present because backend filters it
		const itemLocked = !canEdit || !isLabourActive || !isSiteMatch;

		return (
			<View style={[local.card, !isLabourActive && { opacity: 0.7 }]}>
				<View style={local.labourInfo}>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
						<Text style={local.labourName}>{item.name}</Text>
						{labourStatus === 'on_leave' && (
							<View style={{ backgroundColor: '#ff9800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
								<Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>On Leave</Text>
							</View>
						)}
						{labourStatus === 'inactive' && !siteId && (
							<View style={{ backgroundColor: isDark ? '#444' : '#e0e0e0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
								<Text style={{ color: isDark ? '#aaa' : '#666', fontSize: 10, fontWeight: 'bold' }}>Inactive</Text>
							</View>
						)}
						{!isSiteMatch && (
							<View style={{ backgroundColor: '#f44336', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
								<Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>Wrong Site</Text>
							</View>
						)}
					</View>
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

				{/* Per-Labour Food Allowance */}
				{!isGlobalView && (() => {
					const fa = foodAllowanceData.get(item.id) ?? { enabled: false, amount: String(globalFoodRate) };
					return (
						<View style={local.foodAllowRow}>
							<View style={local.foodAllowLeft}>
								<MaterialIcons name="restaurant" size={16} color={fa.enabled ? (isDark ? '#81C784' : '#388E3C') : (isDark ? '#555' : '#bbb')} />
								<Text style={[local.foodAllowLabel, fa.enabled && local.foodAllowLabelActive]}>
									Food Allowance
								</Text>
							</View>
							<View style={local.foodAllowRight}>
								{fa.enabled && isAdmin && (
									<View style={local.foodAmountInputWrap}>
										<Text style={local.rupeeSign}>₹</Text>
										<TextInput
											style={local.foodAmountInput}
											value={fa.amount}
											onChangeText={(val) => {
												if (!itemLocked) {
													setFoodAllowanceData(prev => {
														const m = new Map(prev);
														m.set(item.id, { enabled: true, amount: val });
														return m;
													});
												}
											}}
											keyboardType="numeric"
											editable={!itemLocked}
											selectTextOnFocus
										/>
									</View>
								)}
								<Switch
									value={fa.enabled}
									onValueChange={(val) => {
										if (!itemLocked) {
											setFoodAllowanceData(prev => {
												const m = new Map(prev);
												m.set(item.id, { enabled: val, amount: String(globalFoodRate) });
												return m;
											});
										}
									}}
									disabled={itemLocked}
									trackColor={{ false: isDark ? '#444' : '#ccc', true: isDark ? '#2E7D32' : '#81C784' }}
									thumbColor={fa.enabled ? '#4CAF50' : (isDark ? '#888' : '#f4f3f4')}
								/>
							</View>
						</View>
					);
				})()}
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
				<View>
					<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
						<Text style={{ fontSize: 14, color: isDark ? '#aaa' : '#666', fontWeight: 'bold' }}>Total Labours: {labours.length}</Text>
						<Pressable
							style={local.dateSelector}
							onPress={() => setShowCalendar(true)}
						>
							<MaterialIcons name="calendar-today" size={20} color={isDark ? "#64b5f6" : "#0a84ff"} />
							<Text style={local.dateSelectorText}>{date.toLocaleDateString()}</Text>
						</Pressable>
					</View>

					<View style={local.controlsRow}>
						<SearchBar
							value={listManager.searchText}
							onChangeText={listManager.setSearchText}
							placeholder="Search by name..."
							style={local.searchBar}
						/>
						<View style={local.actionRow}>
							<FilterPanel
								availableFilters={filterOptions}
								activeFilters={listManager.config.filters || []}
								onApplyFilter={listManager.addFilter}
								onRemoveFilter={listManager.removeFilter}
							/>
							<SortSelector
								options={sortOptions}
								currentSort={listManager.config.sort?.[0]}
								onSortChange={listManager.toggleSort}
							/>
						</View>
					</View>
				</View>
			) : (
				<View>
					<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
						<View>
							<Text style={local.siteName}>{decodeURIComponent(siteName as string)}</Text>
							<Text style={{ fontSize: 14, color: isDark ? '#aaa' : '#666' }}>Total Labours: {labours.length}</Text>
						</View>

						<Pressable
							style={local.dateSelector}
							onPress={() => setShowCalendar(true)}
						>
							<MaterialIcons name="calendar-today" size={20} color={isDark ? "#64b5f6" : "#0a84ff"} />
							<Text style={local.dateSelectorText}>{date.toLocaleDateString()}</Text>
						</Pressable>
					</View>

					<View style={local.controlsRow}>
						<SearchBar
							value={listManager.searchText}
							onChangeText={listManager.setSearchText}
							placeholder="Search by name..."
							style={local.searchBar}
						/>
						<View style={local.actionRow}>
							<FilterPanel
								availableFilters={filterOptions}
								activeFilters={listManager.config.filters || []}
								onApplyFilter={listManager.addFilter}
								onRemoveFilter={listManager.removeFilter}
							/>
							<SortSelector
								options={sortOptions}
								currentSort={listManager.config.sort?.[0]}
								onSortChange={listManager.toggleSort}
							/>
						</View>
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
		<ScrollView style={local.container}>
			<View style={local.headerRow}>
				<Pressable onPress={() => router.back()} style={local.backBtnText}>
					<MaterialIcons name="arrow-back" size={20} color={isDark ? "#4da6ff" : "#0a84ff"} />
					<Text style={local.backText}>Back</Text>
				</Pressable>
				<Text style={local.headerTitle}>{isGlobalView ? "All Attendance" : "Mark Attendance"}</Text>
				<View style={{ width: 24 }} />
			</View>

			<FlatList
				data={listManager.data}
				renderItem={renderItem}
				keyExtractor={(item) => item.id.toString()}
				contentContainerStyle={local.listContent}
				ListHeaderComponent={ListHeader}
				ListEmptyComponent={
					!loading ? (
						<Text style={local.emptyText}>No results found.</Text>
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
		</ScrollView>
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
	controlsRow: {
		paddingTop: 8,
		paddingBottom: 4,
	},
	searchBar: {
		marginBottom: 12,
	},
	actionRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 8,
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
	foodAllowRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: 10,
		paddingTop: 10,
		borderTopWidth: 1,
		borderTopColor: isDark ? '#333' : '#eee',
	},
	foodAllowLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		flex: 1,
	},
	foodAllowLabel: {
		fontSize: 14,
		fontWeight: '500',
		color: isDark ? '#aaa' : '#666',
	},
	foodAllowLabelActive: {
		color: isDark ? '#81C784' : '#388E3C',
		fontWeight: '600',
	},
	foodAllowRight: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	foodAmountInputWrap: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: isDark ? '#1a3320' : '#f0faf2',
		borderRadius: 8,
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderWidth: 1,
		borderColor: isDark ? '#2e7d32' : '#81C784',
	},
	rupeeSign: {
		fontSize: 14,
		color: isDark ? '#81C784' : '#388E3C',
		fontWeight: '700',
		marginRight: 2,
	},
	foodAmountInput: {
		fontSize: 15,
		fontWeight: '700',
		color: isDark ? '#fff' : '#333',
		minWidth: 52,
		maxWidth: 80,
		textAlign: 'right',
		paddingVertical: 2,
	},
	otValueDisabled: {
		color: isDark ? "#666" : "#aaa",
	}
});

