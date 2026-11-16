/**
 * Formats a Date object as 'YYYY-MM-DD' in local timezone,
 * avoiding timezone offset shifts caused by .toISOString().
 */
export const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
