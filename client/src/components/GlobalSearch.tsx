import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

export default function GlobalSearch() {
    const { isDark, colors } = useTheme();
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(async () => {
            try {
                const res = await api.post(`/search`, { q: query });
                if (res.ok) {
                    const data = await res.json();
                    setResults(data);
                }
            } catch (error) {
                console.error("Search error", error);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    const handleResultPress = (item: any) => {
        setShowResults(false);
        setQuery('');

        switch (item.type) {
            case 'labour':
                router.push(`/(screens)/labour-details?id=${item.id}`);
                break;
            case 'site':
                router.push(`/(screens)/site-details?id=${item.id}`);
                break;
            case 'user':
                router.push(`/(screens)/supervisor-details?id=${item.id}`);
                break;
        }
    };

    const styles = getStyles(isDark, colors);

    return (
        <View style={styles.container}>
            <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.icon} />
                <TextInput
                    style={styles.input}
                    placeholder="Search labours, sites, supervisors..."
                    placeholderTextColor={colors.textSecondary}
                    value={query}
                    onChangeText={(t) => {
                        setQuery(t);
                        setShowResults(true);
                    }}
                    onFocus={() => setShowResults(true)}
                    clearButtonMode="while-editing"
                />
                {loading && <ActivityIndicator size="small" color={colors.primary} />}
                {query.length > 0 && !loading && (
                    <TouchableOpacity onPress={() => { setQuery(''); setShowResults(false); }}>
                        <Ionicons name="close-circle" size={20} color={colors.textSecondary} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                )}
            </View>

            {showResults && query.trim().length > 0 && (
                <View style={styles.dropdown}>
                    {loading && results.length === 0 ? (
                        <View style={styles.centerItem}>
                            <Text style={styles.emptyText}>Searching...</Text>
                        </View>
                    ) : results.length === 0 ? (
                        <View style={styles.centerItem}>
                            <Text style={styles.emptyText}>No results found for "{query}"</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={results}
                            keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
                            keyboardShouldPersistTaps="handled"
                            style={{ maxHeight: 300 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.resultItem} onPress={() => handleResultPress(item)}>
                                    <View style={styles.resultIcon}>
                                        {item.profile_image ? (
                                            <Image source={{ uri: item.profile_image }} style={styles.image} />
                                        ) : (
                                            <Ionicons
                                                name={item.type === 'site' ? 'business' : item.type === 'user' ? 'person-circle' : 'person'}
                                                size={20}
                                                color={colors.primary}
                                            />
                                        )}
                                    </View>
                                    <View style={styles.resultContent}>
                                        <Text style={styles.resultTitle}>{item.name}</Text>
                                        <Text style={styles.resultSubtitle}>
                                            {item.type === 'labour' ? `Labour • ${item.trade || 'Worker'} • ${item.phone || ''}` :
                                                item.type === 'site' ? `Site • ${item.address || ''}` :
                                                    `Supervisor • ${item.phone || ''}`}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </View>
            )}
        </View>
    );
}

const getStyles = (isDark: boolean, colors: any) => StyleSheet.create({
    container: {
        position: 'relative',
        zIndex: 9999, // Ensure it's higher than cards below
        elevation: 9999,
        marginBottom: 16,
    },
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
    dropdown: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderRadius: 12,
        paddingVertical: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        zIndex: 100,
        borderWidth: 1,
        borderColor: colors.border,
    },
    centerItem: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontStyle: 'italic',
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    resultIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    resultContent: {
        flex: 1,
    },
    resultTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    resultSubtitle: {
        fontSize: 12,
        color: colors.textSecondary,
    },
});
