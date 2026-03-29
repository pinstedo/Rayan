import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface Labour {
    id: number;
    name: string;
    phone: string;
    trade: string;
    rate?: number;
    site: string;
    site_id?: number;
    status?: 'active' | 'terminated' | 'blacklisted';
    profile_image?: string;
    date_of_birth?: string;
    emergency_phone?: string;
}

interface LabourCardProps {
    labour: Labour;
    onMove?: (labour: Labour) => void;
    onTerminate?: (labour: Labour) => void;
    onBlacklist?: (labour: Labour) => void;
    onRevoke?: (labour: Labour) => void;
    onAdvance?: (labour: Labour) => void;
    showMoveAction?: boolean;
    hideRate?: boolean;
    onPress?: (labour: Labour) => void;
}

export const LabourCard = ({ labour, onMove, onTerminate, onBlacklist, onRevoke, onAdvance, onPress, showMoveAction = false, hideRate = false }: LabourCardProps) => {
    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'terminated': return '#e53935';
            case 'blacklisted': return '#424242';
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
    const isActionable = labour.status !== 'terminated' && labour.status !== 'blacklisted';
    const isTerminated = labour.status === 'terminated';
    const isBlacklisted = labour.status === 'blacklisted';

    const CardContent = (
        <View style={[
            styles.card,
            labour.status === 'terminated' && styles.terminatedCard,
            labour.status === 'blacklisted' && styles.blacklistedCard
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
                        <Text style={styles.rateLabel}>Rate/hr</Text>
                        <Text style={styles.rate}>
                            {labour.rate ? `₹${Number(labour.rate).toFixed(2)}` : "-"}
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
                    <MaterialIcons name="work" size={16} color="#666" />
                    <Text style={styles.detailText}>{labour.trade || "General"}</Text>
                </View>
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
                                onPress={() => onTerminate && onTerminate(labour)}
                            >
                                <MaterialIcons name="block" size={16} color="#e53935" />
                                <Text style={[styles.actionBtnText, { color: '#e53935' }]}>Terminate</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => onBlacklist && onBlacklist(labour)}
                            >
                                <MaterialIcons name="gavel" size={16} color="#333" />
                                <Text style={[styles.actionBtnText, { color: '#333' }]}>Blacklist</Text>
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

                    {isTerminated && showMoveAction && (
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => onRevoke && onRevoke(labour)}
                        >
                            <MaterialIcons name="restore" size={16} color="#e53935" />
                            <Text style={[styles.actionBtnText, { color: '#e53935' }]}>Revoke Termination</Text>
                        </TouchableOpacity>
                    )}

                    {isBlacklisted && showMoveAction && (
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => onRevoke && onRevoke(labour)}
                        >
                            <MaterialIcons name="restore" size={16} color="#333" />
                            <Text style={[styles.actionBtnText, { color: '#333' }]}>Remove from Blacklist</Text>
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
    terminatedCard: {
        backgroundColor: '#ffebee',
        borderColor: '#ef9a9a',
        borderWidth: 1,
    },
    blacklistedCard: {
        backgroundColor: '#eeeeee',
        borderColor: '#bdbdbd',
        borderWidth: 1,
        opacity: 0.8,
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
