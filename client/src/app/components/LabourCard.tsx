import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getDailyWage } from "../../utils/wages";
import { useTheme } from "../../context/ThemeContext";

interface Labour {
    id: number;
    name: string;
    phone: string;
    daily_wage?: number;
    rate?: number;
    site: string;
    site_id?: number;
    status?: 'active' | 'unassigned' | 'leave' | 'pending';
    profile_image?: string;
    date_of_birth?: string;
    emergency_phone?: string;
    monthly_advance?: number;
}

interface LabourCardProps {
    labour: Labour;
    onMove?: (labour: Labour) => void;
    onUnassign?: (labour: Labour) => void;
    onRevoke?: (labour: Labour) => void;
    onAdvance?: (labour: Labour) => void;
    onMarkLeave?: (labour: Labour) => void;
    showMoveAction?: boolean;
    hideRate?: boolean;
    onPress?: (labour: Labour) => void;
}

export const LabourCard = ({ labour, onMove, onUnassign, onRevoke, onAdvance, onMarkLeave, onPress, showMoveAction = false, hideRate = false }: LabourCardProps) => {
    const { isDark } = useTheme();
    const styles = getStyles(isDark);
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const currentMonthName = months[new Date().getMonth()];

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'unassigned': return isDark ? '#757575' : '#9e9e9e';
            case 'leave': return isDark ? '#f57c00' : '#ed6c02';
            default: return isDark ? '#388e3c' : '#2e7d32'; // active
        }
    };

    const calculateAge = (dobString?: string) => {
        if (!dobString) return null;
        const dob = new Date(dobString);
        const diffMs = Date.now() - dob.getTime();
        const ageDate = new Date(diffMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };

    const age = calculateAge(labour.date_of_birth);
    const isActionable = labour.status !== 'unassigned' && labour.status !== 'leave';
    const isUnassigned = labour.status === 'unassigned';
    const dailyWage = getDailyWage(labour);

    const CardContent = (
        <View style={[
            styles.card,
            labour.status === 'unassigned' && styles.unassignedCard,
            labour.status === 'leave' && styles.leaveCard,
        ]}>
            <View style={styles.headerRow}>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    {/* Profile Image (Small) */}
                    <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: isDark ? '#333' : '#eee', justifyContent: 'center', alignItems: 'center' }}>
                        {labour.profile_image ? (
                            <Image
                                source={{ uri: labour.profile_image }}
                                style={{ width: 40, height: 40 }}
                            />
                        ) : (
                            <MaterialIcons name="person" size={24} color={isDark ? "#666" : "#ccc"} />
                        )}
                    </View>

                    <View>
                        <View style={styles.nameRow}>
                            <Text style={styles.name}>{labour.name}</Text>
                            {labour.status && labour.status !== 'active' && (
                                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(labour.status) }]}>
                                    <Text style={styles.statusText}>{labour.status.toUpperCase()}</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.phone}>{labour.phone}</Text>
                    </View>
                </View>

                {!hideRate && (
                    <View style={styles.rateContainer}>
                        <Text style={styles.rateLabel}>Rate/day</Text>
                        <Text style={styles.rate}>
                            {dailyWage > 0 ? `₹${dailyWage.toFixed(2)}` : "-"}
                        </Text>
                    </View>
                )}
            </View>

            {/* Extra Details Row (Age, Emergency) */}
            {(age || labour.emergency_phone) && (
                <View style={[styles.detailsRow, { marginBottom: 8 }]}>
                    {age && (
                        <View style={styles.detailItem}>
                            <MaterialIcons name="cake" size={16} color={isDark ? "#aaa" : "#666"} />
                            <Text style={styles.detailText}>{age} yrs</Text>
                        </View>
                    )}
                    {labour.emergency_phone && (
                        <View style={styles.detailItem}>
                            <MaterialIcons name="phone-in-talk" size={16} color={isDark ? "#aaa" : "#666"} />
                            <Text style={styles.detailText}>{labour.emergency_phone}</Text>
                        </View>
                    )}
                </View>
            )}

            <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                    <MaterialIcons name="location-city" size={16} color={isDark ? "#aaa" : "#666"} />
                    <Text style={styles.detailText} numberOfLines={1}>{labour.site || "Unassigned"}</Text>
                </View>
            </View>

            {labour.monthly_advance !== undefined && labour.monthly_advance > 0 && (
                <View style={[styles.detailsRow, { marginTop: 4 }]}>
                    <View style={styles.detailItem}>
                        <Text style={[styles.detailText, { color: isDark ? '#ff8a80' : '#c62828', fontWeight: '600' }]}>
                            {currentMonthName} Advance: ₹{labour.monthly_advance}
                        </Text>
                    </View>
                </View>
            )}

            {(showMoveAction || onAdvance) && (
                <View style={styles.actionRow}>
                    {isActionable && showMoveAction && (
                        <>
                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => onMove && onMove(labour)}
                            >
                                <MaterialIcons name="sync-alt" size={16} color={isDark ? '#4da6ff' : '#0a84ff'} />
                                <Text style={[styles.actionBtnText, { color: isDark ? '#4da6ff' : '#0a84ff' }]}>Move</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => onUnassign && onUnassign(labour)}
                            >
                                <MaterialIcons name="block" size={16} color={isDark ? '#ff6b6b' : '#e53935'} />
                                <Text style={[styles.actionBtnText, { color: isDark ? '#ff6b6b' : '#e53935' }]}>Unassign</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {onAdvance && (
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => onAdvance(labour)}
                        >
                            <MaterialIcons name="attach-money" size={14} color={isDark ? '#81c784' : '#2e7d32'} />
                            <Text style={[styles.actionBtnText, { color: isDark ? '#81c784' : '#2e7d32' }]}>Advance</Text>
                        </TouchableOpacity>
                    )}

                    {(isUnassigned || labour.status === 'leave') && showMoveAction && (
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => {
                                if (labour.status === 'leave') {
                                    onRevoke && onRevoke(labour);
                                } else {
                                    onMove && onMove(labour);
                                }
                            }}
                        >
                            <MaterialIcons
                                name={labour.status === 'leave' ? 'event-available' : 'location-city'}
                                size={16}
                                color={isDark ? '#81c784' : '#2e7d32'}
                            />
                            <Text style={[styles.actionBtnText, { color: isDark ? '#81c784' : '#2e7d32' }]}>
                                {labour.status === 'leave' ? 'End Leave' : 'Assign Site'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {labour.status !== 'leave' && showMoveAction && (
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => onMarkLeave && onMarkLeave(labour)}
                        >
                            <MaterialIcons name="event-busy" size={16} color={isDark ? '#ffb74d' : '#ed6c02'} />
                            <Text style={[styles.actionBtnText, { color: isDark ? '#ffb74d' : '#ed6c02' }]}>Mark Leave</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity onPress={() => onPress(labour)} activeOpacity={0.7}>
                {CardContent}
            </TouchableOpacity>
        );
    }

    return CardContent;
};

const getStyles = (isDark: boolean) => StyleSheet.create({
    card: {
        backgroundColor: isDark ? "#1e1e1e" : "#fff",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 4,
        borderWidth: isDark ? 1 : 0,
        borderColor: isDark ? "#333" : "transparent",
    },
    unassignedCard: {
        backgroundColor: isDark ? '#2e2e2e' : '#eeeeee',
        borderColor: isDark ? '#424242' : '#bdbdbd',
        borderWidth: 1,
        opacity: 0.8,
    },
    leaveCard: {
        backgroundColor: isDark ? '#3d240d' : '#fff8f0',
        borderColor: isDark ? '#e65100' : '#ed6c02',
        borderWidth: 1,
        opacity: 0.85,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 12,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    name: {
        fontSize: 18,
        fontWeight: "700",
        color: isDark ? "#fff" : "#333",
    },
    statusBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    phone: {
        fontSize: 14,
        color: isDark ? "#aaa" : "#666",
    },
    rateContainer: {
        alignItems: "flex-end",
    },
    rateLabel: {
        fontSize: 12,
        color: isDark ? "#888" : "#999",
    },
    rate: {
        fontSize: 16,
        fontWeight: "600",
        color: isDark ? "#81c784" : "#2e7d32",
    },
    detailsRow: {
        flexDirection: "row",
        gap: 16,
        marginBottom: 12,
    },
    detailItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flex: 1,
    },
    detailText: {
        fontSize: 14,
        color: isDark ? "#ccc" : "#555",
        flex: 1,
    },
    actionRow: {
        borderTopWidth: 1,
        borderTopColor: isDark ? "#333" : "#f0f0f0",
        paddingTop: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 12,
        rowGap: 8,
    },
    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
        backgroundColor: isDark ? "#2a2a2a" : "#f5f5f5",
    },
    actionBtnText: {
        fontSize: 12,
        fontWeight: "600",
    },
    moveBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: isDark ? "#1a3b5c" : "#e8f4ff",
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    moveBtnText: {
        fontSize: 14,
        color: isDark ? "#4da6ff" : "#0a84ff",
        fontWeight: "600",
    },
});
