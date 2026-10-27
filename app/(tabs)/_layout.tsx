import { Tabs } from "expo-router";
import { Text } from "react-native";

function Icon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 22 }}>{emoji}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4CAF50",
        tabBarInactiveTintColor: "#666",
        tabBarStyle: {
          backgroundColor: "#111",
          borderTopColor: "#222",
          paddingBottom: 16,
          paddingTop: 8,
          height: 100,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerStyle: { backgroundColor: "#111" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold", fontSize: 18 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Icon emoji="🏠" />,
          headerTitle: "🤖 AI Assistant",
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: "Reminders",
          tabBarIcon: () => <Icon emoji="🔔" />,
          headerTitle: "🔔 Reminders",
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: "Contacts",
          tabBarIcon: () => <Icon emoji="👥" />,
          headerTitle: "👥 Contacts",
        }}
      />
      <Tabs.Screen
        name="broadcast"
        options={{
          title: "Broadcast",
          tabBarIcon: () => <Icon emoji="📢" />,
          headerTitle: "📢 Broadcast",
        }}
      />
    </Tabs>
  );
}
