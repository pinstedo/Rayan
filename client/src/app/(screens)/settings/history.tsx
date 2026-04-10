import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../../../context/ThemeContext';
import { useListManager } from '../../../hooks/useListManager';
import { SearchBar, FilterPanel, SortSelector, SortOption, FilterOption } from '../../../components/list';

interface HistoryLog {
  id: number;
  type: 'site' | 'labour' | 'attendance';
  action: string;
  reference_id: number;
  name: string;
  metadata: string; // JSON string
  created_by: number;
  created_by_name: string;
  created_at: string;
}

const sortOptions: SortOption[] = [
  { label: 'Date', field: 'created_at', type: 'date' },
  { label: 'Name', field: 'name', type: 'string' }
];

const filterOptions: FilterOption[] = [
  {
    label: 'Type',
    field: 'type',
    type: 'select',
    options: [
      { label: 'Site', value: 'site' },
      { label: 'Labour', value: 'labour' },
      { label: 'Attendance', value: 'attendance' }
    ]
  }
];

export default function HistoryScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const styles = getStyles(isDark);

  const listManager = useListManager<HistoryLog>({
    backendMode: true,
    endpoint: '/history',
    initialConfig: {
      search: { text: '', fields: ['name'] },
      sort: [{ field: 'created_at', order: 'desc', type: 'date' }]
    }
  });

  const handleRefresh = useCallback(() => {
    // A trick to trigger a fetch by swapping and restoring a non-consequential config if needed, 
    // or we can rely on our listManager to expose a refetch but we haven't implemented refetch natively.
    // Changing limit and setting it back is a dirty trick, but since backendMode fetches on any config change:
    listManager.setConfig(prev => ({ ...prev }));
  }, [listManager]);

  // Icon picking utility
  const getIconForAction = (type: string, action: string) => {
    if (action === 'created') return 'add-circle';
    if (action === 'updated') return 'edit';
    if (action === 'assigned') return 'assignment-ind';
    if (action === 'status_changed') return 'swap-horiz';
    if (action === 'marked') return 'fact-check';
    if (action === 'progress_updated') return 'trending-up';
    if (type === 'site') return 'domain';
    if (type === 'labour') return 'engineering';
    if (type === 'attendance') return 'how-to-reg';
    return 'history';
  };

  const formatActionName = (action: string) => {
    return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const renderItem = ({ item }: { item: HistoryLog }) => {
    const icon = getIconForAction(item.type, item.action);
    const actionFormatted = formatActionName(item.action);
    const dateStr = new Date(item.created_at).toLocaleString();
    
    let metaSnippet = '';
    try {
      const meta = JSON.parse(item.metadata);
      if (item.type === 'site' && meta.status) metaSnippet = `Status: ${meta.status}`;
      else if (item.type === 'site' && item.action === 'progress_updated') metaSnippet = `Progress: ${meta.progress}%`;
      else if (item.type === 'labour' && meta.status) metaSnippet = `Status: ${meta.status}`;
      else if (item.type === 'attendance' && meta.records_count) metaSnippet = `${meta.records_count} records marked`;
      else metaSnippet = item.metadata ? 'Details updated' : '';
    } catch {
      // ignore parse error implicitly
    }

    return (
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <MaterialIcons name={icon as any} size={24} color={isDark ? '#818CF8' : '#4F46E5'} />
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.logTitle}>
            {item.type.charAt(0).toUpperCase() + item.type.slice(1)} {actionFormatted}
          </Text>
          <Text style={styles.logName}>{item.name || `ID #${item.reference_id}`}</Text>
          {metaSnippet ? <Text style={styles.metaText}>{metaSnippet}</Text> : null}
          
          <View style={styles.footerContainer}>
            <Text style={styles.dateText}>{dateStr}</Text>
            {item.created_by_name ? (
              <Text style={styles.authorText}>by {item.created_by_name}</Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={isDark ? "#F1F5F9" : "#0F172A"} />
        </Pressable>
        <Text style={styles.title}>System History</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.controlsRow}>
        <SearchBar 
          value={listManager.searchText}
          onChangeText={listManager.setSearchText}
          placeholder="Search logs by name..."
          style={styles.searchBar}
        />
        <View style={styles.actionRow}>
          <FilterPanel 
            availableFilters={filterOptions}
            activeFilters={listManager.config.filters || []}
            onApplyFilter={listManager.addFilter}
            onRemoveFilter={listManager.removeFilter}
          />
          <SortSelector 
            options={sortOptions}
            currentSort={listManager.config.sort?.[0]}
            onSortChange={listManager.toggleSort}
          />
        </View>
      </View>

      {listManager.loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : listManager.data.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="history" size={64} color={isDark ? "#334155" : "#E2E8F0"} />
          <Text style={styles.emptyTitle}>No history found</Text>
          <Text style={styles.emptyDesc}>Try adjusting your filters or search.</Text>
        </View>
      ) : (
        <FlatList
          data={listManager.data}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          onRefresh={handleRefresh}
          refreshing={listManager.loading}
        />
      )}
    </View>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: isDark ? "#334155" : "#E2E8F0",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: isDark ? "#F1F5F9" : "#0F172A",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? "#334155" : "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  controlsRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchBar: {
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    flexDirection: "row",
    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.2 : 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: isDark ? "rgba(99, 102, 241, 0.15)" : "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  infoContainer: {
    flex: 1,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: isDark ? "#F1F5F9" : "#0F172A",
    marginBottom: 2,
  },
  logName: {
    fontSize: 14,
    color: isDark ? "#CBD5E1" : "#475569",
    marginBottom: 4,
  },
  metaText: {
    fontSize: 13,
    color: isDark ? "#94A3B8" : "#64748B",
    marginBottom: 8,
    backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    color: isDark ? "#64748B" : "#94A3B8",
  },
  authorText: {
    fontSize: 12,
    color: isDark ? "#64748B" : "#94A3B8",
    fontStyle: "italic",
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: isDark ? '#F1F5F9' : '#0F172A',
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 14,
    color: isDark ? '#94A3B8' : '#64748B',
    marginTop: 8,
  },
  endListText: {
    textAlign: "center",
    marginTop: 20,
    color: isDark ? "#64748B" : "#94A3B8",
    fontSize: 14,
  }
});
