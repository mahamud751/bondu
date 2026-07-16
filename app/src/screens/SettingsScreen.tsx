import React,{useEffect,useState}from'react';
import{Alert,StyleSheet,Switch,Text,View}from'react-native';
import{api}from'../api/client';
import{Button,Card,Eyebrow,Field,Pill,Screen,SectionTitle,Title}from'../components/UI';
import{useAuth}from'../store/auth';
import{colors}from'../theme';

const Toggle=({label,body,value,onChange}:{label:string;body:string;value:boolean;onChange:(value:boolean)=>void})=><View style={styles.toggle}><View style={styles.toggleInfo}><Text style={styles.toggleLabel}>{label}</Text><Text style={styles.toggleBody}>{body}</Text></View><Switch value={value} onValueChange={onChange} trackColor={{false:'#D9D6DF',true:'#B9AAFF'}} thumbColor={value?colors.primary:'#FFF'}/></View>;
const timePattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function SettingsScreen(){
  const[profile,setProfile]=useState<any>({}),[preferences,setPreferences]=useState<any>({}),[devices,setDevices]=useState<any[]>([]),[blocks,setBlocks]=useState<any[]>([]),[currentPassword,setCurrent]=useState(''),[newPassword,setNew]=useState(''),[deletePassword,setDelete]=useState(''),logout=useAuth(state=>state.logout);
  const load=()=>Promise.all([api.get('/users/me'),api.get('/notifications/preferences'),api.get('/auth/devices'),api.get('/users/blocks')]).then(([u,p,d,b])=>{setProfile(u.data.profile??{});setPreferences({...p.data,quietStart:p.data.quietStart??'22:00',quietEnd:p.data.quietEnd??'07:00'});setDevices(d.data);setBlocks(b.data)});
  useEffect(()=>{void load()},[]);
  const privacy=async(key:string,value:boolean)=>{setProfile((current:any)=>({...current,[key]:value}));try{await api.patch('/users/me/privacy',{[key]:value})}catch{setProfile((current:any)=>({...current,[key]:!value}))}};
  const preference=async(key:string,value:boolean)=>{setPreferences((current:any)=>({...current,[key]:value}));try{await api.patch('/notifications/preferences',{[key]:value})}catch{setPreferences((current:any)=>({...current,[key]:!value}))}};
  const saveQuietHours=async()=>{if(!timePattern.test(preferences.quietStart)||!timePattern.test(preferences.quietEnd))return Alert.alert('Use 24-hour time','Enter times such as 22:00 and 07:00.');try{await api.patch('/notifications/preferences',{quietStart:preferences.quietStart,quietEnd:preferences.quietEnd});Alert.alert('Quiet hours saved','Nonessential push and email updates will pause during this window.')}catch(error:any){Alert.alert('Could not save quiet hours',error.response?.data?.message??'Try again')}};
  const change=async()=>{try{await api.post('/auth/change-password',{currentPassword,newPassword});Alert.alert('Password changed','Sign in again with your new password.');await logout()}catch(error:any){Alert.alert('Could not change password',error.response?.data?.message??'Try again')}};
  const revoke=async(deviceId:string)=>{await api.post('/auth/logout',{deviceId});await load()};
  const remove=()=>Alert.alert('Delete account','Your public profile will be anonymized. Financial records are retained as required.',[{text:'Cancel',style:'cancel'},{text:'Delete permanently',style:'destructive',onPress:async()=>{try{await api.delete('/users/me',{data:{password:deletePassword}});await logout()}catch(error:any){Alert.alert('Could not delete account',error.response?.data?.message??'Try again')}}}]);
  return <Screen scroll><Eyebrow>You stay in control</Eyebrow><Title subtitle="Privacy, notifications, sessions and account security">Settings</Title>
    <SectionTitle>Privacy</SectionTitle><Card style={styles.group}>
      <Toggle label="Show online status" body="Let people know when you are available" value={!profile.hideOnline} onChange={value=>privacy('hideOnline',!value)}/>
      <Toggle label="Show last seen" body="Share when you were last active" value={!profile.hideLastSeen} onChange={value=>privacy('hideLastSeen',!value)}/>
      <Toggle label="Show age" body="Display your age on your public profile" value={!profile.hideAge} onChange={value=>privacy('hideAge',!value)}/>
      <Toggle label="Show location" body="Display city and country" value={!profile.hideLocation} onChange={value=>privacy('hideLocation',!value)}/>
      <Toggle label="Profile discovery" body="Appear in search and recommendations" value={profile.discoverable!==false} onChange={value=>privacy('discoverable',value)}/>
      <Toggle label="Messages from everyone" body="When off, only accepted connections may message you" value={profile.messagesFromEveryone!==false} onChange={value=>privacy('messagesFromEveryone',value)}/>
      <Toggle label="Calls from everyone" body="When off, only followers may request calls" value={profile.callsFromEveryone!==false} onChange={value=>privacy('callsFromEveryone',value)}/>
    </Card>
    <SectionTitle>Notifications</SectionTitle><Card style={styles.group}>
      <Toggle label="Push notifications" body="Calls, messages, gifts and account events" value={preferences.pushEnabled!==false} onChange={value=>preference('pushEnabled',value)}/>
      <Toggle label="Email updates" body="Receipts and important account updates" value={preferences.emailEnabled!==false} onChange={value=>preference('emailEnabled',value)}/>
      <Toggle label="Security SMS" body="Keep critical login and account alerts enabled" value={preferences.smsSecurity!==false} onChange={value=>preference('smsSecurity',value)}/>
      <Text style={styles.quietTitle}>Quiet hours</Text><Text style={styles.toggleBody}>Overnight windows are supported. Critical security SMS remains enabled.</Text>
      <View style={styles.quietRow}><Field style={styles.time} placeholder="22:00" value={preferences.quietStart??''} onChangeText={value=>setPreferences((current:any)=>({...current,quietStart:value}))}/><Text style={styles.to}>to</Text><Field style={styles.time} placeholder="07:00" value={preferences.quietEnd??''} onChangeText={value=>setPreferences((current:any)=>({...current,quietEnd:value}))}/></View>
      <Button title="Save quiet hours" variant="secondary" onPress={saveQuietHours}/>
    </Card>
    <SectionTitle>Signed-in devices</SectionTitle>{devices.map(device=><Card key={device.deviceId}><View style={styles.device}><View style={styles.flex}><Text style={styles.deviceName}>{device.deviceName??device.platform??'Unknown device'}</Text><Text style={styles.deviceMeta}>Last used {new Date(device.lastUsedAt).toLocaleString()}</Text></View>{device.revokedAt?<Pill label="SIGNED OUT"/>:<Button title="Sign out" variant="ghost" onPress={()=>revoke(device.deviceId)}/>}</View></Card>)}
    <SectionTitle>Blocked people</SectionTitle>{blocks.length?blocks.map(item=><Card key={item.id}><View style={styles.device}><Text style={styles.deviceName}>{item.blocked?.profile?.displayName??'Blocked member'}</Text><Button title="Unblock" variant="ghost" onPress={()=>api.delete(`/users/blocks/${item.blockedUserId}`).then(load)}/></View></Card>):<Card><Text style={styles.toggleBody}>You have not blocked anyone.</Text></Card>}
    <SectionTitle>Change password</SectionTitle><Card><Field placeholder="Current password" secureTextEntry value={currentPassword} onChangeText={setCurrent}/><Field placeholder="New password" secureTextEntry value={newPassword} onChangeText={setNew}/><Button title="Change password" disabled={!currentPassword||newPassword.length<8} onPress={change}/></Card>
    <SectionTitle>Danger zone</SectionTitle><Card style={styles.danger}><Text style={styles.dangerTitle}>Delete account</Text><Text style={styles.toggleBody}>Permanently disable and anonymize your profile.</Text><Field placeholder="Confirm your password" secureTextEntry value={deletePassword} onChangeText={setDelete}/><Button title="Delete my account" variant="danger" disabled={!deletePassword} onPress={remove}/></Card>
  </Screen>
}

const styles=StyleSheet.create({group:{paddingVertical:2},toggle:{flexDirection:'row',alignItems:'center',paddingVertical:15,borderBottomWidth:1,borderBottomColor:colors.border},toggleInfo:{flex:1,paddingRight:15},toggleLabel:{color:colors.text,fontWeight:'800',fontSize:13},toggleBody:{color:colors.muted,fontSize:11,lineHeight:16,marginTop:4},quietTitle:{color:colors.text,fontWeight:'900',fontSize:13,marginTop:16},quietRow:{flexDirection:'row',alignItems:'center',gap:10,marginTop:10},time:{flex:1},to:{color:colors.muted,fontWeight:'800'},device:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},flex:{flex:1},deviceName:{color:colors.text,fontWeight:'800'},deviceMeta:{color:colors.muted,fontSize:10,marginTop:5},danger:{borderColor:'#F5CDD2',backgroundColor:'#FFF9FA'},dangerTitle:{color:colors.danger,fontWeight:'900',fontSize:16,marginBottom:5}});
