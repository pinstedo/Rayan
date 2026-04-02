import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";

// Helper for date formatting
const formatDate = (date: Date) => date.toISOString().split('T')[0];

interface Labour {
	id: number;
	name: string;
	role: string;
	site?: string;
	site_id?: number;
	rate?: number;
}

interface OvertimeRecord {
	id?: number;
	labour_id: number;
	hours: number | string;
	amount: number;
	notes?: string;
}

export default function OvertimeScreen() {
	const router = useRouter();
	const { isDark } = useTheme();
	const local = getStyles(isDark);
	const { siteId, siteName } = useLocalSearchParams();
	const [labours, setLabours] = useState<Labour[]>([]);
	const [overtimeData, setOvertimeData] = useState<Map<number, OvertimeRecord>>(new Map());
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [date, setDate] = useState(new Date());
	const [isAdmin, setIsAdmin] = useState(false);

	const [refreshing, setRefreshing] = useState(false);

	const isGlobalView = !siteId;

	useEffect(() => {
		checkRole();
		fetchLabours();
	}, [siteId]);

	useEffect(() => {
		fetchExistingOvertime();
	}, [date, siteId]);

	const checkRole = async () => {
		try {
			const userDataStr = await AsyncStorage.getItem("userData");
			if (userDataStr) {
				const userData = JSON.parse(userDataStr);
				setIsAdmin(userData.role === "admin");
			}
		} catch (error) {
			console.error("Error loading user role:", error);
		}
	};

	const fetchLabours = async (isRefresh = false) => {
		try {
			if (!isRefresh) setLoading(true);
			let response;
			if (siteId) {
				response = await api.get(`/sites/${siteId}/labours`);
			} else {
				let supId;
				const userDataStr = await AsyncStorage.getItem("userData");
				if (userDataStr) {
					const userData = JSON.parse(userDataStr);
					if (userData.role === "supervisor") {
						supId = userData.id;
					}
				}
				response = await api.post('/labours/filter', {
					status: 'active',
					supervisor_id: supId
				});
			}
			const data = await response.json();

			if (response.ok) {
				setLabours(data);
			} else {
				Alert.alert("Error", "Failed to fetch labours");
			}
		} catch (error) {
			console.error("Fetch labours error:", error);
			Alert.alert("Error", "Unable to connect to server");
		} finally {
			if (!isRefresh) setLoading(false);
		}
	};

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await Promise.all([fetchLabours(true), fetchExistingOvertime()]);
		} finally {
			setRefreshing(false);
		}
	};

	const fetchExistingOvertime = async () => {
		try {
			const dateStr = formatDate(date);
			const response = await api.post('/overtime/fetch', { date: dateStr, site_id: siteId || undefined });
			const data = await response.json();

			if (response.ok && Array.isArray(data)) {
				const newMap = new Map();
				data.forEach((record: any) => {
					newMap.set(record.labour_id, record);
				});
				setOvertimeData(newMap);
			}
		} catch (error) {
			console.error("Fetch overtime error:", error);
		}
	};

	const handleHoursChange = (labour: Labour, text: string) => {
		// Allow empty string or valid decimal numbers (e.g., "0", "0.", "0.5")
		if (text !== "" && !/^\d*\.?\d*$/.test(text)) return;

		setOvertimeData(prev => {
			const newMap = new Map(prev);
			const current = newMap.get(labour.id) || { labour_id: labour.id, hours: 0, amount: 0 };

			if (text === "") {
				newMap.set(labour.id, {
					...current,
					hours: 0,
					amount: 0
				});
			} else {
				const rate = labour.rate || 0;
				const parsedHours = parseFloat(text) || 0;
				newMap.set(labour.id, {
					...current,
					hours: text, // Store exact text to preserve trailing dot
					amount: parsedHours * rate
				});
			}
			return newMap;
		});
	};

	const handleSubmit = async () => {
		if (overtimeData.size === 0) {
			Alert.alert("Info", "No overtime data to save");
			return;
		}

		try {
			setSubmitting(true);
			const userDataStr = await AsyncStorage.getItem("userData");
			if (!userDataStr) return;
			const userData = JSON.parse(userDataStr);

			const bulkData: any[] = [];

			// Prepare bulk data
			for (const [labourId, record] of overtimeData.entries()) {
				// Find labour to get site_id if global view
				const labour = labours.find(l => l.id === labourId);
				const recordSiteId = siteId || labour?.site_id;

				if (!recordSiteId) {
					console.warn(`Site ID missing for labour ${labourId}`);
					continue;
				}

				// Send all records, even if hours is 0 (to allow updates/clearing)
				const parsedHours = typeof record.hours === 'string' ? parseFloat(record.hours) || 0 : record.hours;
				bulkData.push({
					labour_id: labourId,
					site_id: recordSiteId,
					date: formatDate(date),
					hours: parsedHours,
					amount: record.amount,
					notes: record.notes,
					created_by: userData.id
				});
			}

			if (bulkData.length === 0) {
				Alert.alert("Info", "No overtime data to save");
				return;
			}

			const response = await api.post("/overtime", bulkData);

			if (response.ok) {
				Alert.alert("Success", "Overtime saved successfully");
				fetchExistingOvertime(); // Refresh
			} else {
				const data = await response.json();
				Alert.alert("Error", data.error || "Failed to save");
			}
		} catch (error) {
			console.error("Save overtime error:", error);
			Alert.alert("Error", "Unable to connect to server");
		} finally {
			setSubmitting(false);
		}
	};

	const renderItem = ({ item }: { item: Labour }) => {
		const record = overtimeData.get(item.id);
		// If hours is string, keep it (e.g., "0."), otherwise convert number to string
		const hours = record ? (typeof record.hours === 'string' ? record.hours : record.hours.toString()) : "0";
		const amount = record ? record.amount.toFixed(2) : "0.00";
		const rate = item.rate || 0;

		return (
			<View style={local.card}>
				<View style={local.cardHeader}>
					<View>
						<Text style={local.labourName}>{item.name}</Text>
						<Text style={local.labourRole}>{item.role}</Text>
						{isGlobalView && item.site && (
							<Text style={local.siteInfo}>Site: {item.site}</Text>
						)}
						{isAdmin && (
							<Text style={local.rateInfo}>Rate: ₹{rate}/hr</Text>
						)}
					</View>
				</View>

				<View style={local.inputRow}>
					<View style={local.inputContainer}>
						<Text style={local.label}>Hours</Text>
						<TextInput
							style={local.input}
							value={hours}
							onChangeText={(text) => handleHoursChange(item, text)}
							keyboardType="numeric"
							placeholder="0"
							placeholderTextColor={isDark ? "#888" : "#999"}
						/>
					</View>

					{isAdmin && (
						<View style={local.inputContainer}>
							<Text style={local.label}>Amount</Text>
							<TextInput
								style={[local.input, local.readOnlyInput]}
								value={amount}
								editable={false}
							/>
						</View>
					)}

				</View>
			</View>
		);
	};

	return (
		<View style={local.container}>
			<View style={local.header}>
				<Pressable onPress={() => router.back()} style={local.backBtn}>
					<MaterialIcons name="arrow-back" size={24} color={isDark ? "#fff" : "#333"} />
				</Pressable>
				<Text style={local.headerTitle}>Overtime</Text>
				<View style={{ width: 24 }} />
			</View>

			<View style={local.subHeader}>
				{siteName ? (
					<Text style={local.siteName}>{decodeURIComponent(siteName as string)}</Text>
				) : (
					<Text style={local.siteName}>All Sites</Text>
				)}
				{/* Simple Date Display/Control */}
				<View style={local.dateContainer}>
					<Text style={local.dateLabel}>Date:</Text>
					<Text style={local.dateText}>{formatDate(date)}</Text>
				</View>
			</View>

			<FlatList
				data={labours}
				renderItem={renderItem}
				keyExtractor={(item) => item.id.toString()}
				contentContainerStyle={local.listContent}
				ListEmptyComponent={
					!loading ? <Text style={local.emptyText}>No labours found.</Text> : null
				}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0a84ff']} />
				}
			/>

			<View style={local.footer}>
				<Pressable
					style={[local.submitBtn, submitting && local.disabledBtn]}
					onPress={handleSubmit}
					disabled={submitting}
				>
					<Text style={local.submitBtnText}>
						{submitting ? "Submitting..." : "Submit Overtime"}
					</Text>
				</Pressable>
			</View>
		</View>
	);
}

const getStyles = (isDark: boolean) => StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: isDark ? "#121212" : "#f5f5f5",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: 16,
		backgroundColor: isDark ? "#1e1e1e" : "#fff",
		elevation: 2,
		marginTop: 20
	},
	backBtn: {
		padding: 4,
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
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	siteName: {
		fontSize: 16,
		fontWeight: "600",
		color: isDark ? "#4da6ff" : "#0a84ff",
	},
	dateContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: isDark ? "#333" : "#f0f0f0",
		padding: 8,
		borderRadius: 8,
	},
	dateLabel: {
		fontSize: 14,
		color: isDark ? "#aaa" : "#666",
		marginRight: 8,
	},
	dateText: {
		fontSize: 14,
		fontWeight: "bold",
		color: isDark ? "#fff" : "#333",
	},
	listContent: {
		padding: 16,
		paddingBottom: 40,
	},
	card: {
		backgroundColor: isDark ? "#1e1e1e" : "#fff",
		borderRadius: 12,
		padding: 16,
		marginBottom: 12,
		elevation: 1,
	},
	cardHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
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
	siteInfo: {
		fontSize: 12,
		color: isDark ? "#64b5f6" : "#0a84ff",
		marginTop: 2,
	},
	rateInfo: {
		fontSize: 12,
		color: isDark ? "#4caf50" : "#4CAF50",
		marginTop: 2,
		fontWeight: "bold",
	},
	inputRow: {
		flexDirection: "row",
		alignItems: "flex-end",
		gap: 12,
	},
	inputContainer: {
		flex: 1,
	},
	label: {
		fontSize: 12,
		color: isDark ? "#aaa" : "#666",
		marginBottom: 4,
	},
	input: {
		borderWidth: 1,
		borderColor: isDark ? "#444" : "#ddd",
		borderRadius: 8,
		padding: 10,
		fontSize: 16,
		backgroundColor: isDark ? "#2a2a2a" : "#fff",
		color: isDark ? "#fff" : "#333",
	},
	readOnlyInput: {
		backgroundColor: isDark ? "#1a1a1a" : "#f9f9f9",
		color: isDark ? "#888" : "#666",
		borderColor: isDark ? "#333" : "#ddd",
	},

	emptyText: {
		textAlign: "center",
		marginTop: 40,
		color: isDark ? "#aaa" : "#999",
		fontSize: 16,
	},
	footer: {
		padding: 16,
		backgroundColor: isDark ? "#1e1e1e" : "#fff",
		borderTopWidth: 1,
		borderTopColor: isDark ? "#333" : "#eee",
	},
	submitBtn: {
		backgroundColor: "#0a84ff",
		borderRadius: 12,
		paddingVertical: 16,
		alignItems: "center",
		elevation: 2,
	},
	disabledBtn: {
		backgroundColor: isDark ? "#555" : "#a0cfff",
	},
	submitBtnText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "bold",
	},
});
