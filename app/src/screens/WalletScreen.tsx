import React, { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import { Button, Card, Screen, Title } from '../components/UI';
import { colors } from '../theme';

export function WalletScreen() {
  const [wallet, setWallet] = useState<any>();
  const navigation = useNavigation<any>();
  useEffect(() => { api.get('/wallet').then(response => setWallet(response.data)); }, []);
  return <Screen><Title>Wallet</Title><ScrollView>
    <Card><Text style={{ color: colors.muted }}>Available points</Text><Text style={{ fontSize: 36, fontWeight: '900', color: colors.text }}>{wallet?.purchased ?? 0}</Text><Text style={{ color: colors.muted }}>Reserved: {wallet?.reserved ?? 0}</Text></Card>
    <Button title="Add points with bKash / Nagad" onPress={() => navigation.navigate('AddMoney')} />
    <Button title="Browse packages" onPress={() => navigation.navigate('Packages')} />
    <Card><Text style={{ fontWeight: '700', color: colors.text }}>Vendor earnings</Text><Text style={{ color: colors.muted, marginTop: 8 }}>Pending: {wallet?.pendingEarning ?? 0}</Text><Text style={{ color: colors.success }}>Withdrawable: {wallet?.availableEarning ?? 0}</Text></Card>
  </ScrollView></Screen>;
}
