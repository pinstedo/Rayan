import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
	Image,
	Platform,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View
} from "react-native";
import GlobalSearch from "../../components/GlobalSearch";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";

export default function HomeScreen() {
	const router = useRouter();
	const { isDark, colors } = useTheme();
	const local = getStyles(isDark, colors);

	const today = new Date().toLocaleDateString(undefined, {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	const hour = new Date().getHours();
	const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

	const [query, setQuery] = useState("");
	const { newActivity } = useLocalSearchParams();

	const [userName, setUserName] = useState("Admin");
	const [profileImage, setProfileImage] = useState<string | null>(null);

	const [stats, setStats] = useState({
		workers: 0,
		jobs: 0, // Active workers
		attendance: 0,
		approvals: 0, // Total Sites
	});

	const [recent, setRecent] = useState<string[]>([]);
	const [refreshing, setRefreshing] = useState(false);
	const [unreadReports, setUnreadReports] = useState(0);

	const [showNotificationsModal, setShowNotificationsModal] = useState(false);
	const [complaints, setComplaints] = useState<any[]>([]);
	const [pendingLabours, setPendingLabours] = useState<any[]>([]);
	const [notificationTab, setNotificationTab] = useState<'complaints' | 'activities' | 'approvals'>('complaints');

	const fetchComplaints = async () => {
		try {
			const res = await api.get("/reports/complaints");
			if (res.ok) {
				const data = await res.json();
				setComplaints(data);
			}
		} catch (error) {
			console.error("Failed to fetch complaints:", error);
		}
	};

	const fetchPendingLabours = async () => {
		try {
			const userData = await AsyncStorage.getItem("userData");
			if (userData) {
				const user = JSON.parse(userData);
				if (user.role === 'admin') {
					const res = await api.get("/labours?status=pending");
					if (res.ok) {
						const data = await res.json();
						setPendingLabours(data);
					}
				}
			}
		} catch (error) {
			console.error("Failed to fetch pending labours:", error);
		}
	};

	const handleClearNotifications = async () => {
		try {
			const res = await api.put("/reports/complaints/mark-read", {});
			if (res.ok) {
				setUnreadReports(0);
				fetchComplaints();
			}
		} catch (error) {
			console.error("Failed to clear notifications:", error);
		}
	};

	const handleClearSingleNotification = async (id: string) => {
		try {
			const res = await api.delete(`/reports/complaints/${id}`);
			if (res.ok) {
				fetchComplaints();
				fetchData(false); // Refresh unread count
			}
		} catch (error) {
			console.error("Failed to clear specific notification:", error);
		}
	};

	const handleApproveLabour = async (id: string) => {
		try {
			const res = await api.put(`/labours/${id}/status`, { status: 'active' });
			if (res.ok) {
				fetchPendingLabours();
				fetchData(false);
			}
		} catch (error) {
			console.error("Failed to approve labour:", error);
		}
	};

	const handleDenyLabour = async (id: string) => {
		try {
			const res = await api.delete(`/labours/${id}`);
			if (res.ok) {
				fetchPendingLabours();
				fetchData(false);
			}
		} catch (error) {
			console.error("Failed to deny labour:", error);
		}
	};

	const fetchData = async (isRefresh = false) => {
		try {
			const userData = await AsyncStorage.getItem("userData");
			if (userData) {
				const user = JSON.parse(userData);
				if (user.name) setUserName(user.name);
				if (user.profile_image) setProfileImage(user.profile_image);
			}

			const statsRes = await api.get("/dashboard/stats");
			const statsData = await statsRes.json();
			if (statsRes.ok) setStats(statsData);

			const recentRes = await api.get("/dashboard/recent");
			const recentData = await recentRes.json();
			if (recentRes.ok) setRecent(recentData);

			const reportsRes = await api.get("/reports/unread-count");
			if (reportsRes.ok) {
				const reportData = await reportsRes.json();
				setUnreadReports(reportData.unreadCount || 0);
			}
		} catch (error) {
			console.error("Failed to fetch dashboard data:", error);
		} finally {
			if (isRefresh) setRefreshing(false);
		}
	};

	useFocusEffect(
		useCallback(() => {
			fetchData();
		}, [])
	);

	const onRefresh = () => {
		setRefreshing(true);
		fetchData(true);
	};

	const statsDisplay = [
		{
			key: "workers",
			label: "Total Workers",
			value: stats.workers,
			icon: "account-group",
			color: colors.success,
			onPress: () => router.push({ pathname: "/(screens)/labours", params: { view: 'flat' } } as any)
		},
		{
			key: "jobs",
			label: "Active Workers",
			value: stats.jobs,
			icon: "account-hard-hat",
			color: colors.primary,
			onPress: () => router.push({ pathname: "/(screens)/labours", params: { status: 'assigned', view: 'flat' } } as any)
		},
		{
			key: "attendance",
			label: "Today Present",
			value: stats.attendance,
			icon: "calendar-check",
			color: colors.warning,
			onPress: () => router.push("/(screens)/reports/site-attendance" as any),
		},
		{
			key: "approvals",
			label: "Total Sites",
			value: stats.approvals,
			icon: "office-building",
			color: colors.primaryHover,
			onPress: () => router.push("/(screens)/sites" as any)
		},
	];

	useEffect(() => {
		if (newActivity) {
			const entry = `${newActivity} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
			setRecent((r: string[]) => [entry, ...r]);
			router.replace("/home");
		}
	}, [newActivity, router]);

	const filteredRecent = recent.filter((r: string) =>
		r.toLowerCase().includes(query.trim().toLowerCase())
	);

	const quickActions = [
		{ label: "Labours", icon: "account-group-outline", route: "/(screens)/labours?view=flat", color: colors.secondary, iconColor: colors.primary },
		{ label: "Supervisors", icon: "account-tie-outline", route: "/(screens)/supervisors", color: colors.secondary, iconColor: colors.primary },
		{ label: "Wage Report", icon: "file-chart-outline", route: "/(screens)/reports/wage-report", color: colors.secondary, iconColor: colors.primary },
		{ label: "Bonus & Increment", icon: "calendar-star", route: "/(screens)/reports/bonus-attendance-report", color: colors.secondary, iconColor: colors.success },
		{ label: "Sites", icon: "office-building-outline", route: "/(screens)/sites", color: colors.secondary, iconColor: colors.primary },
		{ label: "Pending Admins", icon: "account-clock-outline", route: "/(screens)/pending-admins", color: colors.secondary, iconColor: colors.warning },
	];

	return (
		<>
			<ScrollView
				contentContainerStyle={local.container}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0a84ff']} />
				}
				showsVerticalScrollIndicator={false}
			>
				<View style={local.header}>
					<View style={local.headerTop}>
						<View>
							<Text style={local.greeting}>{greeting},</Text>
							<Text style={local.title}>{userName}</Text>
							<Text style={local.date}>{today}</Text>
						</View>

						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
							<TouchableOpacity style={local.notificationButton} onPress={() => {
								setShowNotificationsModal(true);
								fetchComplaints();
								fetchPendingLabours();
							}}>
								<Ionicons name="notifications-outline" size={28} color={isDark ? "#aaa" : "#555"} />
								{unreadReports > 0 && (
									<View style={local.notificationBadge}>
										<Text style={local.notificationBadgeText}>{unreadReports > 99 ? '99+' : unreadReports}</Text>
									</View>
								)}
							</TouchableOpacity>

							<TouchableOpacity style={local.profileButton} onPress={() => router.push('/(tabs)/profile' as any)}>
								{profileImage ? (
									<Image source={{ uri: profileImage }} style={local.profileImage} />
								) : (
									<Ionicons name="person-circle" size={48} color="#0a84ff" />
								)}
							</TouchableOpacity>
						</View>
					</View>

					<GlobalSearch />
				</View>

				<View style={local.cardsRow}>
					{statsDisplay.map((s) => (
						<TouchableOpacity
							key={s.key}
							style={[local.card, { borderTopColor: s.color }]}
							onPress={s.onPress}
							disabled={!s.onPress}
							activeOpacity={0.7}
						>
							<View style={local.cardHeader}>
								<View style={[local.iconBg, { backgroundColor: s.color + '1A' }]}>
									<MaterialCommunityIcons name={s.icon as any} size={28} color={s.color} />
								</View>
								<Text style={local.cardValue}>{s.value}</Text>
							</View>
							<Text style={local.cardLabel}>{s.label}</Text>
						</TouchableOpacity>
					))}
				</View>

				<View style={local.actions}>
					<Text style={local.sectionTitle}>Quick Actions</Text>
					<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={local.actionsScroll}>
						{quickActions.map((action, index) => (
							<TouchableOpacity
								key={index}
								style={local.actionItem}
								onPress={() => router.push(action.route as any)}
								activeOpacity={0.7}
							>
								<View style={[local.actionIconContainer, { backgroundColor: action.color }]}>
									<MaterialCommunityIcons name={action.icon as any} size={28} color={action.iconColor} />
								</View>
								<Text style={local.actionText}>{action.label}</Text>
							</TouchableOpacity>
						))}
					</ScrollView>
				</View>

				<View style={local.recent}>
					<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
						<Text style={[local.sectionTitle, { marginBottom: 0 }]}>Recent Activity</Text>
						<TouchableOpacity onPress={() => router.push('/(screens)/settings/history' as any)}>
							<Text style={{ color: colors.primary, fontWeight: '600' }}>See All</Text>
						</TouchableOpacity>
					</View>
					<View style={local.recentContainer}>
						{filteredRecent.length === 0 ? (
							<View style={local.emptyState}>
								<MaterialCommunityIcons name="history" size={40} color={isDark ? "#555" : "#ccc"} />
								<Text style={local.emptyText}>No recent activity</Text>
							</View>
						) : (
							filteredRecent.map((r: string, i: number) => {
								const parts = r.split(' • ');
								const actionText = parts[0] || r;
								const timeText = parts.length > 1 ? parts[1] : '';

								return (
									<View key={i} style={local.recentItem}>
										<View style={local.recentTimeline}>
											<View style={local.recentDot} />
											{i !== filteredRecent.length - 1 && <View style={local.recentLine} />}
										</View>
										<View style={local.recentContent}>
											<Text style={local.recentText}>{actionText}</Text>
											{timeText ? <Text style={local.recentTime}>{timeText}</Text> : null}
										</View>
									</View>
								)
							})
						)}
					</View>
				</View>

				<View style={{ height: 40 }} />
			</ScrollView>

			{/* Notifications Modal */}
			{
				showNotificationsModal && (
					<View style={{
						position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
						backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, elevation: 10,
						justifyContent: 'center', alignItems: 'center'
					}}>
						<View style={{
							backgroundColor: isDark ? '#1e1e1e' : '#fff', width: '90%', maxHeight: '80%',
							borderRadius: 16, padding: 20, elevation: 5,
							shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84
						}}>
							<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
								<Text style={{ fontSize: 20, fontWeight: 'bold', color: isDark ? '#fff' : '#000' }}>Notifications</Text>
								<TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
									<Ionicons name="close" size={24} color={isDark ? '#aaa' : '#555'} />
								</TouchableOpacity>
							</View>

							{/* Custom Tabs */}
							<View style={{ flexDirection: 'row', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: isDark ? '#444' : '#eee' }}>
								<TouchableOpacity
									style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: notificationTab === 'complaints' ? 2 : 0, borderBottomColor: '#0a84ff' }}
									onPress={() => setNotificationTab('complaints')}
								>
									<Text style={{ fontWeight: '600', color: notificationTab === 'complaints' ? '#0a84ff' : (isDark ? '#aaa' : '#666') }}>Issues</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: notificationTab === 'approvals' ? 2 : 0, borderBottomColor: '#0a84ff' }}
									onPress={() => setNotificationTab('approvals')}
								>
									<Text style={{ fontWeight: '600', color: notificationTab === 'approvals' ? '#0a84ff' : (isDark ? '#aaa' : '#666') }}>Approvals</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: notificationTab === 'activities' ? 2 : 0, borderBottomColor: '#0a84ff' }}
									onPress={() => setNotificationTab('activities')}
								>
									<Text style={{ fontWeight: '600', color: notificationTab === 'activities' ? '#0a84ff' : (isDark ? '#aaa' : '#666') }}>Activity</Text>
								</TouchableOpacity>
							</View>

							<ScrollView style={{ marginBottom: 16 }}>
								{notificationTab === 'complaints' ? (
									complaints.length === 0 ? (
										<Text style={{ textAlign: 'center', color: isDark ? '#aaa' : '#666', marginTop: 20, marginBottom: 20 }}>No issues found.</Text>
									) : (
										complaints.map((c: any, index: number) => (
											<View key={c.id || index} style={{
												padding: 12, marginBottom: 12, borderRadius: 8,
												backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
												borderWidth: 1, borderColor: isDark ? '#444' : '#eee',
												borderLeftWidth: 4, borderLeftColor: c.status === 'unread' ? '#ff3b30' : '#4caf50'
											}}>
												<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
													{c.profile_image ? (
														<Image source={{ uri: c.profile_image }} style={{ width: 24, height: 24, borderRadius: 12, marginRight: 8 }} />
													) : (
														<Ionicons name="person-circle" size={24} color="#0a84ff" style={{ marginRight: 8 }} />
													)}
													<Text style={{ fontWeight: '600', color: isDark ? '#fff' : '#000', flex: 1 }}>
														{c.labour_name || 'Unknown Labourer'} - {c.site_name || 'Unassigned Site'}
													</Text>
													<Text style={{ fontSize: 12, color: isDark ? '#888' : '#999', marginRight: 8 }}>
														{new Date(c.created_at).toLocaleDateString()}
													</Text>
													<TouchableOpacity onPress={() => handleClearSingleNotification(c.id)}>
														<Ionicons name="close-circle" size={20} color={isDark ? "#888" : "#999"} />
													</TouchableOpacity>
												</View>
												<Text style={{ color: isDark ? '#ddd' : '#333', fontSize: 14 }}>{c.complaint}</Text>
											</View>
										))
									)
								) : notificationTab === 'approvals' ? (
									pendingLabours.length === 0 ? (
										<Text style={{ textAlign: 'center', color: isDark ? '#aaa' : '#666', marginTop: 20, marginBottom: 20 }}>No pending approvals.</Text>
									) : (
										pendingLabours.map((l: any, index: number) => (
											<View key={l.id || index} style={{
												padding: 12, marginBottom: 12, borderRadius: 8,
												backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
												borderWidth: 1, borderColor: isDark ? '#444' : '#eee',
												borderLeftWidth: 4, borderLeftColor: '#ff9800'
											}}>
												<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
													{l.profile_image ? (
														<Image source={{ uri: l.profile_image }} style={{ width: 24, height: 24, borderRadius: 12, marginRight: 8 }} />
													) : (
														<Ionicons name="person-circle" size={24} color="#ff9800" style={{ marginRight: 8 }} />
													)}
													<Text style={{ fontWeight: '600', color: isDark ? '#fff' : '#000', flex: 1 }}>
														{l.name}
													</Text>
													<Text style={{ fontSize: 12, color: isDark ? '#888' : '#999' }}>
														{new Date(l.created_at).toLocaleDateString()}
													</Text>
												</View>
												<Text style={{ color: isDark ? '#ddd' : '#333', fontSize: 14, marginBottom: 4 }}>Site: {l.site || 'Unassigned'}</Text>
												<Text style={{ color: isDark ? '#ddd' : '#333', fontSize: 14, marginBottom: 12 }}>Phone: {l.phone}</Text>

												<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
													<TouchableOpacity
														onPress={() => handleDenyLabour(l.id)}
														style={{ backgroundColor: '#ff3b30', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 }}
													>
														<Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Deny</Text>
													</TouchableOpacity>
													<TouchableOpacity
														onPress={() => handleApproveLabour(l.id)}
														style={{ backgroundColor: '#34c759', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 }}
													>
														<Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Approve</Text>
													</TouchableOpacity>
												</View>
											</View>
										))
									)
								) : (
									recent.length === 0 ? (
										<Text style={{ textAlign: 'center', color: isDark ? '#aaa' : '#666', marginTop: 20, marginBottom: 20 }}>No recent activity.</Text>
									) : (
										recent.map((r: string, i: number) => {
											const parts = r.split(' • ');
											const actionText = parts[0] || r;
											const timeText = parts.length > 1 ? parts[1] : '';

											return (
												<View key={i} style={local.recentItem}>
													<View style={local.recentTimeline}>
														<View style={local.recentDot} />
														{i !== recent.length - 1 && <View style={local.recentLine} />}
													</View>
													<View style={local.recentContent}>
														<Text style={local.recentText}>{actionText}</Text>
														{timeText ? <Text style={local.recentTime}>{timeText}</Text> : null}
													</View>
												</View>
											)
										})
									)
								)}
							</ScrollView>

							{notificationTab === 'complaints' && complaints.some((c: any) => c.status === 'unread') && (
								<TouchableOpacity
									onPress={handleClearNotifications}
									style={{
										backgroundColor: '#ff3b30', paddingVertical: 12, borderRadius: 8,
										alignItems: 'center', marginTop: 8
									}}
								>
									<Text style={{ color: '#fff', fontWeight: 'bold' }}>Mark All as Read</Text>
								</TouchableOpacity>
							)}
						</View>
					</View>
				)
			}
		</>
	);
}

const getStyles = (isDark: boolean, colors: any) => StyleSheet.create({
	container: {
		padding: 20,
		paddingTop: Platform.OS === 'web' ? 50 : 20,
		backgroundColor: colors.background,
		minHeight: "100%",
	},
	header: {
		backgroundColor: colors.surface,
		marginHorizontal: -20,
		marginTop: Platform.OS === 'web' ? -50 : -20,
		paddingHorizontal: 24,
		paddingTop: Platform.OS === 'web' ? 64 : 24,
		paddingBottom: 20,
		marginBottom: 24,
		borderBottomLeftRadius: 24,
		borderBottomRightRadius: 24,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.05,
		shadowRadius: 12,
		elevation: 4,
		zIndex: 100,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
	},
	headerTop: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 20,
	},
	greeting: {
		fontSize: 14,
		color: colors.textSecondary,
		fontWeight: "600",
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	title: {
		fontSize: 30,
		fontWeight: "800",
		color: colors.textPrimary,
		marginTop: 2,
	},
	date: {
		color: colors.textSecondary,
		marginTop: 4,
		fontSize: 14,
		fontWeight: "500",
	},
	notificationButton: {
		padding: 4,
		position: 'relative',
	},
	notificationBadge: {
		position: 'absolute',
		top: -2,
		right: -4,
		backgroundColor: colors.error,
		borderRadius: 10,
		minWidth: 18,
		height: 18,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 4,
		borderWidth: 1.5,
		borderColor: colors.surface,
	},
	notificationBadgeText: {
		color: '#fff',
		fontSize: 10,
		fontWeight: 'bold',
	},
	profileButton: {
		padding: 2,
	},
	profileImage: {
		width: 48,
		height: 48,
		borderRadius: 24,
	},
	cardsRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
		marginBottom: 24,
	},
	card: {
		width: "48%",
		backgroundColor: colors.surface,
		borderRadius: 12,
		padding: 16,
		marginBottom: 16,
		borderTopWidth: 4,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.06,
		shadowRadius: 8,
		elevation: 3,
		borderWidth: 1,
		borderColor: colors.border,
	},
	cardHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 12,
	},
	iconBg: {
		padding: 8,
		borderRadius: 10,
	},
	cardValue: {
		fontSize: 24,
		fontWeight: "800",
		color: colors.textPrimary,
	},
	cardLabel: {
		fontSize: 14,
		color: colors.textSecondary,
		fontWeight: "500",
	},
	actions: {
		marginBottom: 24,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "700",
		marginBottom: 16,
		color: colors.textPrimary,
	},
	actionsScroll: {
		paddingBottom: 8,
	},
	actionItem: {
		alignItems: "center",
		marginRight: 24,
	},
	actionIconContainer: {
		width: 60,
		height: 60,
		borderRadius: 16,
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 8,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.05,
		shadowRadius: 6,
		elevation: 2,
		borderWidth: 1,
		borderColor: colors.border,
	},
	actionText: {
		color: colors.textSecondary,
		fontWeight: "600",
		fontSize: 13,
	},
	recent: {
		marginTop: 8,
	},
	recentContainer: {
		backgroundColor: colors.surface,
		borderRadius: 12,
		padding: 16,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.05,
		shadowRadius: 8,
		elevation: 2,
		borderWidth: 1,
		borderColor: colors.border,
	},
	recentItem: {
		flexDirection: "row",
		marginBottom: 16,
	},
	recentTimeline: {
		alignItems: "center",
		marginRight: 12,
	},
	recentDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
		backgroundColor: colors.primary,
		marginTop: 6,
	},
	recentLine: {
		width: 2,
		flex: 1,
		backgroundColor: colors.border,
		marginTop: 4,
	},
	recentContent: {
		flex: 1,
		paddingBottom: 4,
	},
	recentText: {
		color: colors.textPrimary,
		fontSize: 15,
		fontWeight: "500",
		lineHeight: 22,
	},
	recentTime: {
		color: colors.textSecondary,
		fontSize: 12,
		marginTop: 2,
	},
	emptyState: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 24,
	},
	emptyText: {
		color: colors.textSecondary,
		fontStyle: "italic",
		marginTop: 8,
	},
});
