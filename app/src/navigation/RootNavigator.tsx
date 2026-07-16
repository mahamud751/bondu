import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActiveCallScreen } from "../screens/ActiveCallScreen";
import { IncomingCallScreen } from "../screens/IncomingCallScreen";
import { AppealsScreen } from "../screens/AppealsScreen";
import { AddMoneyScreen } from "../screens/AddMoneyScreen";
import { AdminScreen } from "../screens/AdminScreen";
import { CallsScreen } from "../screens/CallsScreen";
import { ChatScreen } from "../screens/ChatScreen";
import { ConnectionsScreen } from "../screens/ConnectionsScreen";
import { ConversationsScreen } from "../screens/ConversationsScreen";
import { EditProfileScreen } from "../screens/EditProfileScreen";
import { EarningsScreen } from '../screens/EarningsScreen';
import { GiftCardsScreen } from "../screens/GiftCardsScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LegalScreen } from '../screens/LegalScreen';
import { MembershipsScreen } from "../screens/MembershipsScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { PackagesScreen } from "../screens/PackagesScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ReferralsScreen } from "../screens/ReferralsScreen";
import { ReviewScreen } from "../screens/ReviewScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { SecurityActivityScreen } from '../screens/SecurityActivityScreen';
import { SettingsScreen } from "../screens/SettingsScreen";
import { SupportScreen } from "../screens/SupportScreen";
import { VendorDashboardScreen } from "../screens/VendorDashboardScreen";
import { VendorScreen } from "../screens/VendorScreen";
import { WalletScreen } from "../screens/WalletScreen";
import { colors, shadow } from "../theme";

const Tabs = createBottomTabNavigator(),
  Stack = createNativeStackNavigator();
const icons: Record<string, string> = {
  Discover: "⌂",
  Messages: "✉",
  Calls: "◉",
  Wallet: "◆",
  Profile: "●",
};
function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginBottom: 4 },
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          borderTopWidth: 0,
          backgroundColor: colors.surface,
          ...shadow,
        },
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 20, fontWeight: "900" }}>
            {icons[route.name]}
          </Text>
        ),
      })}
    >
      <Tabs.Screen name="Discover" component={HomeScreen} />
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
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontWeight: "800" },
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
      <Stack.Screen name="IncomingCall" component={IncomingCallScreen} options={{headerShown:false,gestureEnabled:false,presentation:'fullScreenModal'}}/>
      <Stack.Screen
        name="Review"
        component={ReviewScreen}
        options={{ title: "Review call" }}
      />
      <Stack.Screen
        name="Vendor"
        component={VendorScreen}
        options={{ title: "Creator profile" }}
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
        name="GiftCards"
        component={GiftCardsScreen}
        options={{ title: "Gift cards" }}
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
      <Stack.Screen name="Earnings" component={EarningsScreen} options={{title:'Creator earnings'}} />
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
      <Stack.Screen name="SecurityActivity" component={SecurityActivityScreen} options={{title:'Security activity'}}/>
      <Stack.Screen name="Legal" component={LegalScreen} options={({route}:any)=>({title:route.params?.type==='privacy'?'Privacy policy':'Terms and conditions'})}/>
    </Stack.Navigator>
  );
}
