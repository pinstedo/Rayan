import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
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
    increment_cycle_count: number;
    total_bonus_earned: number;
    bonus_due: number;
    progress_percent: number;
}

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

    const renderItem = ({ item }: { item: EligibleLabour }) => {
        const pct = item.progress_percent;
        const isFullyEligible = Number(item.worked_days_count) >= 275;

        return (
            <TouchableOpacity
                style={local.card}
                onPress={() => router.push(`/(screens)/labour-details?id=${item.id}`)}
                activeOpacity={0.8}
            >
                {/* Top row */}
                <View style={local.cardHeader}>
                    <View style={local.avatarCircle}>
                        <Ionicons name="person" size={20} color={isDark ? '#64b5f6' : '#0a84ff'} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={local.name}>{item.name}</Text>
                        <Text style={local.site}>{item.site || 'Unassigned'}</Text>
                    </View>
                    <View style={local.bonusPill}>
                        <MaterialCommunityIcons name="gift" size={14} color="#fff" />
                        <Text style={local.bonusPillText}>₹{item.bonus_due.toFixed(2)}</Text>
                    </View>
                </View>

                {/* Stats row */}
                <View style={local.statsRow}>
                    <View style={local.stat}>
                        <Text style={local.statValue}>{Number(item.worked_days_count).toFixed(1)}</Text>
                        <Text style={local.statLabel}>Worked Days</Text>
                    </View>
                    <View style={local.statDivider} />
                    <View style={local.stat}>
                        <Text style={[local.statValue, { color: isDark ? '#ffb74d' : '#e65100' }]}>
                            ₹{Number(item.total_bonus_earned).toFixed(2)}
                        </Text>
                        <Text style={local.statLabel}>Total Earned</Text>
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
                            {isFullyEligible ? '✓ Bonus Eligible' : `${Number(item.worked_days_count).toFixed(1)} / 275 days`}
                        </Text>
                        <Text style={[local.progressPct, isFullyEligible && { color: '#4CAF50' }]}>{pct}%</Text>
                    </View>
                    <View style={local.progressTrack}>
                        <View
                            style={[
                                local.progressFill,
                                {
                                    width: `${pct}%` as any,
                                    backgroundColor: isFullyEligible ? '#4CAF50' : isDark ? '#4da6ff' : '#0a84ff',
                                },
                            ]}
                        />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={local.container}>
            {/* Header */}
            <View style={local.header}>
                <TouchableOpacity onPress={() => router.back()} style={local.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#333'} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={local.title}>Eligible Labours</Text>
                    <Text style={local.subtitle}>Worked days ≥ 275 • Bonus due: worked_days / 22</Text>
                </View>
                {!loading && (
                    <View style={local.countBadge}>
                        <Text style={local.countBadgeText}>{labours.length}</Text>
                    </View>
                )}
            </View>

            {loading ? (
                <View style={local.center}>
                    <ActivityIndicator size="large" color="#0a84ff" />
                    <Text style={local.centerText}>Loading eligible labours…</Text>
                </View>
            ) : error ? (
                <View style={local.center}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={40} color="#e53935" />
                    <Text style={[local.centerText, { color: '#e53935' }]}>{error}</Text>
                    <TouchableOpacity style={local.retryBtn} onPress={() => fetchEligible()}>
                        <Text style={local.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : labours.length === 0 ? (
                <View style={local.center}>
                    <MaterialCommunityIcons name="calendar-check-outline" size={56} color={isDark ? '#333' : '#ddd'} />
                    <Text style={local.centerText}>No labours have reached 275 worked days yet.</Text>
                    <Text style={[local.centerText, { fontSize: 13, marginTop: 4 }]}>
                        Worked days accumulate automatically as attendance is marked.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={labours}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={local.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => fetchEligible(true)}
                            colors={['#0a84ff']}
                            tintColor={isDark ? '#64b5f6' : '#0a84ff'}
                        />
                    }
                />
            )}
        </View>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: isDark ? '#0e0e0e' : '#f0f2f5',
        paddingTop: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
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
        gap: 12,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 32,
    },
    centerText: {
        fontSize: 15,
        color: isDark ? '#aaa' : '#666',
        textAlign: 'center',
        lineHeight: 22,
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
        backgroundColor: isDark ? '#3d2c00' : '#fff3e0',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
    },
    bonusPillText: {
        fontSize: 14,
        fontWeight: '800',
        color: isDark ? '#ffb74d' : '#e65100',
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
        fontSize: 14,
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
