import { useState, useMemo, useEffect } from 'react';
import { 
    ListProcessorConfig, 
    ListFilterConfig, 
    ListSortConfig, 
    processList 
} from '../utils/listProcessor';
import { api } from '../services/api';

export interface UseListManagerProps<T> {
    initialData?: T[];
    initialConfig?: ListProcessorConfig;
    backendMode?: boolean;
    endpoint?: string;
}

export function useListManager<T extends Record<string, any>>({
    initialData = [],
    initialConfig = {},
    backendMode = false,
    endpoint,
}: UseListManagerProps<T>) {
    const [data, setData] = useState<T[]>(initialData);
    const [config, setConfig] = useState<ListProcessorConfig>(initialConfig);
    const [searchText, setSearchText] = useState(initialConfig.search?.text || '');
    const [loading, setLoading] = useState(false);
    const [backendTotalCount, setBackendTotalCount] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Sync input to config with debounce (to avoid processing on every keystroke)
    useEffect(() => {
        const timer = setTimeout(() => {
            setConfig(prev => ({
                ...prev,
                search: {
                    ...(prev.search || { fields: ['name'] }),
                    text: searchText
                }
            }));
        }, 300);
        return () => clearTimeout(timer);
    }, [searchText]);

    // Backend fetching logic
    useEffect(() => {
        if (backendMode && endpoint) {
            const fetchData = async () => {
                setLoading(true);
                setError(null);
                try {
                    // Send config as JSON string
                    const res = await api.get(`${endpoint}?listConfig=${encodeURIComponent(JSON.stringify(config))}`);
                    if (!res.ok) throw new Error("Failed to fetch list data");
                    const responseData = await res.json();
                    
                    if (responseData.data && responseData.totalCount !== undefined) {
                        setData(responseData.data);
                        setBackendTotalCount(responseData.totalCount);
                    } else if (Array.isArray(responseData)) {
                        // fallback if endpoint doesn't return paginated structure yet
                        setData(responseData);
                        setBackendTotalCount(responseData.length);
                    }
                } catch (err: any) {
                    setError(err.message || "An error occurred");
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        }
    }, [backendMode, endpoint, config]); // trigger fetch when config changes

    // Update internal data when initialData prop changes in client mode
    useEffect(() => {
        if (!backendMode) {
            setData(initialData);
        }
    }, [initialData, backendMode]);

    // Processed List (Memoized for client mode)
    const processedList = useMemo(() => {
        if (backendMode) {
            return {
                data,
                totalCount: backendTotalCount,
            };
        }
        return processList(data, config);
    }, [data, config, backendMode, backendTotalCount]);

    // Helpers to modify config securely
    const setFilters = (filters: ListFilterConfig[]) => {
        setConfig(prev => ({ ...prev, filters }));
    };

    const addFilter = (filter: ListFilterConfig) => {
        setConfig(prev => {
            const newFilters = prev.filters ? [...prev.filters] : [];
            const index = newFilters.findIndex(f => f.field === filter.field);
            if (index >= 0) newFilters[index] = filter;
            else newFilters.push(filter);
            return { ...prev, filters: newFilters };
        });
    };

    const removeFilter = (field: string) => {
        setConfig(prev => ({
            ...prev,
            filters: prev.filters?.filter(f => f.field !== field) || []
        }));
    };

    const setSort = (sort: ListSortConfig[]) => {
        setConfig(prev => ({ ...prev, sort }));
    };

    const toggleSort = (field: string, type: 'string' | 'number' | 'date' = 'string') => {
        setConfig(prev => {
            const currentSort = prev.sort?.[0]; // Support single priority sort for simple toggle
            if (currentSort?.field === field) {
                // reverse or remove
                if (currentSort.order === 'asc') {
                    return { ...prev, sort: [{ field, order: 'desc', type }] };
                } else {
                    return { ...prev, sort: undefined };
                }
            } else {
                return { ...prev, sort: [{ field, order: 'asc', type }] };
            }
        });
    }


    return {
        // Output
        data: processedList.data,
        totalCount: processedList.totalCount,
        loading,
        error,

        // State & Config access
        searchText,
        setSearchText,
        config,
        setConfig, // For full manual replace if needed
        

        // Action Helpers
        setFilters,
        addFilter,
        removeFilter,
        setSort,
        toggleSort,
    };
}
