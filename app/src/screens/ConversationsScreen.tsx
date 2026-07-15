import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import { Card, Screen, Title } from '../components/UI';
import { colors } from '../theme';
export function ConversationsScreen(){const[data,setData]=useState<any[]>([]),nav=useNavigation<any>();const load=useCallback(()=>{api.get('/chat/conversations').then(r=>setData(r.data)).catch(()=>setData([]))},[]);useFocusEffect(useCallback(()=>{load()},[load]));return <Screen><Title>Messages</Title><FlatList data={data} keyExtractor={x=>x.id} ListEmptyComponent={<Card><Text style={{color:colors.muted}}>Start a conversation from Discover.</Text></Card>} renderItem={({item})=>{const other=item.userOne?.profile?.displayName??item.userTwo?.profile?.displayName??'Conversation',last=item.messages?.[0];return <Pressable onPress={()=>nav.navigate('Chat',{conversationId:item.id,title:other})}><Card><Text style={{fontWeight:'800',color:colors.text,fontSize:16}}>{other}</Text><Text numberOfLines={1} style={{color:colors.muted,marginTop:6}}>{last?.content??'No messages yet'}</Text></Card></Pressable>}}/></Screen>}
