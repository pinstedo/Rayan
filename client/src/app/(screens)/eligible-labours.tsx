import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { AppRefreshControl, LoadingScreen, TopRefreshLoader } from '../../components/RefreshFeedback';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';

interface EligibleLabour {
    id: number;
    name: string;
    phone: string;
    site?: string;
    rate: number;
    status: string;
    worked_days_count: number;
    continuous_working_days: number;
    increment_cycle_count: number;
    total_bonus_earned: number;
    bonus_due: number;
    progress_percent: number;
    eligible_for: 'bonus' | 'increment' | 'none';
    is_bonus_eligible: boolean;
    is_increment_eligible: boolean;
}

const BONUS_THRESHOLD = 285;
const INCREMENT_THRESHOLD = 300;

export default function EligibleLaboursScreen() {
    const router = useRouter();
    const { isDark } = useTheme();
    const local = getStyles(isDark);

    const [labours, setLabours] = useState<EligibleLabour[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            fetchEligible();
        }, [])
    );

    const fetchEligible = async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            setError(null);

            const res = await api.get('/labours/eligible');
            const data = await res.json();
            if (res.ok) {
                setLabours(data);
            } else {
                setError(data.error || 'Failed to fetch eligible labours');
            }
        } catch {
            setError('Unable to connect to server');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const incrementEligible = labours.filter(l => l.is_increment_eligible);
    const bonusOnly = labours.filter(l => l.is_bonus_eligible && !l.is_increment_eligible);

    const renderCard = (item: EligibleLabour) => {
        const continuous = Number(item.continuous_working_days ?? item.worked_days_count ?? 0);
        const isInc = item.is_increment_eligible;

        // Progress toward next threshold
        const progressTarget = isInc ? INCREMENT_THRESHOLD : BONUS_THRESHOLD;
        const progressStart = isInc ? BONUS_THRESHOLD : 0;
        const progressPct = Math.min(
            100,
            Math.round(((continuous - progressStart) / (progressTarget - progressStart)) * 100)
        );

        const barColor = isInc
            ? (isDark ? '#81c784' : '#2e7d32')
            : (isDark ? '#ffb74d' : '#ff9800');

        const pillBg = isInc
            ? (isDark ? '#1a3b1a' : '#e8f5e9')
            : (isDark ? '#3d2c00' : '#fff3e0');
        const pillIconColor = isInc ? (isDark ? '#81c784' : '#2e7d32') : '#fff';
        const pillTextColor = isInc ? (isDark ? '#81c784' : '#2e7d32') : (isDark ? '#ffb74d' : '#e65100');

        return (
            <TouchableOpacity
                key={item.id}
                style={[local.card, isInc && local.cardIncrement]}
                onPress={() => router.push(`/(screens)/labour-details?id=${item.id}`)}
                activeOpacity={0.8}
            >
                {/* Top row */}
                <View style={local.cardHeader}>
                    <View style={[local.avatarCircle, isInc && local.avatarCircleInc]}>
                        <Ionicons
                            name="person"
                            size={20}
                            color={isInc ? (isDark ? '#81c784' : '#2e7d32') : (isDark ? '#64b5f6' : '#0a84ff')}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={local.name}>{item.name}</Text>
                        <Text style={local.site}>{item.site || 'Unassigned'}</Text>
                    </View>
                    {/* Badge pill */}
                    <View style={[local.bonusPill, { backgroundColor: pillBg }]}>
                        {isInc
                            ? <MaterialCommunityIcons name="trending-up" size={14} color={pillIconColor} />
                            : <MaterialCommunityIcons name="gift" size={14} color={pillIconColor} />
                        }
                        <Text style={[local.bonusPillText, { color: pillTextColor }]}>
                            {isInc ? `${continuous.toFixed(0)}d` : `₹${item.bonus_due.toFixed(2)}`}
                        </Text>
                    </View>
                </View>

                {/* Stats row */}
                <View style={local.statsRow}>
                    <View style={local.stat}>
                        <Text style={local.statValue}>{continuous.toFixed(1)}</Text>
                        <Text style={local.statLabel}>Cont. Days</Text>
                    </View>
                    <View style={local.statDivider} />
                    <View style={local.stat}>
                        <Text style={[local.statValue, { color: isDark ? '#ffb74d' : '#e65100' }]}>
                            ₹{Number(item.total_bonus_earned).toFixed(0)}
                        </Text>
                        <Text style={local.statLabel}>Bonus Earned</Text>
                    </View>
                    <View style={local.statDivider} />
                    <View style={local.stat}>
                        <Text style={[local.statValue, { color: isDark ? '#81c784' : '#2e7d32' }]}>
                            {item.increment_cycle_count}
                        </Text>
                        <Text style={local.statLabel}>Increments</Text>
                    </View>
                    <View style={local.statDivider} />
                    <View style={local.stat}>
                        <Text style={local.statValue}>₹{item.rate}</Text>
                        <Text style={local.statLabel}>Daily Rate</Text>
                    </View>
                </View>

                {/* Progress bar */}
                <View style={local.progressContainer}>
                    <View style={local.progressHeader}>
                        <Text style={local.progressLabel}>
                            {isInc
                                ? `✓ Increment Eligible (${continuous.toFixed(1)} / ${INCREMENT_THRESHOLD} days)`
                                : `✓ Bonus Eligible — ${continuous.toFixed(1)} / ${BONUS_THRESHOLD} days`
                            }
                        </Text>
                        <Text style={[local.progressPct, { color: barColor }]}>{progressPct}%</Text>
                    </View>
                    <View style={local.progressTrack}>
                        <View
                            style={[
                                local.progressFill,
                                { width: `${progressPct}%` as any, backgroundColor: barColor },
                            ]}
                        />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderSection = (
        title: string,
        icon: string,
        iconColor: string,
        items: EligibleLabour[],
        emptyMessage: string,
        emptySubMessage: string,
    ) => (
        <View style={local.section}>
            {/* Section header */}
            <View style={local.sectionHeader}>
                <MaterialCommunityIcons name={icon as any} size={18} color={iconColor} />
                <Text style={[local.sectionTitle, { color: iconColor }]}>{title}</Text>
                <View style={[local.sectionCount, { backgroundColor: iconColor + '22' }]}>
                    <Text style={[local.sectionCountText, { color: iconColor }]}>{items.length}</Text>
                </View>
            </View>

            {items.length === 0 ? (
                <View style={local.sectionEmpty}>
                    <MaterialCommunityIcons name="calendar-check-outline" size={36} color={isDark ? '#333' : '#ddd'} />
                    <Text style={local.centerText}>{emptyMessage}</Text>
                    <Text style={[local.centerText, { fontSize: 12, marginTop: 2 }]}>{emptySubMessage}</Text>
                </View>
            ) : (
                <View style={{ gap: 10 }}>
                    {items.map(renderCard)}
                </View>
            )}
        </View>
    );

    return (
        <View style={local.container}>
            {/* Header */}
            <View style={local.header}>
                <TouchableOpacity onPress={() => router.back()} style={local.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#333'} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={local.title}>Eligible Labours</Text>
                    <Text style={local.subtitle}>Bonus ≥ 285 days • Increment ≥ 300 days</Text>
                </View>
                {!loading && (
                    <View style={local.countBadge}>
                        <Text style={local.countBadgeText}>{labours.length}</Text>
                    </View>
                )}
            </View>

            {loading ? (
                <LoadingScreen label="Loading eligible labours..." />
            ) : error ? (
                <ScrollView
                    contentContainerStyle={local.centerScroll}
                    refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => fetchEligible(true)} />}
                >
                    <TopRefreshLoader visible={refreshing} />
                    <View style={local.center}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={40} color="#e53935" />
                        <Text style={[local.centerText, { color: '#e53935' }]}>{error}</Text>
                        <TouchableOpacity style={local.retryBtn} onPress={() => fetchEligible()}>
                            <Text style={local.retryText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            ) : (
                <>
                    <TopRefreshLoader visible={refreshing} />
                    <ScrollView
                        contentContainerStyle={local.listContent}
                        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => fetchEligible(true)} />}
                    >
                        {/* Increment Eligible Section — ≥ 300 days */}
                        {renderSection(
                            'Increment Eligible',
                            'trending-up',
                            isDark ? '#81c784' : '#2e7d32',
                            incrementEligible,
                            'No labours have reached 300 continuous days yet.',
                            'Continue to 300 days to unlock increment eligibility.',
                        )}

                        <View style={local.sectionDivider} />

                        {/* Bonus Eligible Section — 285–299 days */}
                        {renderSection(
                            'Bonus Eligible',
                            'gift',
                            isDark ? '#ffb74d' : '#e65100',
                            bonusOnly,
                            'No labours in the 285–299 day range.',
                            '15 more days to become increment eligible.',
                        )}
                    </ScrollView>
                </>
            )}
        </View>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: isDark ? '#0e0e0e' : '#f0f2f5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 15,
        backgroundColor: isDark ? '#1e1e1e' : '#fff',
        borderBottomWidth: 1,
        borderBottomColor: isDark ? '#333' : '#eee',
        gap: 12,
    },
    backBtn: {
        padding: 6,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: isDark ? '#fff' : '#1e1e2e',
    },
    subtitle: {
        fontSize: 12,
        color: isDark ? '#888' : '#999',
        marginTop: 2,
    },
    countBadge: {
        backgroundColor: isDark ? '#1a3b5c' : '#e8f4ff',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    countBadgeText: {
        fontSize: 16,
        fontWeight: '800',
        color: isDark ? '#64b5f6' : '#0a84ff',
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
        gap: 0,
    },
    centerScroll: {
        flexGrow: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 32,
    },
    centerText: {
        fontSize: 14,
        color: isDark ? '#aaa' : '#666',
        textAlign: 'center',
        lineHeight: 20,
    },
    retryBtn: {
        backgroundColor: isDark ? '#1a3b5c' : '#e8f4ff',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
        marginTop: 4,
    },
    retryText: {
        color: isDark ? '#64b5f6' : '#0a84ff',
        fontWeight: '700',
    },

    // Sections
    section: {
        marginBottom: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
        paddingTop: 4,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '800',
        flex: 1,
    },
    sectionCount: {
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 2,
    },
    sectionCountText: {
        fontSize: 13,
        fontWeight: '800',
    },
    sectionEmpty: {
        alignItems: 'center',
        gap: 8,
        paddingVertical: 20,
        backgroundColor: isDark ? '#161616' : '#f9f9f9',
        borderRadius: 14,
        paddingHorizontal: 24,
    },
    sectionDivider: {
        height: 1,
        backgroundColor: isDark ? '#2a2a2a' : '#e8e8e8',
        marginVertical: 18,
    },

    // Card
    card: {
        backgroundColor: isDark ? '#1e1e1e' : '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.25 : 0.07,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: isDark ? '#2a2a2a' : '#f0f0f0',
        marginBottom: 10,
    },
    cardIncrement: {
        borderColor: isDark ? '#2e7d32' : '#c8e6c9',
        borderWidth: 1.5,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14,
    },
    avatarCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: isDark ? '#1a2a3a' : '#e8f4ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarCircleInc: {
        backgroundColor: isDark ? '#1a3b1a' : '#e8f5e9',
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        color: isDark ? '#fff' : '#1e1e2e',
    },
    site: {
        fontSize: 13,
        color: isDark ? '#888' : '#999',
        marginTop: 2,
    },
    bonusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
    },
    bonusPillText: {
        fontSize: 13,
        fontWeight: '800',
    },

    // Stats
    statsRow: {
        flexDirection: 'row',
        marginBottom: 14,
        backgroundColor: isDark ? '#161616' : '#f9f9f9',
        borderRadius: 10,
        padding: 10,
    },
    stat: { flex: 1, alignItems: 'center' },
    statValue: {
        fontSize: 13,
        fontWeight: '800',
        color: isDark ? '#fff' : '#1e1e2e',
    },
    statLabel: {
        fontSize: 10,
        color: isDark ? '#666' : '#aaa',
        marginTop: 2,
        textAlign: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: isDark ? '#333' : '#eee',
    },

    // Progress
    progressContainer: {},
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    progressLabel: {
        fontSize: 12,
        color: isDark ? '#aaa' : '#666',
        flex: 1,
    },
    progressPct: {
        fontSize: 12,
        fontWeight: '700',
        color: isDark ? '#64b5f6' : '#0a84ff',
    },
    progressTrack: {
        height: 8,
        backgroundColor: isDark ? '#333' : '#f0f0f0',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: 8,
        borderRadius: 4,
    },
});
