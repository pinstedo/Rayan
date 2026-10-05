import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppRefreshControl } from '../../../components/RefreshFeedback';
import { API_URL } from '../../../constants';
import { useTheme } from '../../../context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';

interface DeviceItem {
  id: number;
  deviceName: string;
  userAgent: string;
  ipAddress: string;
  createdAt: string;
  lastActiveAt: string;
  isPrimary: boolean;
  isCurrentDevice: boolean;
}

export default function LoginDevicesScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const styles = getStyles(isDark);

  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [isCurrentDevicePrimary, setIsCurrentDevicePrimary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);

  const fetchDevices = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        router.replace('/auth/authentication');
        return;
      }

      const res = await fetch(`${API_URL}/auth/devices`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
        setIsCurrentDevicePrimary(!!data.isCurrentDevicePrimary);
      } else if (res.status === 401) {
        const errData = await res.json();
        Alert.alert('Session Expired', errData.error || 'Your session has ended.');
        await AsyncStorage.clear();
        router.replace('/auth/authentication');
      } else {
        const errData = await res.json();
        Alert.alert('Error', errData.error || 'Failed to fetch active devices.');
      }
    } catch (error) {
      console.error('Fetch devices error:', error);
      Alert.alert('Error', 'Unable to connect to server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      fetchDevices();
    }, [fetchDevices])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDevices(true);
  };

  const handleRemoveDevice = (device: DeviceItem) => {
    if (!isCurrentDevicePrimary && !device.isCurrentDevice) {
      Alert.alert('Access Restricted', 'Only the first logged-in (Primary) device can remove other active devices.');
      return;
    }

    Alert.alert(
      'Remove Device',
      `Are you sure you want to log out "${device.deviceName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(device.id);
              const token = await AsyncStorage.getItem('token');
              const res = await fetch(`${API_URL}/auth/devices/${device.id}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              const data = await res.json();
              if (res.ok) {
                Alert.alert('Success', data.message || 'Device session removed.');
                if (device.isCurrentDevice) {
                  await AsyncStorage.clear();
                  router.replace('/auth/authentication');
                } else {
                  fetchDevices(true);
                }
              } else {
                Alert.alert('Error', data.error || 'Failed to remove device.');
              }
            } catch (error) {
              Alert.alert('Error', 'Unable to connect to server.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleLogoutAllOthers = () => {
    if (!isCurrentDevicePrimary) {
      Alert.alert('Access Restricted', 'Only the first logged-in (Primary) device can log out all other devices.');
      return;
    }

    const secondaryCount = devices.filter((d) => !d.isCurrentDevice).length;
    if (secondaryCount === 0) {
      Alert.alert('No Other Devices', 'There are no other active devices to log out.');
      return;
    }

    Alert.alert(
      'Log Out All Other Devices',
      `Are you sure you want to log out ${secondaryCount} other active device(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out All Others',
          style: 'destructive',
          onPress: async () => {
            try {
              setLogoutAllLoading(true);
              const token = await AsyncStorage.getItem('token');
              const res = await fetch(`${API_URL}/auth/devices/logout-all-others`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              const data = await res.json();
              if (res.ok) {
                Alert.alert('Success', data.message || 'All other devices logged out.');
                fetchDevices(true);
              } else {
                Alert.alert('Error', data.error || 'Failed to log out all other devices.');
              }
            } catch (error) {
              Alert.alert('Error', 'Unable to connect to server.');
            } finally {
              setLogoutAllLoading(false);
            }
          },
        },
      ]
    );
  };

  const getDeviceIcon = (deviceName: string) => {
    const name = deviceName.toLowerCase();
    if (name.includes('iphone') || name.includes('android phone') || name.includes('phone')) {
      return 'smartphone';
    }
    if (name.includes('ipad') || name.includes('tablet')) {
      return 'tablet-mac';
    }
    if (name.includes('windows') || name.includes('pc') || name.includes('mac') || name.includes('computer')) {
      return 'desktop-windows';
    }
    return 'devices';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const renderHeader = () => (
    <View style={styles.headerCard}>
      <View style={styles.headerStatusRow}>
        <MaterialIcons
          name={isCurrentDevicePrimary ? 'workspace-premium' : 'devices-other'}
          size={28}
          color={isCurrentDevicePrimary ? '#F59E0B' : '#3B82F6'}
        />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerStatusTitle}>
            {isCurrentDevicePrimary ? 'Primary Control Device' : 'Secondary Login Session'}
          </Text>
          <Text style={styles.headerStatusDesc}>
            {isCurrentDevicePrimary
              ? 'This is the first logged-in device. You have full authority to manage or log out any active devices.'
              : 'Logged in as a secondary device. Device removal controls are managed by the Primary (first logged-in) device.'}
          </Text>
        </View>
      </View>

      {isCurrentDevicePrimary && devices.length > 1 && (
        <Pressable
          style={[styles.logoutAllBtn, logoutAllLoading && { opacity: 0.6 }]}
          onPress={handleLogoutAllOthers}
          disabled={logoutAllLoading}
        >
          {logoutAllLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="phonelink-erase" size={20} color="#FFFFFF" />
              <Text style={styles.logoutAllBtnText}>Log Out All Other Devices</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );

  const renderDeviceItem = ({ item }: { item: DeviceItem }) => {
    const isDeleting = actionLoading === item.id;
    const canDelete = isCurrentDevicePrimary && !item.isCurrentDevice;

    return (
      <View style={[styles.deviceCard, item.isCurrentDevice && styles.currentDeviceCard]}>
        <View style={styles.deviceRow}>
          <View style={[styles.deviceIconBg, item.isPrimary ? styles.primaryIconBg : null]}>
            <MaterialIcons
              name={getDeviceIcon(item.deviceName)}
              size={24}
              color={item.isPrimary ? '#F59E0B' : '#3B82F6'}
            />
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text style={styles.deviceNameText}>{item.deviceName}</Text>
              {item.isPrimary && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>First Logged-In</Text>
                </View>
              )}
              {item.isCurrentDevice && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>This Device</Text>
                </View>
              )}
            </View>

            <Text style={styles.deviceMetaText}>
              IP: {item.ipAddress || 'Unknown IP'}
            </Text>
            <Text style={styles.deviceMetaText}>
              Logged in: {formatDate(item.createdAt)}
            </Text>
            <Text style={styles.deviceMetaText}>
              Last active: {formatDate(item.lastActiveAt)}
            </Text>
          </View>
        </View>

        {canDelete && (
          <Pressable
            style={[styles.removeBtn, isDeleting && { opacity: 0.5 }]}
            onPress={() => handleRemoveDevice(item)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <>
                <MaterialIcons name="exit-to-app" size={18} color="#EF4444" />
                <Text style={styles.removeBtnText}>Remove Device</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topNav}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={isDark ? '#F1F5F9' : '#0F172A'} />
        </Pressable>
        <Text style={styles.navTitle}>Login Devices & Security</Text>
      </View>

      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading login devices...</Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={renderHeader}
          renderItem={renderDeviceItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="devices-other" size={48} color={isDark ? '#64748B' : '#94A3B8'} />
              <Text style={styles.emptyText}>No active devices found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function getStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
    },
    topNav: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 54,
      paddingBottom: 16,
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#334155' : '#E2E8F0',
    },
    backBtn: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: isDark ? '#334155' : '#F1F5F9',
      marginRight: 12,
    },
    navTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? '#F1F5F9' : '#0F172A',
    },
    listContent: {
      padding: 16,
      paddingBottom: 40,
    },
    headerCard: {
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#E2E8F0',
    },
    headerStatusRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    headerStatusTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#F8FAFC' : '#0F172A',
      marginBottom: 4,
    },
    headerStatusDesc: {
      fontSize: 13,
      lineHeight: 18,
      color: isDark ? '#94A3B8' : '#64748B',
    },
    logoutAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#EF4444',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginTop: 16,
      gap: 8,
    },
    logoutAllBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    deviceCard: {
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#E2E8F0',
    },
    currentDeviceCard: {
      borderColor: '#3B82F6',
      borderWidth: 1.5,
    },
    deviceRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    deviceIconBg: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: isDark ? '#0F172A' : '#EFF6FF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    primaryIconBg: {
      backgroundColor: isDark ? '#2D2006' : '#FEF3C7',
    },
    deviceNameText: {
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    primaryBadge: {
      backgroundColor: isDark ? '#78350F' : '#FEF3C7',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    primaryBadgeText: {
      color: isDark ? '#FDE68A' : '#D97706',
      fontSize: 11,
      fontWeight: '700',
    },
    currentBadge: {
      backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    currentBadgeText: {
      color: isDark ? '#93C5FD' : '#2563EB',
      fontSize: 11,
      fontWeight: '700',
    },
    deviceMetaText: {
      fontSize: 12,
      color: isDark ? '#94A3B8' : '#64748B',
      marginTop: 2,
    },
    removeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#334155' : '#F1F5F9',
      gap: 6,
    },
    removeBtnText: {
      color: '#EF4444',
      fontSize: 13,
      fontWeight: '600',
    },
    loaderCenter: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      color: isDark ? '#94A3B8' : '#64748B',
      fontSize: 14,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    emptyText: {
      marginTop: 12,
      color: isDark ? '#94A3B8' : '#64748B',
      fontSize: 15,
    },
  });
}
