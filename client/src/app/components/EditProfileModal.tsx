import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface EditProfileModalProps {
    visible: boolean;
    onClose: () => void;
    labour: any;
    onSave: (updatedData: any) => Promise<void>;
}

export const EditProfileModal = ({ visible, onClose, labour, onSave }: EditProfileModalProps) => {
    const [image, setImage] = useState<string | null>(null);
    const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [emergencyPhone, setEmergencyPhone] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (labour) {
            setImage(labour.profile_image || null);
            if (labour.date_of_birth) {
                setDateOfBirth(new Date(labour.date_of_birth));
            } else {
                setDateOfBirth(null);
            }
            setEmergencyPhone(labour.emergency_phone || '');
        }
    }, [labour]);

    const pickImage = async () => {
        // No permissions request is necessary for launching the image library
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled) {
            if (result.assets && result.assets[0].base64) {
                setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
            } else if (result.assets && result.assets[0].uri) {
                setImage(result.assets[0].uri);
            }
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await onSave({
                profile_image: image,
                date_of_birth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : null,
                emergency_phone: emergencyPhone
            });
            onClose();
        } catch (error) {
            console.error("Failed to save profile:", error);
            // Parent should handle alert
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <Text style={styles.modalTitle}>Edit Profile</Text>

                    {/* Image Picker */}
                    <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
                        {image ? (
                            <Image source={{ uri: image }} style={styles.profileImage} />
                        ) : (
                            <View style={styles.placeholderImage}>
                                <MaterialIcons name="camera-alt" size={40} color="#ccc" />
                            </View>
                        )}
                        <Text style={styles.changePhotoText}>Change Photo</Text>
                    </TouchableOpacity>

                    {/* Inputs */}
                    <Text style={styles.label}>Date of Birth</Text>
                    <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
                        <Text style={{ color: dateOfBirth ? "#000" : "#999" }}>
                            {dateOfBirth ? formatDate(dateOfBirth) : "Select Date of Birth"}
                        </Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                        <DateTimePicker
                            value={dateOfBirth || new Date()}
                            mode="date"
                            display="default"
                            onChange={(event: any, selectedDate?: Date) => {
                                setShowDatePicker(false);
                                if (selectedDate) setDateOfBirth(selectedDate);
                            }}
                            maximumDate={new Date()}
                        />
                    )}

                    <Text style={styles.label}>Emergency Phone</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Emergency Contact Number"
                        keyboardType="phone-pad"
                        value={emergencyPhone}
                        onChangeText={setEmergencyPhone}
                        maxLength={15}
                    />

                    {/* Actions */}
                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.button, styles.buttonClose]}
                            onPress={onClose}
                            disabled={loading}
                        >
                            <Text style={[styles.textStyle, { color: '#333' }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.buttonSave]}
                            onPress={handleSave}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.textStyle}>Save</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        width: '90%',
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
        alignItems: 'stretch',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    imageContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    placeholderImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    changePhotoText: {
        marginTop: 8,
        color: '#007bff',
        fontSize: 14,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 5,
        marginTop: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 10,
        fontSize: 16,
    },
    dateInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 30,
        gap: 15,
    },
    button: {
        borderRadius: 10,
        padding: 12,
        elevation: 2,
        flex: 1,
        alignItems: 'center',
    },
    buttonClose: {
        backgroundColor: '#e0e0e0',
    },
    buttonSave: {
        backgroundColor: '#007bff',
    },
    textStyle: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
    },
});
