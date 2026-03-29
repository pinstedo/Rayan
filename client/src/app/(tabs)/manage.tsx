import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import React, { JSX } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { styles } from "../style/stylesheet1";

const options = [
  { key: "attendance", icon: "check-circle", title: "Attendance", desc: "Record and view attendance" },
  { key: "overtime", icon: "timer", title: "Overtime", desc: "Log overtime hours" },
  { key: "advance", icon: "account-balance-wallet", title: "Advance", desc: "Manage advances" },
  { key: "sites", icon: "location-city", title: "Sites", desc: "Manage job sites" },
  { key: "labours", icon: "group", title: "Labours", desc: "View and manage labours" },
  { key: "supervisors", icon: "supervisor-account", title: "Supervisors", desc: "View supervisors added by admin" },
];

export default function Manage(): JSX.Element {
  const router = useRouter();
  const { isDark } = useTheme();
  const localStyles = getStyles(isDark);

  const onPress = (key: string) => {
    if (key === "labours") {
      router.push("/(screens)/labours");
      return;
    }
    if (key === "attendance") {
      router.push("/(screens)/reports/site-attendance" as any);
      return;
    }
    if (key === "overtime") {
      router.push("/(screens)/overtime");
      return;
    }
    if (key === "supervisors") {
      router.push("/(screens)/supervisors");
      return;
    }
    if (key === "sites") {
      router.push("/(screens)/sites");
      return;
    }
    if (key === "advance") {
      router.push("/(screens)/advance");
      return;
    }
    // navigate to dedicated management screen (ensure routes exist or create them)
    router.push(`/manage/${key}` as any);
  };

  return (
    <View style={[styles.mainContainer, { backgroundColor: isDark ? "#121212" : "#f1f5f9" }]}>
      <View style={localStyles.headerContainer}>
        <Text style={localStyles.headerText}>Manage</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          {options.map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.optionCard, { backgroundColor: isDark ? "#1e1e1e" : "#fff", shadowOpacity: isDark ? 0.3 : 0.05 }]}
              onPress={() => onPress(opt.key)}
              accessibilityRole="button"
              accessibilityLabel={opt.title}
            >
              <View style={[styles.optionIconWrap, { backgroundColor: isDark ? "#2a2a2a" : "#f1f5f9" }]}>
                <MaterialIcons name={opt.icon as any} size={20} color={isDark ? "#4da6ff" : "#0a84ff"} />
              </View>

              <Text style={[styles.optionTitle, { color: isDark ? "#fff" : "#1e293b" }]}>{opt.title}</Text>
              <Text style={[styles.optionDesc, { color: isDark ? "#aaa" : "#64748b" }]}>{opt.desc}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  headerContainer: {
    backgroundColor: isDark ? "#1e1e1e" : "#FFFFFF",
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  headerText: {
    fontSize: 30,
    fontWeight: "800",
    color: isDark ? "#ffffff" : "#0F172A",
  },
});