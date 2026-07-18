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
import { colors } from "../theme";

const MenuItem = ({
  icon,
  title,
  body,
  onPress,
  last,
}: {
  icon: string;
  title: string;
  body: string;
  onPress: () => void;
  last?: boolean;
}) => (
  <Pressable
    style={[styles.menuItem, last && { borderBottomWidth: 0 }]}
    onPress={onPress}
  >
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
      <Eyebrow>You</Eyebrow>
      <Title subtitle="Identity, privacy and creator tools">Profile</Title>

      <Card style={styles.hero}>
        <View style={styles.profileRow}>
          <Avatar
            name={profile?.displayName}
            avatarUrl={profile?.avatarUrl}
            size={80}
            online={profile?.online}
          />
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {profile?.displayName ?? "Loading…"}
              </Text>
              {profile?.isVerified ? (
                <View style={styles.verified}>
                  <Text style={styles.verifiedMark}>✓</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.handle}>@{profile?.username ?? "member"}</Text>
            <View style={styles.roles}>
              <Pill label={user?.role ?? "USER"} tone="primary" />
              {vendor?.status === "APPROVED" ? (
                <Pill label="Creator" tone="success" />
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
        {vendor?.status === "APPROVED" ? (
          <MenuItem
            icon="◆"
            title="Earnings"
            body="Revenue, commission and payouts"
            onPress={() => navigation.navigate("Earnings")}
          />
        ) : null}
        <MenuItem
          icon="♡"
          title="Notifications"
          body="Calls, messages and account updates"
          onPress={() => navigation.navigate("Notifications")}
        />
        <MenuItem
          icon="⚙"
          title="Privacy & settings"
          body="Visibility, security and devices"
          onPress={() => navigation.navigate("Settings")}
        />
        <MenuItem
          icon="⚿"
          title="Security activity"
          body="Sign-ins, devices and revoke control"
          onPress={() => navigation.navigate("SecurityActivity")}
        />
        <MenuItem
          icon="⚖"
          title="Appeals"
          body="Request review of a restriction"
          onPress={() => navigation.navigate("Appeals")}
          last
        />
      </Card>

      {["ADMIN", "FINANCE", "MODERATOR"].includes(user?.role) ? (
        <>
          <SectionTitle>Team</SectionTitle>
          <Card style={styles.menu}>
            <MenuItem
              icon="▦"
              title="Operations"
              body="Users, finance, safety and catalog"
              onPress={() => navigation.navigate("Admin")}
              last
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
      <View style={{ height: 40 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 20,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  verified: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedMark: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "900",
  },
  handle: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 14,
  },
  roles: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  bio: {
    color: colors.textSoft,
    lineHeight: 21,
    marginTop: 16,
    fontSize: 14,
  },
  metrics: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 18,
    paddingTop: 16,
  },
  menu: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconText: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 16,
  },
  menuInfo: {
    flex: 1,
    marginLeft: 12,
  },
  menuTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
  },
  menuBody: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  chevron: {
    color: colors.muted,
    fontSize: 24,
    opacity: 0.4,
  },
});
