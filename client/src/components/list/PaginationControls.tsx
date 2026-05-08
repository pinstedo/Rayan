import { Ionicons } from '@expo/vector-icons';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface PaginationControlsProps {
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    onNext: () => void;
    onPrev: () => void;
    totalCount?: number;
    style?: StyleProp<ViewStyle>;
}

export function PaginationControls({
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    onNext,
    onPrev,
    totalCount,
    style
}: PaginationControlsProps) {
    const { isDark, colors } = useTheme();
    const styles = getStyles(isDark, colors);

    if (totalPages <= 1 && !totalCount) return null;

    return (
        <View style={[styles.container, style]}>
            {totalCount !== undefined && (
                <Text style={styles.summaryText}>
                    Showing {totalCount} result{totalCount !== 1 ? 's' : ''}
                </Text>
            )}

            {totalPages > 1 && (
                <View style={styles.controls}>
                    <TouchableOpacity
                        style={[styles.button, !hasPrevPage && styles.buttonDisabled]}
                        onPress={onPrev}
                        disabled={!hasPrevPage}
                    >
                        <Ionicons name="chevron-back" size={16} color={!hasPrevPage ? colors.textSecondary : colors.textPrimary} />
                        <Text style={[styles.buttonText, !hasPrevPage && styles.textDisabled]}>Prev</Text>
                    </TouchableOpacity>

                    <Text style={styles.pageText}>
                        Page {currentPage} of {totalPages}
                    </Text>

                    <TouchableOpacity
                        style={[styles.button, !hasNextPage && styles.buttonDisabled]}
                        onPress={onNext}
                        disabled={!hasNextPage}
                    >
                        <Text style={[styles.buttonText, !hasNextPage && styles.textDisabled]}>Next</Text>
                        <Ionicons name="chevron-forward" size={16} color={!hasNextPage ? colors.textSecondary : colors.textPrimary} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const getStyles = (isDark: boolean, colors: any) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    summaryText: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: colors.surface,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 4,
    },
    buttonDisabled: {
        backgroundColor: isDark ? colors.surface : '#f5f5f5',
        borderColor: colors.border,
        opacity: 0.5,
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textPrimary,
    },
    textDisabled: {
        color: colors.textSecondary,
    },
    pageText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textSecondary,
    }
});
