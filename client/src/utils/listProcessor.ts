export interface ListSortConfig {
    field: string;
    order: 'asc' | 'desc';
    type?: 'string' | 'number' | 'date';
}

export interface ListFilterConfig {
    field: string;
    operator?: '=' | '!=' | 'in' | 'not_in' | 'between' | 'contains';
    value: any;
}

export interface ListSearchConfig {
    text: string;
    fields: string[];
}


export interface ListProcessorConfig {
    search?: ListSearchConfig;
    filters?: ListFilterConfig[];
    sort?: ListSortConfig[];

}

export interface ProcessedListResult<T> {
    data: T[];
    totalCount: number;
}

export function processList<T extends Record<string, any>>(data: T[], config: ListProcessorConfig): ProcessedListResult<T> {
    let result = [...data];

    // 1. Apply Search
    if (config.search && config.search.text && config.search.fields && config.search.fields.length > 0) {
        const searchText = config.search.text.toLowerCase();
        result = result.filter(item => {
            return config.search!.fields.some(field => {
                const val = item[field];
                if (val === null || val === undefined) return false;
                return String(val).toLowerCase().includes(searchText);
            });
        });
    }

    // 2. Apply Filters
    if (config.filters && config.filters.length > 0) {
        result = result.filter(item => {
            return config.filters!.every(filter => {
                const itemValue = item[filter.field];
                const filterValue = filter.value;
                const op = filter.operator || '=';

                if (op === '=') return itemValue === filterValue;
                if (op === '!=') return itemValue !== filterValue;
                if (op === 'in') return Array.isArray(filterValue) && filterValue.includes(itemValue);
                if (op === 'not_in') return Array.isArray(filterValue) && !filterValue.includes(itemValue);
                if (op === 'between') return Array.isArray(filterValue) && filterValue.length === 2 && itemValue >= filterValue[0] && itemValue <= filterValue[1];
                if (op === 'contains') return String(itemValue).toLowerCase().includes(String(filterValue).toLowerCase());

                return true;
            });
        });
    }

    // 3. Apply Sorting
    if (config.sort && config.sort.length > 0) {
        result.sort((a, b) => {
            for (const sortConfig of config.sort!) {
                let valA = a[sortConfig.field];
                let valB = b[sortConfig.field];

                const orderMultiplier = sortConfig.order === 'desc' ? -1 : 1;

                if (valA === valB) continue; // move to next sort field

                // Handle null/undefined values by pushing them to the bottom
                if (valA === null || valA === undefined) return 1;
                if (valB === null || valB === undefined) return -1;

                if (sortConfig.type === 'number') {
                    const numA = Number(valA);
                    const numB = Number(valB);
                    if (numA < numB) return -1 * orderMultiplier;
                    if (numA > numB) return 1 * orderMultiplier;
                } else if (sortConfig.type === 'date') {
                    const timeA = new Date(valA).getTime();
                    const timeB = new Date(valB).getTime();
                    if (timeA < timeB) return -1 * orderMultiplier;
                    if (timeA > timeB) return 1 * orderMultiplier;
                } else {
                    // Default string compare
                    const strA = String(valA);
                    const strB = String(valB);
                    const compareResult = strA.localeCompare(strB, undefined, { sensitivity: 'base' });
                    if (compareResult !== 0) {
                        return compareResult * orderMultiplier;
                    }
                }
            }
            return 0; // completely equal
        });
    }

    const totalCount = result.length;


    return {
        data: result,
        totalCount
    };
}
