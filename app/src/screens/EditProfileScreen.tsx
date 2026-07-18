import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { launchImageLibrary } from "react-native-image-picker";
import { api, apiErrorMessage } from "../api/client";
import { uploadAsset } from "../api/uploads";
import { Avatar, Button, Field, Screen, Title } from "../components/UI";
import { colors, spacing } from "../theme";
export function EditProfileScreen({ navigation }: { navigation: any }) {
  const [displayName, setName] = useState(""),
    [bio, setBio] = useState(""),
    [city, setCity] = useState(""),
    [avatarUrl, setAvatarUrl] = useState<string | undefined>(),
    [uploadingPhoto, setUploadingPhoto] = useState(false);
  useEffect(() => {
    api.get("/users/me").then(({ data }) => {
      setName(data.profile?.displayName ?? "");
      setBio(data.profile?.bio ?? "");
      setCity(data.profile?.city ?? "");
      setAvatarUrl(data.profile?.avatarUrl ?? undefined);
    });
  }, []);
  const changePhoto = async () => {
    const selection = await launchImageLibrary({ mediaType: "photo", selectionLimit: 1 });
    const asset = selection.assets?.[0];
    if (!asset) return;
    try {
      setUploadingPhoto(true);
      const assetId = await uploadAsset(asset, "PROFILE");
      await api.patch("/users/me/profile", { avatarUrl: assetId });
      setAvatarUrl(assetId);
    } catch (error: unknown) {
      Alert.alert("Could not update photo", apiErrorMessage(error));
    } finally {
      setUploadingPhoto(false);
    }
  };
  const save = async () => {
    try {
      await api.patch("/users/me/profile", { displayName, bio, city });
      Alert.alert("Saved", "Profile updated.");
      navigation.goBack();
    } catch (e: unknown) {
      Alert.alert("Could not save", apiErrorMessage(e));
    }
  };
  return (
    <Screen>
      <ScrollView>
        <Title>Edit profile</Title>
        <Pressable style={styles.photoRow} onPress={changePhoto} disabled={uploadingPhoto}>
          <Avatar name={displayName} avatarUrl={avatarUrl} size={84} />
          <Text style={styles.photoLabel}>{uploadingPhoto ? "Uploading…" : "Change photo"}</Text>
        </Pressable>
        <Field
          placeholder="Display name"
          value={displayName}
          onChangeText={setName}
        />
        <Field placeholder="Bio" value={bio} onChangeText={setBio} multiline />
        <Field placeholder="City" value={city} onChangeText={setCity} />
        <Button
          title="Save profile"
          disabled={!displayName.trim()}
          onPress={save}
        />
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  photoRow: { alignItems: "center", marginBottom: spacing.xl },
  photoLabel: { color: colors.primary, fontWeight: "700", fontSize: 13, marginTop: 10 },
});
