import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as React from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from "../context/ThemeContext";

export type ModalType = 'default' | 'success' | 'date' | 'error' | 'confirmation' | 'warning';

interface ModalAction {
    text: string;
    onPress: () => void;
    style?: 'cancel' | 'destructive' | 'default';
}

interface CustomModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
    children?: React.ReactNode;
    type?: ModalType;
    actions?: ModalAction[];
}

export const CustomModal: React.FC<CustomModalProps> = ({
    visible,
    onClose,
    title,
    message,
    children,
    type = 'default',
    actions = [],
}) => {
    const { isDark, colors } = useTheme();
    const styles = getStyles(isDark, colors);

    const getIconName = () => {
        switch (type) {
            case 'success': return 'check-circle';
            case 'error': return 'error';
            case 'warning': return 'warning';
            case 'confirmation': return 'help';
            case 'date': return 'calendar-today';
            default: return null;
        }
    };

    const getIconColor = () => {
        switch (type) {
            case 'success': return colors.success;
            case 'error': return colors.error;
            case 'warning': return colors.warning;
            case 'confirmation': return colors.primary;
            case 'date': return colors.primary;
            default: return colors.textPrimary;
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                enabled={Platform.OS !== "web"}
            >
                <TouchableOpacity
                    style={styles.overlay}
                    activeOpacity={1}
                    onPress={onClose}
                >
                    <View 
                        style={styles.content} 
                        onStartShouldSetResponder={() => true}
                        // @ts-ignore
                        onClick={(e: any) => {
                            if (e && e.stopPropagation) {
                                e.stopPropagation();
                            }
                        }}
                    >
                        {type !== 'default' && (
                            <View style={styles.iconContainer}>
                                <MaterialIcons name={getIconName() as any} size={48} color={getIconColor()} />
                            </View>
                        )}

                        {title && <Text style={styles.title}>{title}</Text>}
                        {message && <Text style={styles.message}>{message}</Text>}

                        {children}

                        {actions.length > 0 && (
                            <View style={styles.actionsContainer}>
                                {actions.map((action, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.button,
                                            action.style === 'cancel' && styles.cancelButton,
                                            action.style === 'destructive' && styles.destructiveButton,
                                            action.style === 'default' && styles.defaultButton,
                                            index > 0 && { marginLeft: 10 }
                                        ]}
                                        onPress={action.onPress}
                                    >
                                        <Text
                                            style={[
                                                styles.buttonText,
                                                action.style === 'cancel' && styles.cancelButtonText,
                                                action.style === 'destructive' && styles.destructiveButtonText,
                                                action.style === 'default' && styles.defaultButtonText,
                                            ]}
                                        >
                                            {action.text}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                    </View>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const getStyles = (isDark: boolean, colors: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 10,
    },
    iconContainer: {
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: colors.textSecondary,
        marginBottom: 24,
        textAlign: 'center',
        lineHeight: 22,
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        width: '100%',
        marginTop: 16,
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    defaultButton: {
        backgroundColor: colors.primary,
    },
    destructiveButton: {
        backgroundColor: colors.error,
    },
    cancelButton: {
        backgroundColor: colors.secondary,
        borderWidth: 1,
        borderColor: colors.border,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    defaultButtonText: {
        color: 'white',
    },
    destructiveButtonText: {
        color: 'white',
    },
    cancelButtonText: {
        color: colors.textPrimary,
    },
});
