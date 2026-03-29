import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

interface CalendarProps {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
    markedDates: string[]; // Array of YYYY-MM-DD strings
    onMonthChange: (month: number, year: number) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export const Calendar: React.FC<CalendarProps> = ({ selectedDate, onDateSelect, markedDates, onMonthChange }) => {
    const { isDark } = useTheme();
    const styles = getStyles(isDark);
    const [currentDate, setCurrentDate] = useState(new Date(selectedDate));

    useEffect(() => {
        onMonthChange(currentDate.getMonth() + 1, currentDate.getFullYear());
    }, [currentDate.getMonth(), currentDate.getFullYear()]);

    const getDaysInMonth = (month: number, year: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (month: number, year: number) => {
        return new Date(year, month, 1).getDay();
    };

    const handlePrevMonth = () => {
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        setCurrentDate(newDate);
    };

    const handleNextMonth = () => {
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        setCurrentDate(newDate);
    };

    const handleDayPress = (day: number) => {
        const newSelectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        // Adjust for timezone offset if necessary to ensure correct date string
        // But for UI selection, local time is usually expected.
        // We'll pass the date object directly.

        // Ensure we don't select future dates? Requirement didn't strictly say, but usually attendance is past/present.
        // Let's allow selecting any date for now, logic can be handled by parent.
        onDateSelect(newSelectedDate);
    };

    const renderDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(month, year);
        const firstDay = getFirstDayOfMonth(month, year);

        const days = [];

        // Empty slots for days before the 1st
        for (let i = 0; i < firstDay; i++) {
            days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
        }

        const today = new Date();
        const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected =
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year;

            const isMarked = markedDates.includes(dateStr);
            const isToday = isCurrentMonth && today.getDate() === day;

            // Check if past date and NOT marked
            const dayDate = new Date(year, month, day);
            // Reset time part for accurate comparison
            const todayReset = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const isPast = dayDate < todayReset;
            const isFuture = dayDate > todayReset;
            const isUnmarkedPast = isPast && !isMarked;

            let dayStyle = styles.dayCell;
            let textStyle = styles.dayText;
            let bgStyle = {};

            if (isSelected) {
                // If selected, give it a border or different highlight
                // But we also want to show status
            }

            if (isFuture) {
                textStyle = { ...textStyle, color: isDark ? "#555" : "#ccc" };
            } else if (isMarked) {
                bgStyle = { backgroundColor: isDark ? "#1b4323" : "#d4edda" }; // Light green
                textStyle = { ...textStyle, color: isDark ? "#4caf50" : "#155724" };
            } else if (isUnmarkedPast) {
                bgStyle = { backgroundColor: isDark ? "#4a1c1f" : "#f8d7da" }; // Light red
                textStyle = { ...textStyle, color: isDark ? "#ef5350" : "#721c24" };
            }

            days.push(
                <Pressable
                    key={day}
                    style={[
                        styles.dayCell,
                        bgStyle,
                        isSelected && styles.selectedDay
                    ]}
                    onPress={() => !isFuture && handleDayPress(day)}
                    disabled={isFuture}
                >
                    <Text style={[
                        textStyle,
                        isToday && styles.todayText,
                        isSelected && styles.selectedDayText
                    ]}>
                        {day}
                    </Text>
                    {/* Optional: Add status dot */}
                </Pressable>
            );
        }

        return days;
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={handlePrevMonth} style={styles.arrowBtn}>
                    <MaterialIcons name="chevron-left" size={24} color={isDark ? "#fff" : "#333"} />
                </Pressable>
                <Text style={styles.monthText}>
                    {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                </Text>
                <Pressable onPress={handleNextMonth} style={styles.arrowBtn}>
                    <MaterialIcons name="chevron-right" size={24} color={isDark ? "#fff" : "#333"} />
                </Pressable>
            </View>

            <View style={styles.weekDays}>
                {DAYS.map(day => (
                    <Text key={day} style={styles.weekDayText}>{day}</Text>
                ))}
            </View>

            <View style={styles.daysGrid}>
                {renderDays()}
            </View>
        </View>
    );
};

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: {
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
        backgroundColor: isDark ? "#1e1e1e" : '#fff',
        borderRadius: 12,
        padding: 10,
        marginBottom: 16,
        elevation: 1,
        borderWidth: 1,
        borderColor: isDark ? "#333" : '#eee',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    monthText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: isDark ? "#fff" : '#333',
    },
    arrowBtn: {
        padding: 5,
    },
    weekDays: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    weekDayText: {
        fontSize: 12,
        fontWeight: '600',
        color: isDark ? "#aaa" : '#999',
        width: '14.28%',
        textAlign: 'center',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20, // Circular or rounded square
        marginBottom: 2,
    },
    dayText: {
        fontSize: 14,
        color: isDark ? "#fff" : '#333',
    },
    selectedDay: {
        borderWidth: 2,
        borderColor: isDark ? "#4da6ff" : '#0a84ff',
    },
    selectedDayText: {
        fontWeight: 'bold',
    },
    todayText: {
        fontWeight: 'bold',
        color: isDark ? "#4da6ff" : '#0a84ff', // Or make today have a specific indicator
    }
});
