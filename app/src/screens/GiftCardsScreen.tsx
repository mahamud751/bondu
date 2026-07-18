import React, { useEffect, useState } from "react";
import { Alert, ScrollView, Text } from "react-native";
import { api, apiErrorMessage } from "../api/client";
import { Button, Card, Screen, Title } from "../components/UI";
import { colors } from "../theme";
export function GiftCardsScreen() {
  const [cards, setCards] = useState<any[]>([]),
    [owned, setOwned] = useState<any[]>([]),
    [me, setMe] = useState<any>();
  const load = () =>
    Promise.all([
      api.get("/gift-cards"),
      api.get("/gift-cards/owned/mine"),
      api.get("/users/me"),
    ]).then(([a, b, c]) => {
      setCards(a.data);
      setOwned(b.data);
      setMe(c.data);
    });
  useEffect(() => {
    void load();
  }, []);
  const buy = async (card: any) => {
    try {
      await api.post(`/gift-cards/${card.id}/purchase`, {
        recipientId: me.id,
        idempotencyKey: `mobile-${Date.now()}-${Math.random()}`,
      });
      Alert.alert("Purchased", `${card.name} is in your gift wallet.`);
      void load();
    } catch (e: unknown) {
      Alert.alert("Purchase failed", apiErrorMessage(e));
    }
  };
  return (
    <Screen>
      <ScrollView>
        <Title>Gift card store</Title>
        {cards.map((card) => (
          <Card key={card.id}>
            <Text style={{ fontWeight: "800", color: colors.text }}>
              {card.name}
            </Text>
            <Text style={{ color: colors.muted }}>
              {card.voiceSeconds
                ? `${card.voiceSeconds / 60} voice minutes`
                : ""}
              {card.messageCount ? `${card.messageCount} messages` : ""} ·{" "}
              {card.validityDays} days
            </Text>
            <Button
              title={`Buy for ${card.price} points`}
              disabled={!me}
              onPress={() => buy(card)}
            />
          </Card>
        ))}
        <Title>My gift cards</Title>
        {owned.map((card) => (
          <Card key={card.id}>
            <Text style={{ fontWeight: "800", color: colors.text }}>
              {card.giftCard.name}
            </Text>
            <Text style={{ color: colors.muted }}>
              Voice: {card.remainingVoiceSeconds}s · Messages:{" "}
              {card.remainingMessages} · {card.status}
            </Text>
            {!card.activatedAt && (
              <Button
                title="Activate"
                onPress={() =>
                  api.post(`/gift-cards/owned/${card.id}/activate`).then(load)
                }
              />
            )}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
