import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	TouchableOpacity,
	View
} from "react-native";
import { CustomModal, ModalType } from "../../components/CustomModal";
import { API_URL } from "../../constants";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";
import { LabourCard } from "../components/LabourCard";

interface Site {
	id: number;
	name: string;
}

interface Labour {
	id: number;
	name: string;
	phone: string;
	trade: string;
	rate?: number;
	site: string;
	site_id?: number;
	status?: 'active' | 'terminated' | 'blacklisted';
	created_at?: string;
}

export default function Labours() {
	const router = useRouter();
	const { isDark } = useTheme();
	const local = getStyles(isDark);
	const { newLabour, supervisorId, status } = useLocalSearchParams();
	const [viewType, setViewType] = useState<'active' | 'inactive'>((status as 'active' | 'inactive') || 'active');
	const [labours, setLabours] = useState<Labour[]>([]);
	const [loading, setLoading] = useState(true);
	const [isAdmin, setIsAdmin] = useState(false);

	const [refreshing, setRefreshing] = useState(false);

	// Assignment Modal State
	const [showSitePicker, setShowSitePicker] = useState(false);
	const [selectedLabour, setSelectedLabour] = useState<Labour | null>(null);
	const [sites, setSites] = useState<Site[]>([]);
	const [assigning, setAssigning] = useState(false);
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
	useFocusEffect(
		useCallback(() => {
			checkRoleAndFetch();
		}, [supervisorId, viewType]) // Add viewType dependency
	);

	const checkRoleAndFetch = async () => {
		try {
			const userDataStr = await AsyncStorage.getItem("userData");
			if (userDataStr) {
				const userData = JSON.parse(userDataStr);
				setIsAdmin(userData.role === "admin");
				fetchLabours(userData.role === "supervisor" ? userData.id : supervisorId);
				if (userData.role === "admin") {
					fetchSites();
				}
			}
		} catch (error) {
			console.error("Error loading user role:", error);
		}
	};

	const fetchLabours = async (supId?: string | string[], isRefresh = false) => {
		try {
			if (isRefresh) {
				setRefreshing(true);
			} else {
				setLoading(true);
			}
			let url = `${API_URL}/labours?status=${viewType}`; // Add status param
			if (supId) {
				url += `&supervisor_id=${supId}`;
			}
			const response = await api.fetch(url);
			const data = await response.json();
			if (response.ok) {
				setLabours(data);
			}
		} catch (error) {
			console.error("Failed to fetch labours", error);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	const onRefresh = () => {
		checkRoleAndFetch(); // This will eventually call fetchLabours
	};

	const fetchSites = async () => {
		try {
			const response = await api.get("/sites");
			const data = await response.json();
			if (response.ok) {
				setSites(data);
			}
		} catch (error) {
			console.error("Failed to fetch sites", error);
		}
	};

	const handleMove = (labour: Labour) => {
		setSelectedLabour(labour);
		setShowSitePicker(true);
	};

	const handleAssignSite = async (site: Site) => {
		if (!selectedLabour) return;

		try {
			setAssigning(true);
			const response = await api.put(`/labours/${selectedLabour.id}`, {
				...selectedLabour,
				site: site.name,
				site_id: site.id,
			});

			if (response.ok) {
				showModal("Success", `Moved ${selectedLabour.name} to ${site.name}`, 'success');
				setShowSitePicker(false);
				fetchLabours(supervisorId); // Refresh list
			} else {
				const data = await response.json();
				showModal("Error", data.error || "Failed to move labour", 'error');
			}
		} catch (error) {
			console.error("Move labour error:", error);
			showModal("Error", "Unable to connect to server", 'error');
		} finally {
			setAssigning(false);
		}
	};

	const handleStatusChange = async (labour: Labour, newStatus: string) => {
		try {
			const response = await api.put(`/labours/${labour.id}/status`, { status: newStatus });

			if (response.ok) {
				showModal("Success", `Labour marked as ${newStatus}`, 'success');
				fetchLabours(supervisorId); // Refresh list
			} else {
				const data = await response.json();
				showModal("Error", data.error || "Failed to update status", 'error');
			}
		} catch (error) {
			console.error("Status update error:", error);
			showModal("Error", "Unable to connect to server", 'error');
		}
	};

	const handleTerminate = (labour: Labour) => {
		showModal(
			"Confirm Terminate",
			`Are you sure you want to terminate ${labour.name}?`,
			'confirmation',
			[
				{ text: "Cancel", onPress: () => setModalConfig(prev => ({ ...prev, visible: false })), style: "cancel" },
				{
					text: "Terminate",
					onPress: () => {
						setModalConfig(prev => ({ ...prev, visible: false }));
						handleStatusChange(labour, 'terminated');
					},
					style: "destructive"
				}
			]
		);
	};

	const handleBlacklist = (labour: Labour) => {
		showModal(
			"Confirm Blacklist",
			`Are you sure you want to blacklist ${labour.name}?`,
			'confirmation',
			[
				{ text: "Cancel", onPress: () => setModalConfig(prev => ({ ...prev, visible: false })), style: "cancel" },
				{
					text: "Blacklist",
					onPress: () => {
						setModalConfig(prev => ({ ...prev, visible: false }));
						handleStatusChange(labour, 'blacklisted');
					},
					style: "destructive"
				}
			]
		);
	};

	return (
		<View style={local.container}>
			<View style={local.headerRow}>
				<Pressable onPress={() => router.back()} style={local.backBtn}>
					<Text style={local.backText}>← Back</Text>
				</Pressable>
				<Text style={local.header}>
					{supervisorId ? "My Labours" : "Manage Labours"}
				</Text>
				{isAdmin ? (
					<Pressable onPress={() => router.push("/(screens)/add-labour")} style={local.backBtn}>
						<Text style={local.backText}>+ New</Text>
					</Pressable>
				) : <View style={{ width: 50 }} />}
			</View>

			{/* Toggle for Active/Inactive - Only for Admins or if we want supervisors to see inactive? Limit to Admin for now based on context */}
			{isAdmin && !supervisorId && (
				<View style={local.toggleContainer}>
					<TouchableOpacity
						style={[local.toggleBtn, viewType === 'active' && local.toggleBtnActive]}
						onPress={() => setViewType('active')}
					>
						<Text style={[local.toggleText, viewType === 'active' && local.toggleTextActive]}>Active</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[local.toggleBtn, viewType === 'inactive' && local.toggleBtnActive]}
						onPress={() => setViewType('inactive')}
					>
						<Text style={[local.toggleText, viewType === 'inactive' && local.toggleTextActive]}>Inactive</Text>
					</TouchableOpacity>
				</View>
			)}

			<FlatList
				data={labours}
				keyExtractor={(item) => item.id.toString()}
				refreshControl={
					<React.Fragment>
						{/* Re-import RefreshControl if not already imported or use from react-native */}
					</React.Fragment>
				}
				onRefresh={onRefresh}
				refreshing={refreshing}
				renderItem={({ item }) => (
					<LabourCard
						labour={item}
						showMoveAction={isAdmin}
						hideRate={!isAdmin}
						onMove={handleMove}
						onTerminate={handleTerminate}
						onBlacklist={handleBlacklist}
						onRevoke={(labour) => handleStatusChange(labour, 'active')}
						onPress={(labour) => router.push(`/(screens)/labour-details?id=${labour.id}`)}
					/>
				)}
				contentContainerStyle={local.listContent}
				ListEmptyComponent={
					!loading ? (
						<Text style={local.emptyText}>No {viewType} labours found.</Text>
					) : null
				}
			/>

			{/* Site Picker Modal */}
			<CustomModal
				visible={showSitePicker}
				onClose={() => setShowSitePicker(false)}
				title={`Move ${selectedLabour?.name} to...`}
				actions={[{ text: 'Cancel', onPress: () => setShowSitePicker(false), style: 'cancel' }]}
			>
				{assigning ? (
					<Text style={local.loadingText}>Assigning...</Text>
				) : (
					<FlatList
						data={sites}
						style={{ maxHeight: 300, width: '100%' }}
						keyExtractor={(item) => item.id.toString()}
						renderItem={({ item }) => (
							<TouchableOpacity
								style={local.siteOption}
								onPress={() => handleAssignSite(item)}
							>
								<MaterialIcons
									name="location-city"
									size={20}
									color={selectedLabour?.site_id === item.id ? "#0a84ff" : (isDark ? "#888" : "#666")}
								/>
								<Text
									style={[
										local.siteOptionName,
										selectedLabour?.site_id === item.id && { color: "#0a84ff", fontWeight: "600" },
									]}
								>
									{item.name}
								</Text>
								{selectedLabour?.site_id === item.id && (
									<MaterialIcons name="check" size={20} color="#0a84ff" />
								)}
							</TouchableOpacity>
						)}
					/>
				)}
			</CustomModal>

			<CustomModal
				visible={modalConfig.visible}
				onClose={() => setModalConfig(prev => ({ ...prev, visible: false }))}
				title={modalConfig.title}
				message={modalConfig.message}
				type={modalConfig.type}
				actions={modalConfig.actions}
			/>
		</View>
	);
}

const getStyles = (isDark: boolean) => StyleSheet.create({
	container: {
		flex: 1,
		paddingTop: 40,
		backgroundColor: isDark ? "#121212" : "#f5f5f5",
	},
	headerRow: {
		width: "100%",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 20,
		paddingBottom: 16,
		backgroundColor: isDark ? "#1e1e1e" : "#fff",
		borderBottomWidth: 1,
		borderBottomColor: isDark ? "#333" : "#eee",
	},
	backBtn: { paddingVertical: 6, paddingHorizontal: 8 },
	backText: { color: isDark ? "#4da6ff" : "#0a84ff", fontWeight: "600", fontSize: 16 },
	header: { fontSize: 20, fontWeight: "700", color: isDark ? "#fff" : "#333" },
	listContent: {
		padding: 16,
		paddingBottom: 100,
	},
	emptyText: {
		textAlign: "center",
		marginTop: 40,
		color: isDark ? "#aaa" : "#999",
		fontSize: 16,
	},
	siteOption: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 14,
		borderBottomWidth: 1,
		borderBottomColor: isDark ? "#333" : "#f9f9f9",
		gap: 12,
	},
	siteOptionName: {
		fontSize: 16,
		color: isDark ? "#fff" : "#333",
		flex: 1,
	},
	loadingText: {
		textAlign: "center",
		padding: 20,
		color: isDark ? "#aaa" : "#666",
	},
	toggleContainer: {
		flexDirection: 'row',
		paddingHorizontal: 20,
		marginBottom: 10,
		backgroundColor: isDark ? "#1e1e1e" : '#fff',
		paddingBottom: 10,
	},
	toggleBtn: {
		flex: 1,
		paddingVertical: 10,
		alignItems: 'center',
		borderBottomWidth: 2,
		borderBottomColor: 'transparent',
	},
	toggleBtnActive: {
		borderBottomColor: isDark ? "#4da6ff" : '#0a84ff',
	},
	toggleText: {
		fontSize: 16,
		color: isDark ? "#aaa" : '#666',
		fontWeight: '500',
	},
	toggleTextActive: {
		color: isDark ? "#4da6ff" : '#0a84ff',
		fontWeight: '700',
	}
});
