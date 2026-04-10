import React from 'react';
import { View, TextInput, ActivityIndicator, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    loading?: boolean;
    style?: StyleProp<ViewStyle>;
}

export function SearchBar({ value, onChangeText, placeholder = "Search...", loading, style }: SearchBarProps) {
    const { isDark, colors } = useTheme();
    const styles = getStyles(isDark, colors);

    return (
        <View style={[styles.searchBar, style]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.icon} />
            <TextInput
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor={colors.textSecondary}
                value={value}
                onChangeText={onChangeText}
                clearButtonMode="while-editing"
            />
            {loading && <ActivityIndicator size="small" color={colors.primary} />}
            {value.length > 0 && !loading && (
                <TouchableOpacity onPress={() => onChangeText('')}>
                    <Ionicons name="close-circle" size={20} color={colors.textSecondary} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
            )}
        </View>
    );
}

const getStyles = (isDark: boolean, colors: any) => StyleSheet.create({
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: colors.border,
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: colors.textPrimary,
        fontWeight: "500",
    },
});
