import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";

interface Labour {
    id: number;
    name: string;
    phone: string;
    rate?: number;
    site: string;
    site_id?: number;
    status?: 'active' | 'unassigned' | 'leave' | 'pending';
    profile_image?: string;
    date_of_birth?: string;
    emergency_phone?: string;
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
    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'unassigned': return '#9e9e9e';
            case 'leave': return '#ed6c02';
            default: return '#2e7d32'; // active
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

    const CardContent = (
        <View style={[
            styles.card,
            labour.status === 'unassigned' && styles.unassignedCard,
            labour.status === 'leave' && styles.leaveCard,
        ]}>
            <View style={styles.headerRow}>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    {/* Profile Image (Small) */}
                    <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' }}>
                        {labour.profile_image ? (
                            <Image
                                source={{ uri: labour.profile_image }}
                                style={{ width: 40, height: 40 }}
                            />
                        ) : (
                            <MaterialIcons name="person" size={24} color="#ccc" />
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
                            {labour.rate ? `₹${Number(labour.rate * 8).toFixed(2)}` : "-"}
                        </Text>
                    </View>
                )}
            </View>

            {/* Extra Details Row (Age, Emergency) */}
            {(age || labour.emergency_phone) && (
                <View style={[styles.detailsRow, { marginBottom: 8 }]}>
                    {age && (
                        <View style={styles.detailItem}>
                            <MaterialIcons name="cake" size={16} color="#666" />
                            <Text style={styles.detailText}>{age} yrs</Text>
                        </View>
                    )}
                    {labour.emergency_phone && (
                        <View style={styles.detailItem}>
                            <MaterialIcons name="phone-in-talk" size={16} color="#666" />
                            <Text style={styles.detailText}>{labour.emergency_phone}</Text>
                        </View>
                    )}
                </View>
            )}

            <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                    <MaterialIcons name="location-city" size={16} color="#666" />
                    <Text style={styles.detailText} numberOfLines={1}>{labour.site || "Unassigned"}</Text>
                </View>
            </View>

            {(showMoveAction || onAdvance) && (
                <View style={styles.actionRow}>
                    {isActionable && showMoveAction && (
                        <>
                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => onMove && onMove(labour)}
                            >
                                <MaterialIcons name="sync-alt" size={16} color="#0a84ff" />
                                <Text style={[styles.actionBtnText, { color: '#0a84ff' }]}>Move</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => onUnassign && onUnassign(labour)}
                            >
                                <MaterialIcons name="block" size={16} color="#e53935" />
                                <Text style={[styles.actionBtnText, { color: '#e53935' }]}>Unassign</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {isActionable && onAdvance && (
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => onAdvance(labour)}
                        >
                            <MaterialIcons name="attach-money" size={16} color="#2e7d32" />
                            <Text style={[styles.actionBtnText, { color: '#2e7d32' }]}>Advance</Text>
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
                                color="#2e7d32"
                            />
                            <Text style={[styles.actionBtnText, { color: '#2e7d32' }]}>
                                {labour.status === 'leave' ? 'End Leave' : 'Assign Site'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {labour.status !== 'leave' && showMoveAction && (
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => onMarkLeave && onMarkLeave(labour)}
                        >
                            <MaterialIcons name="event-busy" size={16} color="#ed6c02" />
                            <Text style={[styles.actionBtnText, { color: '#ed6c02' }]}>Mark Leave</Text>
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

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    unassignedCard: {
        backgroundColor: '#eeeeee',
        borderColor: '#bdbdbd',
        borderWidth: 1,
        opacity: 0.8,
    },
    leaveCard: {
        backgroundColor: '#fff8f0',
        borderColor: '#ed6c02',
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
        color: "#333",
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
        color: "#666",
    },
    rateContainer: {
        alignItems: "flex-end",
    },
    rateLabel: {
        fontSize: 12,
        color: "#999",
    },
    rate: {
        fontSize: 16,
        fontWeight: "600",
        color: "#2e7d32",
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
        color: "#555",
        flex: 1,
    },
    actionRow: {
        borderTopWidth: 1,
        borderTopColor: "#f0f0f0",
        paddingTop: 12,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 12,
    },
    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
        backgroundColor: '#f5f5f5',
    },
    actionBtnText: {
        fontSize: 12,
        fontWeight: "600",
    },
    moveBtn: { // Keeping for backward compatibility if needed, though replaced
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#e8f4ff",
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    moveBtnText: {
        fontSize: 14,
        color: "#0a84ff",
        fontWeight: "600",
    },
});
