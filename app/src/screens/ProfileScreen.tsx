import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { api } from "../api/client";
import {
  Avatar,
  Button,
  Card,
  Eyebrow,
  Metric,
  Pill,
  Screen,
  SectionTitle,
  Title,
} from "../components/UI";
import { useAuth } from "../store/auth";
import { colors, radius } from "../theme";

const MenuItem = ({
  icon,
  title,
  body,
  onPress,
}: {
  icon: string;
  title: string;
  body: string;
  onPress: () => void;
}) => (
  <Pressable style={styles.menuItem} onPress={onPress}>
    <View style={styles.menuIcon}>
      <Text style={styles.menuIconText}>{icon}</Text>
    </View>
    <View style={styles.menuInfo}>
      <Text style={styles.menuTitle}>{title}</Text>
      <Text style={styles.menuBody}>{body}</Text>
    </View>
    <Text style={styles.chevron}>›</Text>
  </Pressable>
);
export function ProfileScreen() {
  const [user, setUser] = useState<any>();
  const logout = useAuth((state) => state.logout);
  const navigation = useNavigation<any>();
  useFocusEffect(
    useCallback(() => {
      api.get("/users/me").then((response) => setUser(response.data));
    }, []),
  );
  const profile = user?.profile;
  const vendor = user?.vendor;
  return (
    <Screen scroll>
      <Eyebrow>Your space</Eyebrow>
      <Title subtitle="Profile, privacy and creator tools">Profile</Title>
      <Card style={styles.hero}>
        <View style={styles.profileRow}>
          <Avatar
            name={profile?.displayName}
            size={76}
            online={profile?.online}
          />
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {profile?.displayName ?? "Loading…"}
              </Text>
              {profile?.isVerified ? (
                <Text style={styles.verified}>✓</Text>
              ) : null}
            </View>
            <Text style={styles.handle}>@{profile?.username ?? "member"}</Text>
            <View style={styles.roles}>
              <Pill label={user?.role ?? "USER"} tone="primary" />
              {vendor?.status === "APPROVED" ? (
                <Pill label="Verified creator" tone="success" />
              ) : null}
            </View>
          </View>
        </View>
        {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        <View style={styles.metrics}>
          <Metric label="Languages" value={profile?.languages?.length ?? 0} />
          <Metric label="Interests" value={profile?.interests?.length ?? 0} />
          <Metric
            label="Rating"
            value={
              vendor ? `★ ${Number(vendor.averageRating).toFixed(1)}` : "—"
            }
            tone="gold"
          />
        </View>
        <Button
          title="Edit profile"
          icon="✎"
          variant="secondary"
          onPress={() => navigation.navigate("EditProfile")}
        />
      </Card>
      <SectionTitle>Account</SectionTitle>
      <Card style={styles.menu}>
        <MenuItem
          icon="✦"
          title="Creator centre"
          body={
            vendor
              ? `Application ${vendor.status.toLowerCase().replaceAll("_", " ")}`
              : "Apply and earn from conversations"
          }
          onPress={() => navigation.navigate("VendorDashboard")}
        />
        {vendor?.status === "APPROVED" ? <MenuItem icon="◆" title="Earnings and withdrawals" body="Revenue, commission, available balance and payouts" onPress={() => navigation.navigate("Earnings")}/> : null}
        <MenuItem
          icon="♢"
          title="Notifications"
          body="Calls, messages, gifts and account updates"
          onPress={() => navigation.navigate("Notifications")}
        />
        <MenuItem
          icon="⚙"
          title="Privacy and settings"
          body="Visibility, security and devices"
          onPress={() => navigation.navigate("Settings")}
        />
        <MenuItem icon="⚿" title="Security activity" body="Sign-in risk, devices and revoke-all control" onPress={()=>navigation.navigate('SecurityActivity')}/>
        <MenuItem
          icon="⚖"
          title="Moderation appeals"
          body="Request an independent review of a restriction"
          onPress={() => navigation.navigate("Appeals")}
        />
      </Card>
      {["ADMIN", "FINANCE", "MODERATOR"].includes(user?.role) ? (
        <>
          <SectionTitle>Team tools</SectionTitle>
          <Card style={styles.menu}>
            <MenuItem
              icon="▦"
              title="Operations console"
              body="Users, finance, safety and catalog"
              onPress={() => navigation.navigate("Admin")}
            />
          </Card>
        </>
      ) : null}
      <Button
        title="Sign out"
        icon="↗"
        variant="danger"
        onPress={() => void logout()}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  hero: { padding: 20 },
  profileRow: { flexDirection: "row", alignItems: "center" },
  profileInfo: { flex: 1, marginLeft: 15 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  name: { color: colors.text, fontSize: 21, fontWeight: "900" },
  verified: {
    color: "#FFF",
    backgroundColor: colors.primary,
    overflow: "hidden",
    width: 19,
    height: 19,
    borderRadius: 10,
    textAlign: "center",
    fontSize: 12,
    marginLeft: 6,
  },
  handle: { color: colors.muted, marginTop: 3 },
  roles: { flexDirection: "row", gap: 6, marginTop: 9 },
  bio: { color: colors.textSoft, lineHeight: 21, marginTop: 17 },
  metrics: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 18,
    paddingTop: 16,
  },
  menu: { paddingVertical: 4, paddingHorizontal: 15 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconText: { color: colors.primary, fontWeight: "900", fontSize: 17 },
  menuInfo: { flex: 1, marginLeft: 12 },
  menuTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  menuBody: { color: colors.muted, fontSize: 11, marginTop: 3 },
  chevron: { color: colors.muted, fontSize: 25 },
});
