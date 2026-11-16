import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { CustomModal } from '../../../components/CustomModal';
import { SearchBar } from '../../../components/list';
import { useTheme } from '../../../context/ThemeContext';
import { useSafeBack } from '../../../hooks/useSafeBack';
import { api } from '../../../services/api';

interface LabourEsiItem {
    id: number;
    name: string;
    phone: string;
    trade?: string;
    site: string;
    site_id?: number;
    status: string;
    daily_wage: number;
    esi_enabled: boolean;
    daily_esi_amount: number;
}

type FilterTab = 'all' | 'enrolled' | 'not_enrolled';

export default function EsiScreen() {
    const router = useRouter();
    const handleBack = useSafeBack("/(tabs)/manage");
    const { isDark, colors } = useTheme();
    const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);

    // Data state
    const [esiPercentage, setEsiPercentage] = useState<number>(0.75);
    const [labours, setLabours] = useState<LabourEsiItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filter & search state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTab, setFilterTab] = useState<FilterTab>('all');

    // Pending changes state: Map<labourId, boolean> of overrides
    const [pendingOverrides, setPendingOverrides] = useState<Map<number, boolean>>(new Map());
    const [isSavingChanges, setIsSavingChanges] = useState(false);

    // Edit Rate Modal state
    const [isEditRateModalVisible, setIsEditRateModalVisible] = useState(false);
    const [editRateValue, setEditRateValue] = useState('0.75');
    const [isSavingRate, setIsSavingRate] = useState(false);
    const [rateError, setRateError] = useState<string | null>(null);

    // Success feedback modal
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const triggerHaptic = (type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) => {
        try {
            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(type);
            }
        } catch {
            // ignore unsupported platform errors
        }
    };

    const fetchData = useCallback(async (isRefresh = false) => {
        try {
            if (!isRefresh) setLoading(true);
            const res = await api.get('/settings/esi/labours');
            if (res.ok) {
                const data = await res.json();
                const rate = typeof data.esi_percentage === 'number' ? data.esi_percentage : 0.75;
                setEsiPercentage(rate);
                setEditRateValue(String(rate));
                setLabours(data.labours || []);
                setPendingOverrides(new Map());
            } else {
                const errData = await res.json().catch(() => ({}));
                Alert.alert('Error', errData.error || 'Failed to load ESI data.');
            }
        } catch (err: any) {
            console.error('Fetch ESI error:', err);
            Alert.alert('Error', 'Unable to connect to server.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData(true);
    };

    // Helper: effective ESI status for a labour (accounting for pending override)
    const getEffectiveEsi = useCallback((labour: LabourEsiItem): boolean => {
        if (pendingOverrides.has(labour.id)) {
            return pendingOverrides.get(labour.id)!;
        }
        return labour.esi_enabled;
    }, [pendingOverrides]);

    // Toggle individual labour
    const handleToggleLabour = (labour: LabourEsiItem) => {
        const currentEffective = getEffectiveEsi(labour);
        const nextValue = !currentEffective;
        setPendingOverrides(prev => {
            const updated = new Map(prev);
            // If toggled back to original state, remove override
            if (nextValue === labour.esi_enabled) {
                updated.delete(labour.id);
            } else {
                updated.set(labour.id, nextValue);
            }
            return updated;
        });
    };

    // Filtered labours based on search & tab
    const filteredLabours = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return labours.filter(item => {
            const matchesSearch = !query ||
                item.name.toLowerCase().includes(query) ||
                (item.phone && item.phone.toLowerCase().includes(query)) ||
                (item.site && item.site.toLowerCase().includes(query)) ||
                (item.trade && item.trade.toLowerCase().includes(query));

            if (!matchesSearch) return false;

            const isEnrolled = getEffectiveEsi(item);
            if (filterTab === 'enrolled') return isEnrolled;
            if (filterTab === 'not_enrolled') return !isEnrolled;
            return true;
        });
    }, [labours, searchQuery, filterTab, getEffectiveEsi]);

    // Statistics counts
    const enrolledCount = useMemo(() => {
        return labours.filter(l => getEffectiveEsi(l)).length;
    }, [labours, getEffectiveEsi]);

    const totalEstimatedDailyEsi = useMemo(() => {
        return labours
            .filter(l => getEffectiveEsi(l))
            .reduce((sum, l) => sum + (l.daily_wage > 0 ? (l.daily_wage * esiPercentage) / 100 : 0), 0);
    }, [labours, esiPercentage, getEffectiveEsi]);

    const pendingChangesCount = pendingOverrides.size;

    // Bulk actions
    const handleSelectAllFiltered = () => {
        setPendingOverrides(prev => {
            const updated = new Map(prev);
            filteredLabours.forEach(l => {
                if (!l.esi_enabled) {
                    updated.set(l.id, true);
                } else {
                    updated.delete(l.id);
                }
            });
            return updated;
        });
    };

    const handleDeselectAllFiltered = () => {
        setPendingOverrides(prev => {
            const updated = new Map(prev);
            filteredLabours.forEach(l => {
                if (l.esi_enabled) {
                    updated.set(l.id, false);
                } else {
                    updated.delete(l.id);
                }
            });
            return updated;
        });
    };

    const handleDiscardChanges = () => {
        setPendingOverrides(new Map());
    };

    // Save batch changes to backend
    const handleSaveChanges = async () => {
        if (pendingChangesCount === 0) return;

        const toEnroll: number[] = [];
        const toUnenroll: number[] = [];

        pendingOverrides.forEach((val, id) => {
            if (val) toEnroll.push(id);
            else toUnenroll.push(id);
        });

        try {
            setIsSavingChanges(true);

            if (toEnroll.length > 0) {
                const res = await api.put('/settings/esi/bulk-assign', {
                    labour_ids: toEnroll,
                    esi_enabled: true
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || 'Failed to enroll labours');
                }
            }

            if (toUnenroll.length > 0) {
                const res = await api.put('/settings/esi/bulk-assign', {
                    labour_ids: toUnenroll,
                    esi_enabled: false
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || 'Failed to unenroll labours');
                }
            }

            triggerHaptic(Haptics.NotificationFeedbackType.Success);
            setSuccessMessage(`Successfully updated ESI status for ${pendingChangesCount} labour(s).`);
            setPendingOverrides(new Map());
            await fetchData(true);
        } catch (err: any) {
            console.error('Save ESI changes error:', err);
            Alert.alert('Error', err.message || 'Failed to save changes.');
        } finally {
            setIsSavingChanges(false);
        }
    };

    // Save rate changes
    const handleSaveRate = async () => {
        const parsed = parseFloat(editRateValue);
        if (isNaN(parsed) || parsed < 0 || parsed > 100) {
            setRateError('Enter a valid percentage between 0 and 100.');
            return;
        }

        try {
            setIsSavingRate(true);
            setRateError(null);
            const res = await api.put('/settings/esi', { percentage: parsed });
            if (res.ok) {
                const data = await res.json();
                setEsiPercentage(data.percentage);
                setIsEditRateModalVisible(false);
                triggerHaptic(Haptics.NotificationFeedbackType.Success);
                setSuccessMessage(`ESI rate successfully updated to ${data.percentage}%.`);
                fetchData(true);
            } else {
                const err = await res.json().catch(() => ({}));
                setRateError(err.error || 'Failed to update ESI rate.');
            }
        } catch (err: any) {
            console.error('Update rate error:', err);
            setRateError('Unable to connect to server.');
        } finally {
            setIsSavingRate(false);
        }
    };

    const renderLabourCard = ({ item }: { item: LabourEsiItem }) => {
        const isEnrolled = getEffectiveEsi(item);
        const hasPendingChange = pendingOverrides.has(item.id);
        const estDailyEsi = item.daily_wage > 0 ? ((item.daily_wage * esiPercentage) / 100).toFixed(2) : '0.00';
        const initials = item.name.trim().slice(0, 2).toUpperCase();

        return (
            <Pressable
                style={[
                    styles.card,
                    isEnrolled && styles.cardActive,
                    hasPendingChange && styles.cardPending
                ]}
                onPress={() => handleToggleLabour(item)}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.avatar, isEnrolled && styles.avatarActive]}>
                        <Text style={[styles.avatarText, isEnrolled && styles.avatarTextActive]}>{initials}</Text>
                    </View>
                    <View style={styles.cardMainInfo}>
                        <View style={styles.nameRow}>
                            <Text style={styles.labourName} numberOfLines={1}>{item.name}</Text>
                            {hasPendingChange && (
                                <View style={styles.pendingBadge}>
                                    <Text style={styles.pendingBadgeText}>Unsaved</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.labourPhone}>{item.phone || 'No phone'} {item.trade ? `• ${item.trade}` : ''}</Text>
                        <View style={styles.siteBadge}>
                            <MaterialIcons name="business" size={13} color={isDark ? '#94A3B8' : '#64748B'} />
                            <Text style={styles.siteBadgeText} numberOfLines={1}>{item.site || 'Unassigned'}</Text>
                        </View>
                    </View>
                    <View style={styles.toggleWrapper}>
                        <Switch
                            value={isEnrolled}
                            onValueChange={() => handleToggleLabour(item)}
                            trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: '#3B82F6' }}
                            thumbColor={isEnrolled ? '#FFFFFF' : (isDark ? '#94A3B8' : '#CBD5E1')}
                        />
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    <View style={styles.wagePill}>
                        <MaterialIcons name="payments" size={14} color={isDark ? '#93C5FD' : '#2563EB'} />
                        <Text style={styles.wagePillText}>₹{item.daily_wage}/day</Text>
                    </View>
                    <View style={[styles.esiPill, isEnrolled && styles.esiPillActive]}>
                        <MaterialIcons
                            name="health-and-safety"
                            size={14}
                            color={isEnrolled ? (isDark ? '#86EFAC' : '#15803D') : (isDark ? '#64748B' : '#94A3B8')}
                        />
                        <Text style={[styles.esiPillText, isEnrolled && styles.esiPillTextActive]}>
                            {isEnrolled ? `Est. ESI: ₹${estDailyEsi}/day` : 'ESI Not Enrolled'}
                        </Text>
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            {/* Screen Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={handleBack}
                    activeOpacity={0.7}
                >
                    <MaterialIcons name="arrow-back" size={24} color={isDark ? '#F1F5F9' : '#0F172A'} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>ESI Management</Text>
                    <Text style={styles.headerSubtitle}>Mark contributing labours & configure rate</Text>
                </View>
                <TouchableOpacity
                    style={styles.refreshBtn}
                    onPress={handleRefresh}
                    disabled={refreshing}
                    activeOpacity={0.7}
                >
                    <MaterialIcons
                        name="refresh"
                        size={22}
                        color={refreshing ? (isDark ? '#64748B' : '#94A3B8') : (isDark ? '#F1F5F9' : '#0F172A')}
                    />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Loading ESI settings & labours...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredLabours}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderLabourCard}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3B82F6" />
                    }
                    ListHeaderComponent={
                        <View style={styles.topSection}>
                            {/* Rate Configuration Card */}
                            <View style={styles.rateCard}>
                                <View style={styles.rateCardHeader}>
                                    <View style={styles.rateIconBg}>
                                        <MaterialIcons name="health-and-safety" size={24} color="#3B82F6" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.rateCardTitle}>ESI Contribution Rate</Text>
                                        <Text style={styles.rateCardSubtitle}>Deducted as percentage of labour wage</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.editRateBtn}
                                        onPress={() => {
                                            setEditRateValue(String(esiPercentage));
                                            setRateError(null);
                                            setIsEditRateModalVisible(true);
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        <MaterialIcons name="edit" size={16} color="#FFFFFF" />
                                        <Text style={styles.editRateBtnText}>Change</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.rateValueRow}>
                                    <Text style={styles.rateValueText}>{esiPercentage}%</Text>
                                    <View style={styles.rateBadge}>
                                        <Text style={styles.rateBadgeText}>Active Rate</Text>
                                    </View>
                                </View>

                                <View style={styles.calcPreviewRow}>
                                    <MaterialIcons name="calculate" size={16} color={isDark ? '#93C5FD' : '#2563EB'} />
                                    <Text style={styles.calcPreviewText}>
                                        Example: On ₹1,000 wage → ₹{((1000 * esiPercentage) / 100).toFixed(2)} ESI deduction
                                    </Text>
                                </View>

                                {/* Summary Stats */}
                                <View style={styles.statsDivider} />
                                <View style={styles.statsRow}>
                                    <View style={styles.statBox}>
                                        <Text style={styles.statNumber}>{labours.length}</Text>
                                        <Text style={styles.statLabel}>Total Labours</Text>
                                    </View>
                                    <View style={styles.statDividerVertical} />
                                    <View style={styles.statBox}>
                                        <Text style={[styles.statNumber, { color: '#10B981' }]}>
                                            {enrolledCount}
                                            <Text style={styles.statSubNumber}>
                                                {' '}({labours.length > 0 ? Math.round((enrolledCount / labours.length) * 100) : 0}%)
                                            </Text>
                                        </Text>
                                        <Text style={styles.statLabel}>Giving ESI</Text>
                                    </View>
                                    <View style={styles.statDividerVertical} />
                                    <View style={styles.statBox}>
                                        <Text style={[styles.statNumber, { color: '#3B82F6' }]}>
                                            ₹{totalEstimatedDailyEsi.toFixed(0)}
                                        </Text>
                                        <Text style={styles.statLabel}>Est. Daily ESI</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Search & Tabs */}
                            <View style={styles.searchSection}>
                                <SearchBar
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholder="Search by name, phone, trade, or site..."
                                />

                                <View style={styles.filterTabsRow}>
                                    <TouchableOpacity
                                        style={[styles.filterChip, filterTab === 'all' && styles.filterChipActive]}
                                        onPress={() => setFilterTab('all')}
                                    >
                                        <Text style={[styles.filterChipText, filterTab === 'all' && styles.filterChipTextActive]}>
                                            All ({labours.length})
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.filterChip, filterTab === 'enrolled' && styles.filterChipActive]}
                                        onPress={() => setFilterTab('enrolled')}
                                    >
                                        <Text style={[styles.filterChipText, filterTab === 'enrolled' && styles.filterChipTextActive]}>
                                            Giving ESI ({enrolledCount})
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.filterChip, filterTab === 'not_enrolled' && styles.filterChipActive]}
                                        onPress={() => setFilterTab('not_enrolled')}
                                    >
                                        <Text style={[styles.filterChipText, filterTab === 'not_enrolled' && styles.filterChipTextActive]}>
                                            Not Giving ({labours.length - enrolledCount})
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Bulk Selection Row */}
                                <View style={styles.bulkRow}>
                                    <Text style={styles.bulkSectionTitle}>
                                        Labours ({filteredLabours.length})
                                    </Text>
                                    <View style={styles.bulkBtnGroup}>
                                        <TouchableOpacity
                                            style={styles.bulkBtn}
                                            onPress={handleSelectAllFiltered}
                                        >
                                            <MaterialIcons name="done-all" size={16} color="#3B82F6" />
                                            <Text style={styles.bulkBtnText}>Select All</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.bulkBtn}
                                            onPress={handleDeselectAllFiltered}
                                        >
                                            <MaterialIcons name="remove-done" size={16} color={isDark ? '#94A3B8' : '#64748B'} />
                                            <Text style={[styles.bulkBtnText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Clear All</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialIcons name="person-search" size={48} color={isDark ? '#475569' : '#94A3B8'} />
                            <Text style={styles.emptyTitle}>No labours found</Text>
                            <Text style={styles.emptySubtitle}>Try adjusting your search terms or filter selection.</Text>
                        </View>
                    }
                />
            )}

            {/* Floating Save Changes Bar */}
            {pendingChangesCount > 0 && (
                <View style={styles.floatingBar}>
                    <View style={styles.floatingBarInfo}>
                        <View style={styles.floatingDot} />
                        <Text style={styles.floatingText}>
                            {pendingChangesCount} unsaved change{pendingChangesCount > 1 ? 's' : ''}
                        </Text>
                    </View>
                    <View style={styles.floatingActions}>
                        <TouchableOpacity
                            style={styles.discardBtn}
                            onPress={handleDiscardChanges}
                            disabled={isSavingChanges}
                        >
                            <Text style={styles.discardBtnText}>Discard</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.saveBtn}
                            onPress={handleSaveChanges}
                            disabled={isSavingChanges}
                        >
                            {isSavingChanges ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <MaterialIcons name="check" size={18} color="#FFFFFF" />
                                    <Text style={styles.saveBtnText}>Save</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Edit Rate Modal */}
            <CustomModal
                visible={isEditRateModalVisible}
                onClose={() => setIsEditRateModalVisible(false)}
                title="Change ESI Percentage"
                actions={[
                    {
                        text: 'Cancel',
                        onPress: () => setIsEditRateModalVisible(false),
                        style: 'cancel',
                        disabled: isSavingRate,
                    },
                    {
                        text: isSavingRate ? 'Saving...' : 'Save Rate',
                        onPress: handleSaveRate,
                        style: 'default',
                        disabled: isSavingRate,
                    },
                ]}
            >
                <View style={{ padding: 16 }}>
                    <Text style={styles.modalDescription}>
                        Enter the percentage of labour wage to deduct as ESI contribution for marked labours.
                    </Text>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.textInput}
                            value={editRateValue}
                            onChangeText={text => {
                                setEditRateValue(text);
                                setRateError(null);
                            }}
                            placeholder="e.g. 0.75"
                            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                            keyboardType="numeric"
                            autoFocus
                        />
                        <Text style={styles.inputSuffix}>%</Text>
                    </View>

                    {rateError && (
                        <Text style={styles.errorText}>{rateError}</Text>
                    )}

                    <View style={styles.modalCalcBox}>
                        <Text style={styles.modalCalcTitle}>Preview with ₹1,000 wage:</Text>
                        <Text style={styles.modalCalcValue}>
                            ₹{(!isNaN(parseFloat(editRateValue)) && parseFloat(editRateValue) >= 0 ? ((1000 * parseFloat(editRateValue)) / 100).toFixed(2) : '0.00')} / day
                        </Text>
                    </View>
                </View>
            </CustomModal>

            {/* Success Feedback Modal */}
            <CustomModal
                visible={Boolean(successMessage)}
                onClose={() => setSuccessMessage(null)}
                title="Success"
                type="success"
                actions={[
                    { text: 'Done', onPress: () => setSuccessMessage(null), style: 'default' }
                ]}
            >
                <View style={{ padding: 16, alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, color: isDark ? '#E2E8F0' : '#1E293B', textAlign: 'center' }}>
                        {successMessage}
                    </Text>
                </View>
            </CustomModal>
        </View>
    );
}

const getStyles = (isDark: boolean, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: Platform.OS === 'ios' ? 56 : 48,
            paddingHorizontal: 20,
            paddingBottom: 16,
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderBottomWidth: 1,
            borderBottomColor: isDark ? '#334155' : '#E2E8F0',
        },
        backBtn: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: isDark ? '#334155' : '#F1F5F9',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
        },
        refreshBtn: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: isDark ? '#334155' : '#F1F5F9',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
        },
        headerTitleContainer: {
            flex: 1,
        },
        headerTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: isDark ? '#F1F5F9' : '#0F172A',
        },
        headerSubtitle: {
            fontSize: 12,
            color: isDark ? '#94A3B8' : '#64748B',
            marginTop: 2,
        },
        centerContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        loadingText: {
            marginTop: 12,
            fontSize: 14,
            color: isDark ? '#94A3B8' : '#64748B',
        },
        listContent: {
            padding: 16,
            paddingBottom: 100,
        },
        topSection: {
            marginBottom: 8,
        },
        rateCard: {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderRadius: 16,
            padding: 18,
            borderWidth: 1,
            borderColor: isDark ? '#334155' : '#E2E8F0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 6,
            elevation: 2,
            marginBottom: 16,
        },
        rateCardHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
        },
        rateIconBg: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
        },
        rateCardTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: isDark ? '#F1F5F9' : '#0F172A',
        },
        rateCardSubtitle: {
            fontSize: 12,
            color: isDark ? '#94A3B8' : '#64748B',
            marginTop: 2,
        },
        editRateBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: '#3B82F6',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 20,
        },
        editRateBtnText: {
            fontSize: 13,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        rateValueRow: {
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 10,
            marginBottom: 8,
        },
        rateValueText: {
            fontSize: 34,
            fontWeight: '800',
            color: '#3B82F6',
        },
        rateBadge: {
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
        },
        rateBadgeText: {
            fontSize: 12,
            fontWeight: '600',
            color: '#2563EB',
        },
        calcPreviewRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#F0F9FF',
            padding: 10,
            borderRadius: 10,
        },
        calcPreviewText: {
            fontSize: 13,
            color: isDark ? '#93C5FD' : '#0369A1',
            flex: 1,
            fontWeight: '500',
        },
        statsDivider: {
            height: 1,
            backgroundColor: isDark ? '#334155' : '#E2E8F0',
            marginVertical: 14,
        },
        statsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
        },
        statBox: {
            alignItems: 'center',
            flex: 1,
        },
        statNumber: {
            fontSize: 18,
            fontWeight: '700',
            color: isDark ? '#F1F5F9' : '#0F172A',
        },
        statSubNumber: {
            fontSize: 13,
            fontWeight: '500',
            color: isDark ? '#94A3B8' : '#64748B',
        },
        statLabel: {
            fontSize: 11,
            color: isDark ? '#94A3B8' : '#64748B',
            marginTop: 2,
        },
        statDividerVertical: {
            width: 1,
            height: 28,
            backgroundColor: isDark ? '#334155' : '#E2E8F0',
        },
        searchSection: {
            marginTop: 4,
            marginBottom: 8,
        },
        filterTabsRow: {
            flexDirection: 'row',
            gap: 8,
            marginTop: 12,
            marginBottom: 12,
        },
        filterChip: {
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 20,
            backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
        },
        filterChipActive: {
            backgroundColor: '#3B82F6',
        },
        filterChipText: {
            fontSize: 13,
            fontWeight: '600',
            color: isDark ? '#94A3B8' : '#475569',
        },
        filterChipTextActive: {
            color: '#FFFFFF',
        },
        bulkRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 6,
            marginBottom: 6,
        },
        bulkSectionTitle: {
            fontSize: 15,
            fontWeight: '700',
            color: isDark ? '#F1F5F9' : '#0F172A',
        },
        bulkBtnGroup: {
            flexDirection: 'row',
            gap: 8,
        },
        bulkBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 14,
            backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
        },
        bulkBtnText: {
            fontSize: 12,
            fontWeight: '600',
            color: '#3B82F6',
        },
        card: {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderRadius: 14,
            padding: 14,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: isDark ? '#334155' : '#E2E8F0',
        },
        cardActive: {
            borderColor: isDark ? '#1E3A8A' : '#BFDBFE',
            backgroundColor: isDark ? '#132144' : '#F8FAFF',
        },
        cardPending: {
            borderLeftWidth: 4,
            borderLeftColor: '#F59E0B',
        },
        cardHeader: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        avatar: {
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: isDark ? '#334155' : '#E2E8F0',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
        },
        avatarActive: {
            backgroundColor: '#3B82F6',
        },
        avatarText: {
            fontSize: 15,
            fontWeight: '700',
            color: isDark ? '#94A3B8' : '#475569',
        },
        avatarTextActive: {
            color: '#FFFFFF',
        },
        cardMainInfo: {
            flex: 1,
        },
        nameRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        labourName: {
            fontSize: 15,
            fontWeight: '600',
            color: isDark ? '#F1F5F9' : '#0F172A',
            flexShrink: 1,
        },
        pendingBadge: {
            backgroundColor: '#FEF3C7',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
        },
        pendingBadgeText: {
            fontSize: 10,
            fontWeight: '700',
            color: '#B45309',
        },
        labourPhone: {
            fontSize: 12,
            color: isDark ? '#94A3B8' : '#64748B',
            marginTop: 2,
        },
        siteBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 4,
        },
        siteBadgeText: {
            fontSize: 12,
            color: isDark ? '#94A3B8' : '#64748B',
            flexShrink: 1,
        },
        toggleWrapper: {
            marginLeft: 8,
        },
        cardFooter: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 10,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: isDark ? '#334155' : '#F1F5F9',
        },
        wagePill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        wagePillText: {
            fontSize: 13,
            fontWeight: '600',
            color: isDark ? '#93C5FD' : '#2563EB',
        },
        esiPill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: isDark ? '#334155' : '#F1F5F9',
        },
        esiPillActive: {
            backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7',
        },
        esiPillText: {
            fontSize: 12,
            color: isDark ? '#94A3B8' : '#64748B',
            fontWeight: '500',
        },
        esiPillTextActive: {
            color: isDark ? '#86EFAC' : '#15803D',
            fontWeight: '600',
        },
        emptyContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 48,
        },
        emptyTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: isDark ? '#F1F5F9' : '#0F172A',
            marginTop: 12,
        },
        emptySubtitle: {
            fontSize: 13,
            color: isDark ? '#94A3B8' : '#64748B',
            marginTop: 4,
            textAlign: 'center',
        },
        floatingBar: {
            position: 'absolute',
            bottom: 20,
            left: 16,
            right: 16,
            backgroundColor: isDark ? '#1E293B' : '#0F172A',
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 8,
            borderWidth: 1,
            borderColor: isDark ? '#334155' : '#334155',
        },
        floatingBarInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        floatingDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#F59E0B',
        },
        floatingText: {
            fontSize: 14,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        floatingActions: {
            flexDirection: 'row',
            gap: 8,
        },
        discardBtn: {
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: isDark ? '#334155' : '#1E293B',
        },
        discardBtnText: {
            fontSize: 13,
            fontWeight: '600',
            color: '#CBD5E1',
        },
        saveBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: '#3B82F6',
        },
        saveBtnText: {
            fontSize: 13,
            fontWeight: '700',
            color: '#FFFFFF',
        },
        modalDescription: {
            fontSize: 14,
            color: isDark ? '#94A3B8' : '#64748B',
            lineHeight: 20,
            marginBottom: 16,
        },
        inputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isDark ? '#334155' : '#CBD5E1',
            paddingHorizontal: 16,
            marginBottom: 12,
        },
        textInput: {
            flex: 1,
            height: 48,
            fontSize: 18,
            fontWeight: '700',
            color: isDark ? '#F1F5F9' : '#0F172A',
        },
        inputSuffix: {
            fontSize: 18,
            fontWeight: '700',
            color: isDark ? '#94A3B8' : '#64748B',
            marginLeft: 4,
        },
        errorText: {
            fontSize: 13,
            color: '#EF4444',
            marginBottom: 8,
        },
        modalCalcBox: {
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
            padding: 12,
            borderRadius: 10,
            marginTop: 8,
        },
        modalCalcTitle: {
            fontSize: 12,
            color: isDark ? '#93C5FD' : '#2563EB',
            fontWeight: '500',
        },
        modalCalcValue: {
            fontSize: 16,
            fontWeight: '700',
            color: isDark ? '#BFDBFE' : '#1D4ED8',
            marginTop: 2,
        },
    });
