// listProcessor.js
// Utility to process generic search, filter, sort, and pagination dynamically on a base SQL query.

function buildListQuery(baseQuery, listConfig, initialParams = []) {
    let query = baseQuery;
    let params = [...initialParams];
    let whereConditions = [];

    // Check if baseQuery already has a WHERE clause
    const hasWhere = baseQuery.toUpperCase().includes(' WHERE ');

    if (listConfig.search && listConfig.search.text && listConfig.search.fields && listConfig.search.fields.length > 0) {
        const searchConditions = [];
        const searchText = \`%\${listConfig.search.text}%\`;
        for (const field of listConfig.search.fields) {
            // Using parameterized ILIKE for case-insensitive search
            searchConditions.push(\`\${field} ILIKE ?\`);
            params.push(searchText);
        }
        whereConditions.push(\`(\${searchConditions.join(' OR ')})\`);
    }

    if (listConfig.filters && listConfig.filters.length > 0) {
        for (const filter of listConfig.filters) {
            const { field, operator = '=', value } = filter;
            if (value === undefined || value === null) continue;

            if (operator === 'in' && Array.isArray(value)) {
                const placeholders = value.map(() => '?').join(', ');
                whereConditions.push(\`\${field} IN (\${placeholders})\`);
                params.push(...value);
            } else if (operator === 'between' && Array.isArray(value) && value.length === 2) {
                whereConditions.push(\`\${field} BETWEEN ? AND ?\`);
                params.push(value[0], value[1]);
            } else {
                whereConditions.push(\`\${field} \${operator} ?\`);
                params.push(value);
            }
        }
    }

    if (whereConditions.length > 0) {
        const joinCondition = hasWhere ? ' AND ' : ' WHERE ';
        query += \`\${joinCondition}\${whereConditions.join(' AND ')}\`;
    }

    // Sort processing
    if (listConfig.sort && listConfig.sort.length > 0) {
        const sortClauses = listConfig.sort.map(s => {
            const field = s.field;
            const order = s.order && s.order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            // Simple prevention of SQL injection on ORDER BY clause: regex strictly limits to valid letters/numbers/underscores
            if (!/^[a-zA-Z0-9_]+$/.test(field)) {
                return '';
            }
            return \`\${field} \${order}\`;
        }).filter(Boolean);

        if (sortClauses.length > 0) {
            query += \` ORDER BY \${sortClauses.join(', ')}\`;
        }
    }

    // Pagination processing
    if (listConfig.pagination) {
        const page = parseInt(listConfig.pagination.page, 10) || 1;
        const limit = parseInt(listConfig.pagination.limit, 10) || 20;
        const offset = (page - 1) * limit;

        query += \` LIMIT ? OFFSET ?\`;
        params.push(limit, offset);
    }

    return { query, params };
}

module.exports = {
    buildListQuery
};
