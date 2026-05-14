import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { CustomModal } from './CustomModal';

interface SalaryPaymentModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    labourId: number;
    labourName: string;
    totalPayable: number;
    monthReference: string; // e.g., '2023-10'
}

export const SalaryPaymentModal: React.FC<SalaryPaymentModalProps> = ({
    visible,
    onClose,
    onSuccess,
    labourId,
    labourName,
    totalPayable,
    monthReference,
}) => {
    const { isDark } = useTheme();
    const styles = getStyles(isDark);

    const [amount, setAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
    const [notes, setNotes] = useState<string>('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            setAmount(totalPayable > 0 ? totalPayable.toString() : '');
            setPaymentMethod('Cash');
            setNotes('');
        }
    }, [visible, totalPayable]);

    const handleSave = async () => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
            return;
        }

        submitPayment();
    };

    const submitPayment = async () => {
        setLoading(true);
        try {
            const numAmount = parseFloat(amount);
            const body = {
                labour_id: labourId,
                amount: numAmount,
                date: new Date().toISOString().split('T')[0],
                month_reference: monthReference,
                payment_method: paymentMethod,
                notes: notes,
            };

            const response = await api.post('/reports/payments/salary', body);
            const data = await response.json();

            if (response.ok) {
                Alert.alert('Success', 'Payment recorded successfully.');
                onSuccess();
                onClose();
            } else {
                Alert.alert('Error', data.error || 'Failed to record payment');
            }
        } catch (error) {
            console.error('Payment Error:', error);
            Alert.alert('Error', 'Unable to connect to the server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <CustomModal
            visible={visible}
            onClose={onClose}
            title="Record Salary Payment"
            type="default"
            actions={[
                { text: 'Cancel', onPress: onClose, style: 'cancel' },
                { text: 'Save Payment', onPress: handleSave, style: 'default' }
            ]}
        >
            <View style={styles.formContainer}>
                <Text style={styles.infoText}>Paying: <Text style={styles.bold}>{labourName}</Text></Text>
                <Text style={styles.infoText}>Total Payable: <Text style={styles.bold}>₹{totalPayable}</Text></Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Amount Paid (₹)</Text>
                    <TextInput
                        style={styles.input}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="numeric"
                        placeholder="Enter amount"
                        placeholderTextColor={isDark ? '#666' : '#999'}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Payment Method</Text>
                    <View style={styles.row}>
                        {['Cash', 'UPI', 'Bank'].map(method => (
                            <Text
                                key={method}
                                onPress={() => setPaymentMethod(method)}
                                style={[
                                    styles.pill,
                                    paymentMethod === method && styles.activePill
                                ]}
                            >
                                {method}
                            </Text>
                        ))}
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Notes (Optional)</Text>
                    <TextInput
                        style={[styles.input, { minHeight: 60 }]}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        placeholder="e.g., Final settlement"
                        placeholderTextColor={isDark ? '#666' : '#999'}
                    />
                </View>

                {loading && <ActivityIndicator size="large" color="#0a84ff" style={{ marginTop: 10 }} />}
            </View>
        </CustomModal>
    );
};

const getStyles = (isDark: boolean) => StyleSheet.create({
    formContainer: {
        width: '100%',
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
        marginTop: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: isDark ? '#aaa' : '#555',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: isDark ? '#444' : '#ccc',
        borderRadius: 8,
        padding: 12,
        color: isDark ? '#fff' : '#000',
        backgroundColor: isDark ? '#2a2a2a' : '#fafafa',
        fontSize: 16,
    },
    row: {
        flexDirection: 'row',
        gap: 10,
    },
    pill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: isDark ? '#444' : '#ccc',
        color: isDark ? '#fff' : '#333',
        overflow: 'hidden',
    },
    activePill: {
        backgroundColor: '#0a84ff',
        color: '#fff',
        borderColor: '#0a84ff',
    }
});
