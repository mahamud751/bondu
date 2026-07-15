import React, { useCallback, useState } from "react";
import { FlatList, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { Button, Card, Screen, Title } from "../components/UI";
import { colors } from "../theme";
export function ConnectionsScreen() {
  const [requests, setRequests] = useState<any[]>([]),
    [connections, setConnections] = useState<any[]>([]);
  const load = useCallback(
    () =>
      Promise.all([
        api.get("/social/connections/requests"),
        api.get("/social/connections"),
      ]).then(([a, b]) => {
        setRequests(a.data);
        setConnections(b.data);
      }),
    [],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const respond = (id: string, answer: "accept" | "reject") =>
    api.patch(`/social/connections/${id}/${answer}`).then(load);
  return (
    <Screen>
      <Title>Requests</Title>
      {requests.map((x) => (
        <Card key={x.id}>
          <Text style={{ fontWeight: "800", color: colors.text }}>
            {x.requester?.profile?.displayName}
          </Text>
          <Button title="Accept" onPress={() => respond(x.id, "accept")} />
          <Button title="Reject" onPress={() => respond(x.id, "reject")} />
        </Card>
      ))}
      <Title>Connections</Title>
      <FlatList
        data={connections}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => (
          <Card>
            <Text style={{ color: colors.text }}>
              {item.requester?.profile?.displayName} ↔{" "}
              {item.recipient?.profile?.displayName}
            </Text>
          </Card>
        )}
      />
    </Screen>
  );
}
