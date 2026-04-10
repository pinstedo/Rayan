import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { CustomModal } from '../CustomModal';

export interface SortOption {
    label: string;
    field: string;
    type?: 'string' | 'number' | 'date';
}

interface SortSelectorProps {
    options: SortOption[];
    currentSort?: { field: string; order: 'asc' | 'desc'; type?: 'string' | 'number' | 'date' };
    onSortChange: (field: string, type?: 'string' | 'number' | 'date') => void;
    style?: StyleProp<ViewStyle>;
}

export function SortSelector({ options, currentSort, onSortChange, style }: SortSelectorProps) {
    const { isDark, colors } = useTheme();
    const styles = getStyles(isDark, colors);
    const [modalVisible, setModalVisible] = useState(false);

    const activeOption = options.find(o => o.field === currentSort?.field) || options[0];

    const getSortIcon = () => {
        if (!currentSort || currentSort.order === 'asc') return 'arrow-up';
        return 'arrow-down';
    };

    return (
        <View style={style}>
            <TouchableOpacity 
                style={styles.triggerButton} 
                onPress={() => setModalVisible(true)}
            >
                <Ionicons name="swap-vertical" size={18} color={colors.textSecondary} />
                <Text style={styles.triggerText}>
                    Sort: {activeOption?.label || 'None'}
                </Text>
                {currentSort && (
                    <Ionicons name={getSortIcon()} size={16} color={colors.primary} />
                )}
            </TouchableOpacity>

            <CustomModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                title="Sort By"
            >
                <View style={styles.modalContent}>
                    {options.map((option) => {
                        const isActive = currentSort?.field === option.field;
                        return (
                            <TouchableOpacity
                                key={option.field}
                                style={[styles.optionRow, isActive && styles.optionRowActive]}
                                onPress={() => {
                                    onSortChange(option.field, option.type);
                                    setModalVisible(false);
                                }}
                            >
                                <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>
                                    {option.label}
                                </Text>
                                {isActive && (
                                    <Ionicons 
                                        name={currentSort.order === 'asc' ? 'arrow-up' : 'arrow-down'} 
                                        size={20} 
                                        color={colors.primary} 
                                    />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </CustomModal>
        </View>
    );
}

const getStyles = (isDark: boolean, colors: any) => StyleSheet.create({
    triggerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 6
    },
    triggerText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '500',
    },
    modalContent: {
        paddingTop: 8,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    optionRowActive: {
        backgroundColor: colors.surfaceVariant || colors.border,
    },
    optionLabel: {
        fontSize: 16,
        color: colors.textPrimary,
    },
    optionLabelActive: {
        color: colors.primary,
        fontWeight: '600',
    }
});
