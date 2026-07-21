import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { api } from "../services/api";
import { Calendar } from "./Calendar";
import { CustomModal } from "./CustomModal";

interface Labour {
    id: number;
    name: string;
    phone?: string;
}

interface AdvanceModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    labour: Labour | null;
    currentUserId: number | null;
}

export const AdvanceModal: React.FC<AdvanceModalProps> = ({
    visible,
    onClose,
    onSuccess,
    labour,
    currentUserId,
}) => {
    const { isDark } = useTheme();
    const styles = getStyles(isDark);

    const [amount, setAmount] = useState("");
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    useEffect(() => {
        if (visible) {
            setAmount("");
            setNotes("");
            setDate(new Date());
            setShowDatePicker(false);
        }
    }, [visible]);

    const formatDate = (d: Date) => {
        return d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const handleSave = async () => {
        if (!labour || !amount) {
            Alert.alert("Error", "Please enter an amount");
            return;
        }

        if (isNaN(Number(amount)) || Number(amount) <= 0) {
            Alert.alert("Error", "Please enter a valid amount");
            return;
        }

        try {
            setSubmitting(true);
            const response = await api.post(`/labours/${labour.id}/advance`, {
                amount: Number(amount),
                date: date.toISOString(),
                notes: notes,
                created_by: currentUserId
            });

            const data = await response.json();

            if (response.ok) {
                Alert.alert("Success", `Added advance of ₹${amount} to ${labour.name}`);
                if (onSuccess) onSuccess();
                onClose();
            } else {
                Alert.alert("Error", data.error || "Failed to add advance");
            }
        } catch (error) {
            console.error("Advance error:", error);
            Alert.alert("Error", "Unable to connect to server");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <CustomModal
            visible={visible}
            onClose={onClose}
            title="Add Advance"
            type="default"
            actions={[
                { text: "Cancel", onPress: onClose, style: "cancel" },
                { text: submitting ? "Saving..." : "Save Advance", onPress: handleSave, style: "default" }
            ]}
        >
            <View style={styles.formContainer}>
                <Text style={styles.infoText}>Labour: <Text style={styles.bold}>{labour?.name || ""}</Text></Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Date</Text>
                    <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowDatePicker(!showDatePicker)}>
                        <Text style={{ color: isDark ? "#fff" : "#333", fontSize: 16 }}>
                            {formatDate(date)}
                        </Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                        <View style={{ marginTop: 10 }}>
                            <Calendar
                                selectedDate={date}
                                onDateSelect={(d) => {
                                    setDate(d);
                                    setShowDatePicker(false);
                                }}
                                markedDates={[]}
                                onMonthChange={() => { }}
                            />
                        </View>
                    )}
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Amount (₹)</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="Enter amount"
                        value={amount}
                        onChangeText={setAmount}
                        placeholderTextColor={isDark ? "#888" : "#999"}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Notes (Optional)</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Enter notes"
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={3}
                        placeholderTextColor={isDark ? "#888" : "#999"}
                    />
                </View>
                {submitting && <ActivityIndicator size="large" color="#0a84ff" style={{ marginTop: 10 }} />}
            </View>
        </CustomModal>
    );
};

const getStyles = (isDark: boolean) => StyleSheet.create({
    formContainer: {
        width: "100%",
        marginTop: 10,
    },
    infoText: {
        fontSize: 16,
        color: isDark ? '#ccc' : '#444',
        marginBottom: 8,
    },
    bold: {
        fontWeight: 'bold',
        color: isDark ? '#fff' : '#000',
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        color: isDark ? "#ccc" : "#333",
        fontWeight: "500",
        marginBottom: 8,
    },
    input: {
        backgroundColor: isDark ? "#2a2a2a" : "#f9f9f9",
        borderWidth: 1,
        borderColor: isDark ? "#444" : "#ddd",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: isDark ? "#fff" : "#333",
    },
    textArea: {
        height: 60,
        textAlignVertical: "top",
    },
});
