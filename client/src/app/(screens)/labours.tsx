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
import { FilterOption, FilterPanel, SearchBar, SortOption, SortSelector } from "../../components/list";
import { useTheme } from "../../context/ThemeContext";
import { useListManager } from "../../hooks/useListManager";
import { api } from "../../services/api";
import { sortByName } from "../../utils/sort";
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
	status?: 'active' | 'unassigned';
	created_at?: string;
}

const sortOptions: SortOption[] = [
	{ label: "Site", field: "site", type: "string" },
	{ label: "Name", field: "name", type: "string" },
	{ label: "Date Added", field: "created_at", type: "date" },
	{ label: "Rate", field: "rate", type: "number" }
];

const filterOptions: FilterOption[] = [
	{
		label: "Status",
		field: "status",
		type: "select",
		options: [
			{ label: "Assigned", value: "active" },
			{ label: "Unassigned", value: "unassigned" },
			{ label: "Pending", value: "pending" }
		]
	}
];

export default function Labours() {
	const router = useRouter();
	const { isDark } = useTheme();
	const local = getStyles(isDark);
	const { newLabour, supervisorId, status } = useLocalSearchParams();
	const initialStatus = (status as string) || 'active';
	const [allLabours, setAllLabours] = useState<Labour[]>([]);
	const [isAdmin, setIsAdmin] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	const listManager = useListManager<Labour>({
		initialData: allLabours,
		initialConfig: {
			search: { text: "", fields: ["name", "phone", "trade"] },
			sort: [
				{ field: "site", order: "asc", type: "string" },
				{ field: "name", order: "asc", type: "string" }
			],
			filters: [{ field: "status", operator: "=", value: initialStatus }]
		}
	});

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
		}, [supervisorId])
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
			}
			let queryString = '?';
			// We fetch all records if admin, or specific supId if supervisor.
			// Client-side manager handles status filtering mode.
			if (supId) queryString += `supervisor_id=${supId}`;

			if (queryString === '?') queryString = '';

			const response = await api.get(`/labours${queryString}`);
			const data = await response.json();
			if (response.ok) {
				setAllLabours(data);
			} else {
				console.error("Failed to fetch labours:", data.error);
			}
		} catch (error) {
			console.error("Failed to fetch labours", error);
		} finally {
			setRefreshing(false);
		}
	};

	const onRefresh = () => {
		checkRoleAndFetch(); // This will eventually call fetchLabours
	};

	const fetchSites = async () => {
		try {
			const response = await api.get("/sites?status=active");
			const data = await response.json();
			if (response.ok) {
				setSites(sortByName(data));
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

	const handleUnassign = (labour: Labour) => {
		showModal(
			"Confirm Unassign",
			`Are you sure you want to unassign ${labour.name}?`,
			'confirmation',
			[
				{ text: "Cancel", onPress: () => setModalConfig(prev => ({ ...prev, visible: false })), style: "cancel" },
				{
					text: "Unassign",
					onPress: () => {
						setModalConfig(prev => ({ ...prev, visible: false }));
						handleStatusChange(labour, 'unassigned');
					},
					style: "destructive"
				}
			]
		);
	};

	const statusFilter = listManager.config.filters?.find(f => f.field === 'status');
	const viewType = statusFilter ? statusFilter.value : 'all';

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

			{isAdmin && !supervisorId && (
				<View style={local.toggleContainer}>
					<TouchableOpacity
						style={[local.toggleBtn, viewType === 'active' && local.toggleBtnActive]}
						onPress={() => listManager.setFilters([{ field: 'status', value: 'active' }])}
					>
						<Text style={[local.toggleText, viewType === 'active' && local.toggleTextActive]}>Assigned</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[local.toggleBtn, viewType === 'unassigned' && local.toggleBtnActive]}
						onPress={() => listManager.setFilters([{ field: 'status', value: 'unassigned' }])}
					>
						<Text style={[local.toggleText, viewType === 'unassigned' && local.toggleTextActive]}>Unassigned</Text>
					</TouchableOpacity>
				</View>
			)}

			<View style={local.controlsRow}>
				<SearchBar
					value={listManager.searchText}
					onChangeText={listManager.setSearchText}
					placeholder="Search by name, phone, trade..."
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

			<FlatList
				data={listManager.data}
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
						onUnassign={handleUnassign}
						onRevoke={(labour) => handleStatusChange(labour, 'active')}
						onPress={(labour) => router.push(`/(screens)/labour-details?id=${labour.id}`)}
					/>
				)}
				contentContainerStyle={local.listContent}
				ListEmptyComponent={
					<Text style={local.emptyText}>No labours found.</Text>
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
	controlsRow: {
		paddingHorizontal: 20,
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
