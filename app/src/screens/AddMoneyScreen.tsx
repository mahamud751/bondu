import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  initPaymentSheet,
  initStripe,
  presentPaymentSheet,
} from "@stripe/stripe-react-native";
import { api, apiErrorMessage } from '../api/client';
import {
  Button,
  Card,
  Eyebrow,
  Field,
  Pill,
  Screen,
  Title,
} from "../components/UI";
import { colors, radius, spacing } from "../theme";

export function AddMoneyScreen() {
  const [info, setInfo] = useState<any>();
  const [mode, setMode] = useState<"CARD" | "LOCAL" | "MANUAL">("CARD");
  const [gateway, setGateway] = useState<"BKASH" | "NAGAD">("BKASH");
  const [senderNumber, setSender] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionId, setTxn] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/payments/instructions").then((response) => {
      setInfo(response.data);
      if (!response.data.cardPaymentsAvailable)
        setMode(response.data.sslcommerzAvailable ? "LOCAL" : "MANUAL");
    });
  }, []);
  useEffect(() => {
    const handle = ({ url }: { url: string }) => {
      if (!url.startsWith("socialconnect://payment/")) return;
      const result = url.split("/").pop();
      Alert.alert(
        result === "success" ? "Payment submitted" : "Payment not completed",
        result === "success"
          ? "We are validating the gateway confirmation. Your points will update automatically."
          : "No points were charged. You can safely try again.",
      );
    };
    const subscription = Linking.addEventListener("url", handle);
    void Linking.getInitialURL().then((url) => url && handle({ url }));
    return () => subscription.remove();
  }, []);
  const payCard = async () => {
    try {
      setBusy(true);
      const { data } = await api.post("/payments/checkout/stripe", {
        amount: Number(amount),
      });
      if (!data.publishableKey)
        throw new Error("Card payment key is unavailable");
      await initStripe({
        publishableKey: data.publishableKey,
        merchantIdentifier: "merchant.socialconnect",
      });
      const initialized = await initPaymentSheet({
        merchantDisplayName: "SocialConnect",
        paymentIntentClientSecret: data.clientSecret,
        defaultBillingDetails: {},
        allowsDelayedPaymentMethods: false,
      });
      if (initialized.error) throw new Error(initialized.error.message);
      const result = await presentPaymentSheet();
      if (result.error) throw new Error(result.error.message);
      Alert.alert(
        "Payment received",
        "Your points will appear as soon as the verified payment webhook arrives.",
      );
    } catch (error: any) {
      Alert.alert(
        "Payment not completed",
        apiErrorMessage(error, "Try again"),
      );
    } finally {
      setBusy(false);
    }
  };
  const payLocal = async () => {
    try {
      setBusy(true);
      const { data } = await api.post("/payments/checkout/sslcommerz", {
        amount: Number(amount),
      });
      if (!data.checkoutUrl || !(await Linking.canOpenURL(data.checkoutUrl)))
        throw new Error("Secure checkout URL is unavailable");
      await Linking.openURL(data.checkoutUrl);
    } catch (error: any) {
      Alert.alert(
        "Payment not started",
        apiErrorMessage(error, "Try again"),
      );
    } finally {
      setBusy(false);
    }
  };
  const submitManual = async () => {
    try {
      setBusy(true);
      await api.post("/payments/manual", {
        gateway,
        senderNumber,
        amount: Number(amount),
        transactionId,
      });
      Alert.alert(
        "Submitted",
        "Your transfer is awaiting Finance verification.",
      );
      setTxn("");
    } catch (error: any) {
      Alert.alert(
        "Could not submit",
        apiErrorMessage(error, "Try again"),
      );
    } finally {
      setBusy(false);
    }
  };
  const selected = info?.gateways?.find(
    (item: any) => item.gateway === gateway,
  );
  const payable=Number(amount)>0?`${info?.currency??'BDT'} ${((Number(amount)*(info?.currencyMinorUnitsPerPoint??100))/100).toFixed(2)}`:'';
  return (
    <Screen scroll>
      <Eyebrow>Secure checkout</Eyebrow>
      <Title subtitle="Every successful deposit creates a wallet receipt">
        Add points
      </Title>
      <View style={styles.tabs}>
        <Pressable
          onPress={() => info?.cardPaymentsAvailable && setMode("CARD")}
          style={[
            styles.tab,
            mode === "CARD" && styles.tabActive,
            !info?.cardPaymentsAvailable && { opacity: 0.45 },
          ]}
        >
          <Text
            style={[styles.tabText, mode === "CARD" && styles.tabTextActive]}
          >
            Card
          </Text>
        </Pressable>
        <Pressable
          disabled={!info?.sslcommerzAvailable}
          onPress={() => setMode("LOCAL")}
          style={[
            styles.tab,
            mode === "LOCAL" && styles.tabActive,
            !info?.sslcommerzAvailable && { opacity: 0.45 },
          ]}
        >
          <Text
            style={[styles.tabText, mode === "LOCAL" && styles.tabTextActive]}
          >
            Bangladesh
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("MANUAL")}
          style={[styles.tab, mode === "MANUAL" && styles.tabActive]}
        >
          <Text
            style={[styles.tabText, mode === "MANUAL" && styles.tabTextActive]}
          >
            bKash / Nagad
          </Text>
        </Pressable>
      </View>
      {mode === "CARD" ? (
        <>
          <Card style={styles.secureCard}>
            <View style={styles.secureTop}>
              <Text style={styles.cardIcon}>◆</Text>
              <Pill label="Verified webhook" tone="success" />
            </View>
            <Text style={styles.secureTitle}>Instant card payment</Text>
            <Text style={styles.secureBody}>
              Your wallet is credited only after SocialConnect verifies the
              signed payment confirmation from Stripe.
            </Text>
          </Card>
          <Field
            placeholder="Points to purchase (minimum 10)"
            keyboardType="number-pad"
            value={amount}
            onChangeText={setAmount}
          />
          {payable?<Text style={styles.priceHint}>You pay {payable} for {amount} points</Text>:null}
          <Button
            title="Continue to secure payment"
            icon="→"
            loading={busy}
            disabled={Number(amount) < 10}
            onPress={payCard}
          />
        </>
      ) : mode === "LOCAL" ? (
        <>
          <Card style={styles.secureCard}>
            <View style={styles.secureTop}>
              <Text style={styles.cardIcon}>৳</Text>
              <Pill label="Gateway verified" tone="success" />
            </View>
            <Text style={styles.secureTitle}>Pay securely in Bangladesh</Text>
            <Text style={styles.secureBody}>
              Continue to SSLCommerz for cards, mobile banking, and supported
              local payment methods. Points are credited only after server
              validation.
            </Text>
          </Card>
          <Field
            placeholder="Points to purchase (minimum 10)"
            keyboardType="number-pad"
            value={amount}
            onChangeText={setAmount}
          />
          {payable?<Text style={styles.priceHint}>You pay {payable} for {amount} points</Text>:null}
          <Button
            title="Open SSLCommerz checkout"
            icon="→"
            loading={busy}
            disabled={Number(amount) < 10}
            onPress={payLocal}
          />
        </>
      ) : (
        <>
          <View style={styles.gatewayRow}>
            <Pressable
              onPress={() => setGateway("BKASH")}
              style={[
                styles.gateway,
                gateway === "BKASH" && styles.gatewaySelected,
              ]}
            >
              <Text style={styles.gatewayName}>bKash</Text>
            </Pressable>
            <Pressable
              onPress={() => setGateway("NAGAD")}
              style={[
                styles.gateway,
                gateway === "NAGAD" && styles.gatewaySelected,
              ]}
            >
              <Text style={styles.gatewayName}>Nagad</Text>
            </Pressable>
          </View>
          <Card>
            <Text style={styles.step}>SEND MONEY TO</Text>
            <Text selectable style={styles.receiver}>
              {selected?.receiverNumber ?? "Not configured"}
            </Text>
            <Text style={styles.warning}>
              Send the exact amount using Send Money—not Cash Out.
            </Text>
          </Card>
          <Field
            placeholder="Your sender number"
            keyboardType="phone-pad"
            value={senderNumber}
            onChangeText={setSender}
          />
          <Field
            placeholder="Points to purchase"
            keyboardType="number-pad"
            value={amount}
            onChangeText={setAmount}
          />
          {payable?<Text style={styles.priceHint}>Send exactly {payable}</Text>:null}
          <Field
            placeholder="Transaction ID"
            autoCapitalize="characters"
            value={transactionId}
            onChangeText={setTxn}
          />
          <Button
            title="Submit for verification"
            loading={busy}
            disabled={
              !/^01\d{9}$/.test(senderNumber) ||
              Number(amount) < 10 ||
              !transactionId.trim()
            }
            onPress={submitManual}
          />
        </>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    padding: 4,
    backgroundColor: "#EDEBF1",
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 11 },
  tabActive: { backgroundColor: colors.surface },
  tabText: { color: colors.muted, fontWeight: "700" },
  tabTextActive: { color: colors.text, fontWeight: "900" },
  secureCard: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
    padding: 22,
  },
  secureTop: { flexDirection: "row", justifyContent: "space-between" },
  cardIcon: { color: colors.primary, fontSize: 25 },
  secureTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 18,
  },
  secureBody: { color: "#CFC8E5", lineHeight: 20, marginTop: 7 },
  priceHint: { color: colors.muted, fontWeight: "700", marginTop: -8, marginBottom: 14 },
  gatewayRow: { flexDirection: "row", gap: 10, marginBottom: spacing.md },
  gateway: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: "center",
  },
  gatewaySelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  gatewayName: { color: colors.text, fontWeight: "900" },
  step: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  receiver: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: "900",
    marginVertical: 10,
  },
  warning: { color: colors.danger, lineHeight: 19, fontSize: 12 },
});
