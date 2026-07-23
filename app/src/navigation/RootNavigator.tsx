import React from "react";
import { Platform, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActiveCallScreen } from "../screens/ActiveCallScreen";
import { IncomingCallScreen } from "../screens/IncomingCallScreen";
import { OutgoingCallScreen } from "../screens/OutgoingCallScreen";
import { AppealsScreen } from "../screens/AppealsScreen";
import { AddMoneyScreen } from "../screens/AddMoneyScreen";
import { AdminScreen } from "../screens/AdminScreen";
import { CallsScreen } from "../screens/CallsScreen";
import { ChatScreen } from "../screens/ChatScreen";
import { ConnectionsScreen } from "../screens/ConnectionsScreen";
import { ConversationsScreen } from "../screens/ConversationsScreen";
import { EditProfileScreen } from "../screens/EditProfileScreen";
import { EarningsScreen } from "../screens/EarningsScreen";
import { GiftCardsScreen } from "../screens/GiftCardsScreen";
import { GoLiveScreen } from "../screens/GoLiveScreen";
import { DigitalGiftsScreen } from "../screens/DigitalGiftsScreen";
import { DiscoverScreen } from "../screens/DiscoverScreen";
import { LegalScreen } from "../screens/LegalScreen";
import { LiveViewScreen } from "../screens/LiveViewScreen";
import { MembershipsScreen } from "../screens/MembershipsScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { PackagesScreen } from "../screens/PackagesScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ReferralsScreen } from "../screens/ReferralsScreen";
import { ReviewScreen } from "../screens/ReviewScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { SecurityActivityScreen } from "../screens/SecurityActivityScreen";
import { SendGiftScreen } from "../screens/SendGiftScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { SupportScreen } from "../screens/SupportScreen";
import { TaskCenterScreen } from "../screens/TaskCenterScreen";
import { LeaderboardScreen } from "../screens/LeaderboardScreen";
import { BeautyScreen } from "../screens/BeautyScreen";
import { VendorDashboardScreen } from "../screens/VendorDashboardScreen";
import { VendorScreen } from "../screens/VendorScreen";
import { WalletScreen } from "../screens/WalletScreen";
import { colors, radius, shadow } from "../theme";

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const icons: Record<string, string> = {
  Discover: "♡",
  Messages: "✉",
  Calls: "◉",
  Wallet: "◆",
  Profile: "●",
};

function TabIcon({
  name,
  color,
  focused,
}: {
  name: string;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      {focused ? (
        <View
          style={{
            position: "absolute",
            top: -6,
            width: 28,
            height: 3,
            borderRadius: 2,
            backgroundColor: colors.primary,
          }}
        />
      ) : null}
      <Text
        style={{
          color,
          fontSize: focused ? 22 : 20,
          fontWeight: "800",
          opacity: focused ? 1 : 0.55,
        }}
      >
        {icons[name]}
      </Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          marginTop: 2,
          letterSpacing: 0.3,
        },
        tabBarStyle: {
          position: "absolute",
          left: 18,
          right: 18,
          bottom: Platform.OS === "ios" ? 20 : 14,
          height: 76,
          borderRadius: 28,
          paddingTop: 10,
          paddingBottom: 10,
          borderTopWidth: 0,
          backgroundColor: "rgba(20,20,24,0.95)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
          ...shadow,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        tabBarIcon: ({ color, focused }) => (
          <TabIcon name={route.name} color={color} focused={focused} />
        ),
      })}
    >
      <Tabs.Screen name="Discover" component={DiscoverScreen} />
      <Tabs.Screen name="Messages" component={ConversationsScreen} />
      <Tabs.Screen name="Calls" component={CallsScreen} />
      <Tabs.Screen name="Wallet" component={WalletScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerStyle: {
          backgroundColor: colors.bg,
        },
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 17,
        },
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen
        name="Main"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddMoney"
        component={AddMoneyScreen}
        options={{ title: "Add points" }}
      />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen
        name="ActiveCall"
        component={ActiveCallScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="IncomingCall"
        component={IncomingCallScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="OutgoingCall"
        component={OutgoingCallScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="Review"
        component={ReviewScreen}
        options={{ title: "Review call" }}
      />
      <Stack.Screen
        name="Vendor"
        component={VendorScreen}
        options={{ title: "Profile", headerTransparent: false }}
      />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Packages" component={PackagesScreen} />
      <Stack.Screen name="Memberships" component={MembershipsScreen} />
      <Stack.Screen
        name="Referrals"
        component={ReferralsScreen}
        options={{ title: "Invite friends" }}
      />
      <Stack.Screen
        name="TaskCenter"
        component={TaskCenterScreen}
        options={{ title: "Task Center" }}
      />
      <Stack.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{ title: "Leaderboards" }}
      />
      <Stack.Screen
        name="Beauty"
        component={BeautyScreen}
        options={{ title: "Beauty presets" }}
      />
      <Stack.Screen
        name="GiftCards"
        component={GiftCardsScreen}
        options={{ title: "Gift cards" }}
      />
      <Stack.Screen
        name="DigitalGifts"
        component={DigitalGiftsScreen}
        options={{ title: "Digital gifts" }}
      />
      <Stack.Screen
        name="SendGift"
        component={SendGiftScreen}
        options={{ title: "Send gift" }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: "Edit profile" }}
      />
      <Stack.Screen
        name="VendorDashboard"
        component={VendorDashboardScreen}
        options={{ title: "Creator centre" }}
      />
      <Stack.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{ title: "Creator earnings" }}
      />
      <Stack.Screen
        name="Admin"
        component={AdminScreen}
        options={{ title: "Operations" }}
      />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen
        name="Support"
        component={SupportScreen}
        options={{ title: "Help & support" }}
      />
      <Stack.Screen
        name="Appeals"
        component={AppealsScreen}
        options={{ title: "Moderation appeals" }}
      />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Connections" component={ConnectionsScreen} />
      <Stack.Screen
        name="GoLive"
        component={GoLiveScreen}
        options={{ title: "Go live" }}
      />
      <Stack.Screen
        name="LiveView"
        component={LiveViewScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="SecurityActivity"
        component={SecurityActivityScreen}
        options={{ title: "Security activity" }}
      />
      <Stack.Screen
        name="Legal"
        component={LegalScreen}
        options={({ route }: any) => ({
          title:
            route.params?.type === "privacy"
              ? "Privacy policy"
              : "Terms and conditions",
        })}
      />
    </Stack.Navigator>
  );
}
