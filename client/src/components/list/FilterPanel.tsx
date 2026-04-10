import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { CustomModal } from '../CustomModal';
import { ListFilterConfig } from '../../utils/listProcessor';

export interface FilterOption {
    label: string;
    field: string;
    type: 'select' | 'boolean' | 'status';
    options?: { label: string; value: any }[]; // Used for 'select' or 'status'
}

interface FilterPanelProps {
    availableFilters: FilterOption[];
    activeFilters: ListFilterConfig[];
    onApplyFilter: (filter: ListFilterConfig) => void;
    onRemoveFilter: (field: string) => void;
}

export function FilterPanel({ availableFilters, activeFilters, onApplyFilter, onRemoveFilter }: FilterPanelProps) {
    const { isDark, colors } = useTheme();
    const styles = getStyles(isDark, colors);
    const [modalVisible, setModalVisible] = useState(false);

    const activeCount = activeFilters.length;

    const handleToggleFilter = (field: string, value: any, operator: any = '=') => {
        const existing = activeFilters.find(f => f.field === field);
        if (existing && existing.value === value) {
            onRemoveFilter(field);
        } else {
            onApplyFilter({ field, value, operator });
        }
    };

    return (
        <View>
            <TouchableOpacity 
                style={[styles.triggerButton, activeCount > 0 && styles.triggerButtonActive]} 
                onPress={() => setModalVisible(true)}
            >
                <Ionicons 
                    name="filter" 
                    size={18} 
                    color={activeCount > 0 ? colors.primary : colors.textSecondary} 
                />
                <Text style={[styles.triggerText, activeCount > 0 && styles.triggerTextActive]}>
                    Filters {activeCount > 0 ? `(${activeCount})` : ''}
                </Text>
            </TouchableOpacity>

            <CustomModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                title="Filters"
            >
                <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                    {availableFilters.map((filter) => {
                        const activeFilterConfig = activeFilters.find(f => f.field === filter.field);

                        return (
                            <View key={filter.field} style={styles.filterSection}>
                                <Text style={styles.filterTitle}>{filter.label}</Text>
                                
                                {filter.options && (
                                    <View style={styles.chipsContainer}>
                                        {filter.options.map(opt => {
                                            const isSelected = activeFilterConfig?.value === opt.value;
                                            return (
                                                <TouchableOpacity
                                                    key={opt.value}
                                                    style={[styles.chip, isSelected && styles.chipSelected]}
                                                    onPress={() => handleToggleFilter(filter.field, opt.value)}
                                                >
                                                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                                        {opt.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        );
                    })}

                    {activeCount > 0 && (
                        <TouchableOpacity 
                            style={styles.clearAllButton}
                            onPress={() => {
                                activeFilters.forEach(f => onRemoveFilter(f.field));
                                setModalVisible(false);
                            }}
                        >
                            <Text style={styles.clearAllText}>Clear All Filters</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
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
    triggerButtonActive: {
        backgroundColor: isDark ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.05)',
        borderColor: colors.primary,
    },
    triggerText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '500',
    },
    triggerTextActive: {
        color: colors.primary,
        fontWeight: '600',
    },
    modalContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
        maxHeight: 400,
    },
    filterSection: {
        marginBottom: 20,
    },
    filterTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 10,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    chipSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    chipText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '500',
    },
    chipTextSelected: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    clearAllButton: {
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    clearAllText: {
        color: colors.danger,
        fontSize: 15,
        fontWeight: '600',
    }
});
