import { PackageType, PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const db = new PrismaClient();
const slug = (value: string) => value.toLowerCase().replaceAll(' ', '-');

async function seedCatalog() {
  const packages = [
    { name: 'Starter Voice', type: PackageType.VOICE, price: 100, voiceSeconds: 300, messageCount: 0, points: 0, validityDays: 7 },
    { name: 'Video Hello', type: PackageType.VIDEO, price: 200, voiceSeconds: 0, videoSeconds: 300, messageCount: 0, points: 0, validityDays: 7 },
    { name: 'Standard Voice', type: PackageType.VOICE, price: 500, voiceSeconds: 1800, messageCount: 0, points: 50, validityDays: 30 },
    { name: 'Premium Voice', type: PackageType.VOICE, price: 1000, voiceSeconds: 4200, messageCount: 0, points: 150, validityDays: 30 },
    { name: 'Chat 50', type: PackageType.CHAT, price: 100, voiceSeconds: 0, messageCount: 50, points: 0, validityDays: 7 },
    { name: 'Social Mix', type: PackageType.COMBINATION, price: 500, voiceSeconds: 1200, messageCount: 100, points: 50, validityDays: 30 },
  ];
  for (const item of packages) await db.package.upsert({ where: { id: `seed-${slug(item.name)}` }, create: { id: `seed-${slug(item.name)}`, ...item }, update: item });
  for (const plan of [
    { id: 'seed-silver', name: 'Silver', description: 'A lighter way to connect every month.', price: 300, durationDays: 30, badge: 'SILVER', displayOrder: 1, benefits: { callDiscountPercent: 5, bonusPoints: 25 } },
    { id: 'seed-gold', name: 'Gold', description: 'More conversations, lower rates and a premium badge.', price: 700, durationDays: 30, badge: 'GOLD', displayOrder: 2, benefits: { callDiscountPercent: 10, bonusPoints: 100, prioritySupport: true } },
    { id: 'seed-vip', name: 'VIP', description: 'The most rewarding SocialConnect membership.', price: 1500, durationDays: 30, badge: 'VIP', displayOrder: 3, benefits: { voiceDiscountPercent: 15, videoDiscountPercent: 12, bonusPoints: 250, priorityCallQueue: true } },
  ]) await db.membershipPlan.upsert({ where: { id: plan.id }, create: plan, update: plan });

  const gifts = [
    ['rose', 'Rose', '🌹', 20, 60], ['coffee', 'Coffee', '☕', 35, 60], ['heart', 'Heart', '💜', 50, 60], ['trophy', 'Trophy', '🏆', 80, 65], ['crown', 'Crown', '👑', 100, 65], ['diamond', 'Diamond', '💎', 250, 70], ['celebration', 'Celebration', '🎉', 150, 65],
  ] as const;
  for (const [index,[id, name, iconUrl, pointPrice, vendorPercent]] of gifts.entries()) await db.digitalGift.upsert({ where: { id: `seed-${id}` }, create: { id: `seed-${id}`, name, iconUrl, pointPrice, vendorPercent,category:pointPrice>=150?'PREMIUM':'STANDARD',displayOrder:index,enabledInCalls:true,enabledInChats:true,enabledInLive:true }, update: { name, iconUrl, pointPrice, vendorPercent,category:pointPrice>=150?'PREMIUM':'STANDARD',displayOrder:index,enabledInCalls:true,enabledInChats:true,enabledInLive:true,active: true } });

  const cards = [
    { id: 'seed-voice-card', name: 'Five-Minute Voice Card', type: PackageType.VOICE, price: 100, voiceSeconds: 300, messageCount: 0, validityDays: 7, transferable: true, vendorSpecific: false },
    { id: 'seed-video-card', name: 'Five-Minute Video Card', type: PackageType.VIDEO, price: 200, voiceSeconds: 0, videoSeconds: 300, messageCount: 0, validityDays: 7, transferable: true, vendorSpecific: false },
    { id: 'seed-chat-card', name: 'Chat 50 Gift Card', type: PackageType.CHAT, price: 100, voiceSeconds: 0, messageCount: 50, validityDays: 7, transferable: true, vendorSpecific: false },
    { id: 'seed-creator-card', name: 'Creator Voice Pass', type: PackageType.VOICE, price: 180, voiceSeconds: 600, messageCount: 0, validityDays: 14, transferable: false, vendorSpecific: true },
  ];
  for (const card of cards) await db.giftCard.upsert({ where: { id: card.id }, create: card, update: card });
}

async function seedCommunity() {
  const adminId='00000000-0000-4000-8000-000000000001',nabilaId='00000000-0000-4000-8000-000000000002',farhanId='00000000-0000-4000-8000-000000000003',tasniaId='00000000-0000-4000-8000-000000000004',memberId='00000000-0000-4000-8000-000000000005';
  const nabila=await db.vendorProfile.findUniqueOrThrow({where:{userId:nabilaId}}),vendors=await db.vendorProfile.findMany({where:{status:'APPROVED'}});
  for(const vendor of vendors)for(const dayOfWeek of [0,1,2,3,4,5,6])await db.vendorSchedule.upsert({where:{vendorId_dayOfWeek:{vendorId:vendor.id,dayOfWeek}},create:{vendorId:vendor.id,dayOfWeek,startMinute:0,endMinute:1439,timezone:'Asia/Dhaka'},update:{startMinute:0,endMinute:1439,timezone:'Asia/Dhaka',enabled:true}});
  for(const followingId of [nabilaId,farhanId,tasniaId])await db.follow.upsert({where:{followerId_followingId:{followerId:memberId,followingId}},create:{followerId:memberId,followingId},update:{}});
  await db.connection.upsert({where:{requesterId_recipientId:{requesterId:memberId,recipientId:nabilaId}},create:{requesterId:memberId,recipientId:nabilaId,status:'ACCEPTED',respondedAt:new Date()},update:{status:'ACCEPTED',respondedAt:new Date()}});
  await db.connection.upsert({where:{requesterId_recipientId:{requesterId:farhanId,recipientId:memberId}},create:{requesterId:farhanId,recipientId:memberId,status:'PENDING'},update:{status:'PENDING',respondedAt:null}});
  const conversation=await db.conversation.upsert({where:{userOneId_userTwoId:{userOneId:memberId,userTwoId:nabilaId}},create:{id:'10000000-0000-4000-8000-000000000001',userOneId:memberId,userTwoId:nabilaId,vendorId:nabila.id,lastMessageAt:new Date()},update:{active:true,vendorId:nabila.id,lastMessageAt:new Date()}});
  const messages=[
    {id:'11000000-0000-4000-8000-000000000001',senderId:nabilaId,receiverId:memberId,content:'Welcome to SocialConnect! What would you enjoy talking about today?',key:'seed:chat:welcome'},
    {id:'11000000-0000-4000-8000-000000000002',senderId:memberId,receiverId:nabilaId,content:'I would love to hear about your favourite places in Bangladesh.',key:'seed:chat:reply'},
    {id:'11000000-0000-4000-8000-000000000003',senderId:nabilaId,receiverId:memberId,content:'Wonderful — Sylhet and Bandarban are both full of stories.',key:'seed:chat:answer'},
  ];
  for(const item of messages)await db.message.upsert({where:{idempotencyKey:item.key},create:{id:item.id,conversationId:conversation.id,senderId:item.senderId,receiverId:item.receiverId,type:'TEXT',content:item.content,status:'READ',readAt:new Date(),idempotencyKey:item.key},update:{content:item.content,status:'READ',readAt:new Date()}});
  const notices=[
    {id:'12000000-0000-4000-8000-000000000001',type:'WELCOME',title:'Welcome to SocialConnect',body:'Discover verified creators and make your first meaningful connection.'},
    {id:'12000000-0000-4000-8000-000000000002',type:'PROMOTIONAL_OFFER',title:'Your demo points are ready',body:'Use your promotional balance to preview packages and digital gifts.'},
    {id:'12000000-0000-4000-8000-000000000003',type:'CONNECTION_REQUEST',title:'New connection request',body:'Farhan would like to connect with you.'},
  ];
  for(const notice of notices)await db.notification.upsert({where:{id:notice.id},create:{...notice,userId:memberId,data:{seeded:true}},update:{title:notice.title,body:notice.body,data:{seeded:true}}});
  const ticket=await db.supportTicket.upsert({where:{id:'13000000-0000-4000-8000-000000000001'},create:{id:'13000000-0000-4000-8000-000000000001',userId:memberId,assignedToId:adminId,subject:'How does call billing work?',category:'CALL',status:'RESOLVED',resolvedAt:new Date()},update:{assignedToId:adminId,status:'RESOLVED',resolvedAt:new Date()}});
  for(const message of [{id:'13100000-0000-4000-8000-000000000001',senderId:memberId,body:'Can I see the remaining time before a paid call ends?'},{id:'13100000-0000-4000-8000-000000000002',senderId:adminId,body:'Yes. The active-call screen shows backend-authoritative remaining time and warns you before the allowance finishes.'}])await db.supportMessage.upsert({where:{id:message.id},create:{...message,ticketId:ticket.id},update:{body:message.body}});
}

  async function seedPerson(input: { id: string; phone: string; email?: string; username: string; name: string; password?: string; role?: Role; city: string; languages: string[]; interests: string[]; bio: string; avatar?: string; vendor?: { rate: number; chat: number; rating: number; online: boolean; approvedAt?: Date } }) {
  const passwordHash = await argon2.hash(input.password ?? 'Demo123!');
  const avatarUrl = input.avatar ?? `https://api.dicebear.com/7.x/avataaars/png?seed=${input.username}&size=512`;
  const user = await db.user.upsert({
    where: { phone: input.phone },
    create: { id: input.id, phone: input.phone, email: input.email, passwordHash, role: input.role ?? (input.vendor ? 'VENDOR' : 'USER'), status: 'ACTIVE', phoneVerifiedAt: new Date(), emailVerifiedAt: input.email ? new Date() : null, termsAcceptedAt: new Date(), dateOfBirth: new Date('1995-06-15'), profile: { create: { username: input.username, displayName: input.name, city: input.city, country: 'Bangladesh', languages: input.languages, interests: input.interests, bio: input.bio, isVerified: Boolean(input.vendor), avatarUrl } }, wallet: { create: { purchased: (input.email === 'pino@gmail.com' || input.email === 'mahamud@gmail.com') ? 2000 : 0, promotional: 500 } } },
    update: { passwordHash, role: input.role ?? (input.vendor ? 'VENDOR' : 'USER'), status: 'ACTIVE', email: input.email },
    include: { wallet: true },
  });
  await db.profile.update({ where: { userId: user.id }, data: { displayName: input.name, city: input.city, languages: input.languages, interests: input.interests, bio: input.bio, isVerified: Boolean(input.vendor), avatarUrl } });
  if (user.wallet) await db.walletLedger.upsert({ where: { idempotencyKey: `seed:${user.id}:welcome` }, create: { walletId: user.wallet.id, userId: user.id, type: 'PROMOTIONAL_BONUS', direction: 'CREDIT', amount: 500, balanceBefore: 0, balanceAfter: 500, referenceType: 'SEED', referenceId: user.id, description: 'Demo welcome balance', idempotencyKey: `seed:${user.id}:welcome` }, update: {} });
  if (input.vendor) { const approvedAt = input.vendor.approvedAt ?? new Date(); await db.vendorProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, status: 'APPROVED', legalName: input.name, commissionPercent: 60, voiceRatePerMinute: input.vendor.rate, videoRatePerMinute: input.vendor.rate * 2, voiceCallEnabled: true, videoCallEnabled: true, paidChatRate: input.vendor.chat, availableForCall: input.vendor.online, breakActive:false,autoAcceptCalls:false,maximumDailyCalls:25,minimumCallerBalance:input.vendor.rate*5,averageRating: input.vendor.rating, approvedAt }, update: { status: 'APPROVED', voiceRatePerMinute: input.vendor.rate, videoRatePerMinute: input.vendor.rate * 2, voiceCallEnabled: true, videoCallEnabled: true, paidChatRate: input.vendor.chat, availableForCall: input.vendor.online,breakActive:false,autoAcceptCalls:false,maximumDailyCalls:25,minimumCallerBalance:input.vendor.rate*5,averageRating: input.vendor.rating, approvedAt } }); }
  return user;
}

async function main() {
  await seedCatalog();
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? '01900000000';
  await seedPerson({ id: '00000000-0000-4000-8000-000000000001', phone: adminPhone, username: 'admin', name: 'SocialConnect Admin', password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!', role: 'ADMIN', city: 'Dhaka', languages: ['Bangla', 'English'], interests: ['Community', 'Safety'], bio: 'Platform operations account.' });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000002', phone: '01810000001', username: 'nabila', name: 'Nabila Rahman', city: 'Dhaka', languages: ['Bangla', 'English'], interests: ['Travel', 'Books', 'Coffee', 'Talk'], bio: 'Travel storyteller, book lover and friendly listener.', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face', vendor: { rate: 20, chat: 2, rating: 4.9, online: true, approvedAt: new Date(Date.now() - 30 * 86400000) } });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000003', phone: '01810000002', username: 'farhan', name: 'Farhan Ahmed', city: 'Chattogram', languages: ['Bangla', 'English', 'Hindi'], interests: ['Music', 'Fitness', 'Movies', 'Gaming'], bio: 'Musician and fitness enthusiast. Let\'s talk about your next big goal.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face', vendor: { rate: 25, chat: 3, rating: 4.8, online: true, approvedAt: new Date(Date.now() - 20 * 86400000) } });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000004', phone: '01810000003', username: 'tasnia', name: 'Tasnia Noor', city: 'Sylhet', languages: ['Bangla', 'English'], interests: ['Cooking', 'Wellness', 'Art', 'Talk'], bio: 'Warm conversations about food, art and everyday wellbeing.', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face', vendor: { rate: 18, chat: 2, rating: 4.7, online: false, approvedAt: new Date(Date.now() - 15 * 86400000) } });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000005', phone: '01810000004', username: 'demo', name: 'Demo Member', role: 'USER', city: 'Dhaka', languages: ['Bangla', 'English'], interests: ['Technology', 'Gaming'], bio: 'Exploring new people and conversations.' });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000006', phone: '01810000005', username: 'moderator', name: 'Safety Moderator', password: process.env.SEED_STAFF_PASSWORD ?? 'Staff123!', role: 'MODERATOR', city: 'Dhaka', languages: ['Bangla', 'English'], interests: ['Safety', 'Community'], bio: 'Demo moderation and trust account.' });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000007', phone: '01810000006', username: 'finance', name: 'Finance Manager', password: process.env.SEED_STAFF_PASSWORD ?? 'Staff123!', role: 'FINANCE', city: 'Dhaka', languages: ['Bangla', 'English'], interests: ['Finance', 'Operations'], bio: 'Demo finance operations account.' });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000008', phone: '01810000007', username: 'sadia', name: 'Sadia Karim', city: 'Rajshahi', languages: ['Bangla', 'English'], interests: ['Photography', 'Nature', 'Culture', 'Music'], bio: 'Photographer sharing gentle conversations about creativity and culture.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face', vendor: { rate: 22, chat: 3, rating: 4.85, online: true, approvedAt: new Date(Date.now() - 7 * 86400000) } });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000009', phone: '01810000008', username: 'arif', name: 'Arif Hasan', city: 'Khulna', languages: ['Bangla', 'English'], interests: ['Career', 'Technology', 'Startups', 'Gaming', 'Talk'], bio: 'Product builder who enjoys practical career and technology conversations.', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face', vendor: { rate: 28, chat: 4, rating: 4.75, online: true, approvedAt: new Date(Date.now() - 1 * 86400000) } });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000010', phone: '01810000009', username: 'mahin', name: 'Mahin Chowdhury', role: 'USER', city: 'Barishal', languages: ['Bangla'], interests: ['Cricket', 'Music'], bio: 'Here to meet kind people and discover new perspectives.' });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000011', phone: '01810000010', email: 'pino@gmail.com', username: 'pino', name: 'Pino', role: 'USER', city: 'Dhaka', languages: ['Bangla', 'English'], interests: ['Travel', 'Music', 'Food'], bio: 'Love exploring new conversations and meeting interesting people.' });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000012', phone: '01810000011', email: 'mahamud@gmail.com', username: 'mahamud', name: 'Mahamud', role: 'USER', city: 'Dhaka', languages: ['Bangla', 'English'], interests: ['Technology', 'Fitness', 'Music', 'Gaming'], bio: 'Tech enthusiast who loves fitness, music and great conversations.' });
  for (const setting of [{ key: 'DEFAULT_VENDOR_COMMISSION', value: { percent: 60 } }, { key: 'EARNING_HOLD_DAYS', value: { days: 7 } }, { key: 'CALL_GRACE_SECONDS', value: { seconds: 30 } }, { key: 'BILLING_ROUNDING', value: { method: 'EXACT_SECOND' } }, { key: 'POINT_CONVERSION', value: { currencyMinorUnitsPerPoint: 100, currency: 'BDT' } }, { key: 'WITHDRAWAL_RULES', value: { minimum: 500, maximumDaily: 50000, feePoints: 0, requiredAccountAgeDays: 0, requiredCompletedCalls: 0, requiredIdentityVerification: false } }]) await db.setting.upsert({ where: { key: setting.key }, create: { ...setting, description: 'Seeded platform default' }, update: { value: setting.value } });
  for (const item of [{ term: 'pay me outside', category: 'EXTERNAL_PAYMENT' }, { term: 'send money directly', category: 'EXTERNAL_PAYMENT' }, { term: 'whatsapp me', category: 'CONTACT_SHARING' }, { term: 'telegram me', category: 'CONTACT_SHARING' }]) await db.blockedTerm.upsert({ where: { term: item.term }, create: { ...item, severity: 'BLOCK' }, update: { category: item.category, severity: 'BLOCK', active: true } });
  await seedCommunity();
  await seedPinoData();
  await seedMahamudData();
}

async function seedPinoData() {
  const pinoId = '00000000-0000-4000-8000-000000000011';
  const nabilaId = '00000000-0000-4000-8000-000000000002';
  const farhanId = '00000000-0000-4000-8000-000000000003';
  const sadiaId = '00000000-0000-4000-8000-000000000008';
  const arifId = '00000000-0000-4000-8000-000000000009';

  const nabila = await db.vendorProfile.findUniqueOrThrow({ where: { userId: nabilaId } });
  const farhan = await db.vendorProfile.findUniqueOrThrow({ where: { userId: farhanId } });
  const sadia = await db.vendorProfile.findUniqueOrThrow({ where: { userId: sadiaId } });
  const arif = await db.vendorProfile.findUniqueOrThrow({ where: { userId: arifId } });

  // Follow vendors
  for (const followingId of [nabilaId, farhanId, sadiaId]) {
    await db.follow.upsert({ where: { followerId_followingId: { followerId: pinoId, followingId } }, create: { followerId: pinoId, followingId }, update: {} });
  }

  // Connections
  await db.connection.upsert({ where: { requesterId_recipientId: { requesterId: pinoId, recipientId: nabilaId } }, create: { requesterId: pinoId, recipientId: nabilaId, status: 'ACCEPTED', respondedAt: new Date() }, update: { status: 'ACCEPTED', respondedAt: new Date() } });
  await db.connection.upsert({ where: { requesterId_recipientId: { requesterId: pinoId, recipientId: farhanId } }, create: { requesterId: pinoId, recipientId: farhanId, status: 'ACCEPTED', respondedAt: new Date() }, update: { status: 'ACCEPTED', respondedAt: new Date() } });

  // ── Chat conversations ──

  // Conversation with Nabila
  const convNabila = await db.conversation.upsert({
    where: { userOneId_userTwoId: { userOneId: nabilaId, userTwoId: pinoId } },
    create: { id: '20000000-0000-4000-8000-000000000001', userOneId: nabilaId, userTwoId: pinoId, vendorId: nabila.id, lastMessageAt: new Date() },
    update: { active: true, vendorId: nabila.id, lastMessageAt: new Date() },
  });
  const chatNabila = [
    { id: '21000000-0000-4000-8000-000000000001', senderId: pinoId, receiverId: nabilaId, content: 'Hi Nabila! I saw your profile and wanted to chat about travel.', key: 'seed:pino:nabila:1' },
    { id: '21000000-0000-4000-8000-000000000002', senderId: nabilaId, receiverId: pinoId, content: 'Hey Pino! Welcome — I love talking about travel. Have you been to Cox\'s Bazar?', key: 'seed:pino:nabila:2' },
    { id: '21000000-0000-4000-8000-000000000003', senderId: pinoId, receiverId: nabilaId, content: 'Yes! Last year. The sunset was incredible. What is your favourite spot there?', key: 'seed:pino:nabila:3' },
    { id: '21000000-0000-4000-8000-000000000004', senderId: nabilaId, receiverId: pinoId, content: 'Inani Beach is my favourite — much quieter than the main beach. You should try it!', key: 'seed:pino:nabila:4' },
    { id: '21000000-0000-4000-8000-000000000005', senderId: pinoId, receiverId: nabilaId, content: 'Sounds amazing, adding it to my list!', key: 'seed:pino:nabila:5' },
  ];
  for (const m of chatNabila) await db.message.upsert({ where: { idempotencyKey: m.key }, create: { id: m.id, conversationId: convNabila.id, senderId: m.senderId, receiverId: m.receiverId, type: 'TEXT', content: m.content, status: 'READ', readAt: new Date(), idempotencyKey: m.key }, update: { content: m.content, status: 'READ', readAt: new Date() } });

  // Conversation with Farhan
  const convFarhan = await db.conversation.upsert({
    where: { userOneId_userTwoId: { userOneId: farhanId, userTwoId: pinoId } },
    create: { id: '20000000-0000-4000-8000-000000000002', userOneId: farhanId, userTwoId: pinoId, vendorId: farhan.id, lastMessageAt: new Date() },
    update: { active: true, vendorId: farhan.id, lastMessageAt: new Date() },
  });
  const chatFarhan = [
    { id: '21000000-0000-4000-8000-000000000010', senderId: pinoId, receiverId: farhanId, content: 'Farhan bhai, I heard you are great at music. What instruments do you play?', key: 'seed:pino:farhan:1' },
    { id: '21000000-0000-4000-8000-000000000011', senderId: farhanId, receiverId: pinoId, content: 'Guitar and keyboard mostly. I have been playing since I was 12!', key: 'seed:pino:farhan:2' },
    { id: '21000000-0000-4000-8000-000000000012', senderId: pinoId, receiverId: farhanId, content: 'That is awesome. Any favourite genre?', key: 'seed:pino:farhan:3' },
    { id: '21000000-0000-4000-8000-000000000013', senderId: farhanId, receiverId: pinoId, content: 'I love fusion — mixing Bengali folk with modern beats. It is a lot of fun!', key: 'seed:pino:farhan:4' },
  ];
  for (const m of chatFarhan) await db.message.upsert({ where: { idempotencyKey: m.key }, create: { id: m.id, conversationId: convFarhan.id, senderId: m.senderId, receiverId: m.receiverId, type: 'TEXT', content: m.content, status: 'READ', readAt: new Date(), idempotencyKey: m.key }, update: { content: m.content, status: 'READ', readAt: new Date() } });

  // Conversation with Sadia
  const convSadia = await db.conversation.upsert({
    where: { userOneId_userTwoId: { userOneId: pinoId, userTwoId: sadiaId } },
    create: { id: '20000000-0000-4000-8000-000000000003', userOneId: pinoId, userTwoId: sadiaId, vendorId: sadia.id, lastMessageAt: new Date() },
    update: { active: true, vendorId: sadia.id, lastMessageAt: new Date() },
  });
  const chatSadia = [
    { id: '21000000-0000-4000-8000-000000000020', senderId: pinoId, receiverId: sadiaId, content: 'Hi Sadia! Your photography looks stunning.', key: 'seed:pino:sadia:1' },
    { id: '21000000-0000-4000-8000-000000000021', senderId: sadiaId, receiverId: pinoId, content: 'Thank you so much, Pino! Do you enjoy photography too?', key: 'seed:pino:sadia:2' },
    { id: '21000000-0000-4000-8000-000000000022', senderId: pinoId, receiverId: sadiaId, content: 'I am just starting out. Would love some tips sometime!', key: 'seed:pino:sadia:3' },
  ];
  for (const m of chatSadia) await db.message.upsert({ where: { idempotencyKey: m.key }, create: { id: m.id, conversationId: convSadia.id, senderId: m.senderId, receiverId: m.receiverId, type: 'TEXT', content: m.content, status: 'READ', readAt: new Date(), idempotencyKey: m.key }, update: { content: m.content, status: 'READ', readAt: new Date() } });

  // ── Call sessions ──

  // Completed voice call with Nabila
  const now = new Date();
  const callNabilaConnected = new Date(now.getTime() - 3 * 86400000); // 3 days ago
  const callNabilaDuration = 245; // 4 min 5 sec
  await db.callSession.upsert({
    where: { idempotencyKey: 'seed:pino:call:nabila:1' },
    create: {
      id: '30000000-0000-4000-8000-000000000001', callerId: pinoId, vendorId: nabila.id, callType: 'VOICE', status: 'COMPLETED',
      ratePerMinute: nabila.voiceRatePerMinute, reservedAmount: nabila.voiceRatePerMinute * 5, prepaidSeconds: 0,
      paymentSourceType: 'WALLET', connectedAt: callNabilaConnected, lastHeartbeatAt: new Date(callNabilaConnected.getTime() + callNabilaDuration * 1000),
      lastHeartbeatSeconds: callNabilaDuration, endedAt: new Date(callNabilaConnected.getTime() + callNabilaDuration * 1000),
      durationSeconds: callNabilaDuration, billedSeconds: callNabilaDuration,
      grossAmount: Math.ceil((callNabilaDuration * nabila.voiceRatePerMinute) / 60),
      vendorAmount: Math.floor((Math.ceil((callNabilaDuration * nabila.voiceRatePerMinute) / 60) * nabila.commissionPercent) / 100),
      platformAmount: Math.ceil((callNabilaDuration * nabila.voiceRatePerMinute) / 60) - Math.floor((Math.ceil((callNabilaDuration * nabila.voiceRatePerMinute) / 60) * nabila.commissionPercent) / 100),
      endedBy: pinoId, idempotencyKey: 'seed:pino:call:nabila:1',
    },
    update: {},
  });

  // Completed video call with Farhan
  const callFarhanConnected = new Date(now.getTime() - 2 * 86400000); // 2 days ago
  const callFarhanDuration = 180; // 3 min
  await db.callSession.upsert({
    where: { idempotencyKey: 'seed:pino:call:farhan:1' },
    create: {
      id: '30000000-0000-4000-8000-000000000002', callerId: pinoId, vendorId: farhan.id, callType: 'VIDEO', status: 'COMPLETED',
      ratePerMinute: farhan.videoRatePerMinute, reservedAmount: farhan.videoRatePerMinute * 5, prepaidSeconds: 0,
      paymentSourceType: 'WALLET', connectedAt: callFarhanConnected, lastHeartbeatAt: new Date(callFarhanConnected.getTime() + callFarhanDuration * 1000),
      lastHeartbeatSeconds: callFarhanDuration, endedAt: new Date(callFarhanConnected.getTime() + callFarhanDuration * 1000),
      durationSeconds: callFarhanDuration, billedSeconds: callFarhanDuration,
      grossAmount: Math.ceil((callFarhanDuration * farhan.videoRatePerMinute) / 60),
      vendorAmount: Math.floor((Math.ceil((callFarhanDuration * farhan.videoRatePerMinute) / 60) * farhan.commissionPercent) / 100),
      platformAmount: Math.ceil((callFarhanDuration * farhan.videoRatePerMinute) / 60) - Math.floor((Math.ceil((callFarhanDuration * farhan.videoRatePerMinute) / 60) * farhan.commissionPercent) / 100),
      endedBy: pinoId, idempotencyKey: 'seed:pino:call:farhan:1',
    },
    update: {},
  });

  // Completed voice call with Arif
  const callArifConnected = new Date(now.getTime() - 86400000); // 1 day ago
  const callArifDuration = 320; // 5 min 20 sec
  await db.callSession.upsert({
    where: { idempotencyKey: 'seed:pino:call:arif:1' },
    create: {
      id: '30000000-0000-4000-8000-000000000003', callerId: pinoId, vendorId: arif.id, callType: 'VOICE', status: 'COMPLETED',
      ratePerMinute: arif.voiceRatePerMinute, reservedAmount: arif.voiceRatePerMinute * 6, prepaidSeconds: 0,
      paymentSourceType: 'WALLET', connectedAt: callArifConnected, lastHeartbeatAt: new Date(callArifConnected.getTime() + callArifDuration * 1000),
      lastHeartbeatSeconds: callArifDuration, endedAt: new Date(callArifConnected.getTime() + callArifDuration * 1000),
      durationSeconds: callArifDuration, billedSeconds: callArifDuration,
      grossAmount: Math.ceil((callArifDuration * arif.voiceRatePerMinute) / 60),
      vendorAmount: Math.floor((Math.ceil((callArifDuration * arif.voiceRatePerMinute) / 60) * arif.commissionPercent) / 100),
      platformAmount: Math.ceil((callArifDuration * arif.voiceRatePerMinute) / 60) - Math.floor((Math.ceil((callArifDuration * arif.voiceRatePerMinute) / 60) * arif.commissionPercent) / 100),
      endedBy: pinoId, idempotencyKey: 'seed:pino:call:arif:1',
    },
    update: {},
  });

  // Missed call with Sadia
  const callSadiaRequested = new Date(now.getTime() - 4 * 3600000); // 4 hours ago
  await db.callSession.upsert({
    where: { idempotencyKey: 'seed:pino:call:sadia:missed' },
    create: {
      id: '30000000-0000-4000-8000-000000000004', callerId: pinoId, vendorId: sadia.id, callType: 'VOICE', status: 'MISSED',
      ratePerMinute: sadia.voiceRatePerMinute, reservedAmount: sadia.voiceRatePerMinute * 5, prepaidSeconds: 0,
      paymentSourceType: 'WALLET', endedAt: new Date(callSadiaRequested.getTime() + 60000),
      durationSeconds: 0, billedSeconds: 0, grossAmount: 0, vendorAmount: 0, platformAmount: 0,
      endedBy: pinoId, disconnectReason: 'NO_ANSWER', idempotencyKey: 'seed:pino:call:sadia:missed',
    },
    update: {},
  });

  // Reviews for completed calls
  await db.review.upsert({
    where: { callId: '30000000-0000-4000-8000-000000000001' },
    create: { reviewerId: pinoId, vendorId: nabila.id, callId: '30000000-0000-4000-8000-000000000001', rating: 5, behaviourRating: 5, qualityRating: 5, comment: 'Wonderful conversation about travel in Bangladesh!' },
    update: {},
  });
  await db.review.upsert({
    where: { callId: '30000000-0000-4000-8000-000000000002' },
    create: { reviewerId: pinoId, vendorId: farhan.id, callId: '30000000-0000-4000-8000-000000000002', rating: 4, behaviourRating: 5, qualityRating: 4, comment: 'Great video call, Farhan is very knowledgeable about music.' },
    update: {},
  });

  // Notifications for pino
  const pinoNotices = [
    { id: '22000000-0000-4000-8000-000000000001', type: 'WELCOME', title: 'Welcome to SocialConnect', body: 'Start exploring creators and make your first call!' },
    { id: '22000000-0000-4000-8000-000000000002', type: 'CALL_ENDED', title: 'Call completed', body: 'Your voice call with Nabila has ended. Rate your experience!' },
    { id: '22000000-0000-4000-8000-000000000003', type: 'MESSAGE', title: 'New message from Farhan', body: 'Hey Pino, great talking to you!' },
    { id: '22000000-0000-4000-8000-000000000004', type: 'MISSED_CALL', title: 'Missed call', body: 'Your call to Sadia was not answered.' },
  ];
  for (const notice of pinoNotices) await db.notification.upsert({ where: { id: notice.id }, create: { ...notice, userId: pinoId, data: { seeded: true } }, update: { title: notice.title, body: notice.body, data: { seeded: true } } });
}

async function seedMahamudData() {
  const mahamudId = '00000000-0000-4000-8000-000000000012';
  const nabilaId = '00000000-0000-4000-8000-000000000002';
  const farhanId = '00000000-0000-4000-8000-000000000003';
  const tasniaId = '00000000-0000-4000-8000-000000000004';
  const sadiaId = '00000000-0000-4000-8000-000000000008';
  const arifId = '00000000-0000-4000-8000-000000000009';

  const nabila = await db.vendorProfile.findUniqueOrThrow({ where: { userId: nabilaId } });
  const farhan = await db.vendorProfile.findUniqueOrThrow({ where: { userId: farhanId } });
  const tasnia = await db.vendorProfile.findUniqueOrThrow({ where: { userId: tasniaId } });
  const sadia = await db.vendorProfile.findUniqueOrThrow({ where: { userId: sadiaId } });
  const arif = await db.vendorProfile.findUniqueOrThrow({ where: { userId: arifId } });

  // Follow all vendors
  for (const followingId of [nabilaId, farhanId, tasniaId, sadiaId, arifId]) {
    await db.follow.upsert({ where: { followerId_followingId: { followerId: mahamudId, followingId } }, create: { followerId: mahamudId, followingId }, update: {} });
  }

  // Connections
  await db.connection.upsert({ where: { requesterId_recipientId: { requesterId: mahamudId, recipientId: nabilaId } }, create: { requesterId: mahamudId, recipientId: nabilaId, status: 'ACCEPTED', respondedAt: new Date() }, update: { status: 'ACCEPTED', respondedAt: new Date() } });
  await db.connection.upsert({ where: { requesterId_recipientId: { requesterId: mahamudId, recipientId: farhanId } }, create: { requesterId: mahamudId, recipientId: farhanId, status: 'ACCEPTED', respondedAt: new Date() }, update: { status: 'ACCEPTED', respondedAt: new Date() } });
  await db.connection.upsert({ where: { requesterId_recipientId: { requesterId: mahamudId, recipientId: arifId } }, create: { requesterId: mahamudId, recipientId: arifId, status: 'ACCEPTED', respondedAt: new Date() }, update: { status: 'ACCEPTED', respondedAt: new Date() } });

  // ── Chat conversations ──

  // Conversation with Nabila
  const convNabila = await db.conversation.upsert({
    where: { userOneId_userTwoId: { userOneId: nabilaId, userTwoId: mahamudId } },
    create: { id: '20000000-0000-4000-8000-000000000101', userOneId: nabilaId, userTwoId: mahamudId, vendorId: nabila.id, lastMessageAt: new Date() },
    update: { active: true, vendorId: nabila.id, lastMessageAt: new Date() },
  });
  const chatNabila = [
    { id: '21000000-0000-4000-8000-000000000101', senderId: mahamudId, receiverId: nabilaId, content: 'Hi Nabila! I love reading about your travel stories.', key: 'seed:mahamud:nabila:1' },
    { id: '21000000-0000-4000-8000-000000000102', senderId: nabilaId, receiverId: mahamudId, content: 'Hey Mahamud! Thanks for reaching out. Where would you like to travel next?', key: 'seed:mahamud:nabila:2' },
    { id: '21000000-0000-4000-8000-000000000103', senderId: mahamudId, receiverId: nabilaId, content: 'I have been wanting to visit Bandarban. Any recommendations?', key: 'seed:mahamud:nabila:3' },
    { id: '21000000-0000-4000-8000-000000000104', senderId: nabilaId, receiverId: mahamudId, content: 'Bandarban is magical! Do not miss Nilgiri and the Boga Lake. I can share more tips on a call.', key: 'seed:mahamud:nabila:4' },
  ];
  for (const m of chatNabila) await db.message.upsert({ where: { idempotencyKey: m.key }, create: { id: m.id, conversationId: convNabila.id, senderId: m.senderId, receiverId: m.receiverId, type: 'TEXT', content: m.content, status: 'READ', readAt: new Date(), idempotencyKey: m.key }, update: { content: m.content, status: 'READ', readAt: new Date() } });

  // Conversation with Farhan
  const convFarhan = await db.conversation.upsert({
    where: { userOneId_userTwoId: { userOneId: farhanId, userTwoId: mahamudId } },
    create: { id: '20000000-0000-4000-8000-000000000102', userOneId: farhanId, userTwoId: mahamudId, vendorId: farhan.id, lastMessageAt: new Date() },
    update: { active: true, vendorId: farhan.id, lastMessageAt: new Date() },
  });
  const chatFarhan = [
    { id: '21000000-0000-4000-8000-000000000110', senderId: mahamudId, receiverId: farhanId, content: 'Farhan bhai, I am into fitness too. What is your workout routine?', key: 'seed:mahamud:farhan:1' },
    { id: '21000000-0000-4000-8000-000000000111', senderId: farhanId, receiverId: mahamudId, content: 'I do a mix of weight training and cardio 5 days a week. Music keeps me motivated!', key: 'seed:mahamud:farhan:2' },
    { id: '21000000-0000-4000-8000-000000000112', senderId: mahamudId, receiverId: farhanId, content: 'That sounds solid. Do you have a favourite playlist for workouts?', key: 'seed:mahamud:farhan:3' },
  ];
  for (const m of chatFarhan) await db.message.upsert({ where: { idempotencyKey: m.key }, create: { id: m.id, conversationId: convFarhan.id, senderId: m.senderId, receiverId: m.receiverId, type: 'TEXT', content: m.content, status: 'READ', readAt: new Date(), idempotencyKey: m.key }, update: { content: m.content, status: 'READ', readAt: new Date() } });

  // Conversation with Arif
  const convArif = await db.conversation.upsert({
    where: { userOneId_userTwoId: { userOneId: arifId, userTwoId: mahamudId } },
    create: { id: '20000000-0000-4000-8000-000000000103', userOneId: arifId, userTwoId: mahamudId, vendorId: arif.id, lastMessageAt: new Date() },
    update: { active: true, vendorId: arif.id, lastMessageAt: new Date() },
  });
  const chatArif = [
    { id: '21000000-0000-4000-8000-000000000120', senderId: mahamudId, receiverId: arifId, content: 'Hi Arif! I saw you are into tech and startups. I am building something myself.', key: 'seed:mahamud:arif:1' },
    { id: '21000000-0000-4000-8000-000000000121', senderId: arifId, receiverId: mahamudId, content: 'That is great to hear, Mahamud! What are you building? I would love to chat about it.', key: 'seed:mahamud:arif:2' },
    { id: '21000000-0000-4000-8000-000000000122', senderId: mahamudId, receiverId: arifId, content: 'A fitness tracking app with social features. Could really use your perspective!', key: 'seed:mahamud:arif:3' },
    { id: '21000000-0000-4000-8000-000000000123', senderId: arifId, receiverId: mahamudId, content: 'Sounds promising! Let us schedule a call to go over the product strategy.', key: 'seed:mahamud:arif:4' },
    { id: '21000000-0000-4000-8000-000000000124', senderId: mahamudId, receiverId: arifId, content: 'Absolutely, booking one soon!', key: 'seed:mahamud:arif:5' },
  ];
  for (const m of chatArif) await db.message.upsert({ where: { idempotencyKey: m.key }, create: { id: m.id, conversationId: convArif.id, senderId: m.senderId, receiverId: m.receiverId, type: 'TEXT', content: m.content, status: 'READ', readAt: new Date(), idempotencyKey: m.key }, update: { content: m.content, status: 'READ', readAt: new Date() } });

  // Conversation with Sadia
  const convSadia = await db.conversation.upsert({
    where: { userOneId_userTwoId: { userOneId: mahamudId, userTwoId: sadiaId } },
    create: { id: '20000000-0000-4000-8000-000000000104', userOneId: mahamudId, userTwoId: sadiaId, vendorId: sadia.id, lastMessageAt: new Date() },
    update: { active: true, vendorId: sadia.id, lastMessageAt: new Date() },
  });
  const chatSadia = [
    { id: '21000000-0000-4000-8000-000000000130', senderId: mahamudId, receiverId: sadiaId, content: 'Hi Sadia! Your nature photography from Rajshahi is beautiful.', key: 'seed:mahamud:sadia:1' },
    { id: '21000000-0000-4000-8000-000000000131', senderId: sadiaId, receiverId: mahamudId, content: 'Thank you, Mahamud! Rajshahi has so many hidden gems for photography.', key: 'seed:mahamud:sadia:2' },
  ];
  for (const m of chatSadia) await db.message.upsert({ where: { idempotencyKey: m.key }, create: { id: m.id, conversationId: convSadia.id, senderId: m.senderId, receiverId: m.receiverId, type: 'TEXT', content: m.content, status: 'READ', readAt: new Date(), idempotencyKey: m.key }, update: { content: m.content, status: 'READ', readAt: new Date() } });

  // Conversation with Tasnia
  const convTasnia = await db.conversation.upsert({
    where: { userOneId_userTwoId: { userOneId: mahamudId, userTwoId: tasniaId } },
    create: { id: '20000000-0000-4000-8000-000000000105', userOneId: mahamudId, userTwoId: tasniaId, vendorId: tasnia.id, lastMessageAt: new Date() },
    update: { active: true, vendorId: tasnia.id, lastMessageAt: new Date() },
  });
  const chatTasnia = [
    { id: '21000000-0000-4000-8000-000000000140', senderId: mahamudId, receiverId: tasniaId, content: 'Hi Tasnia! I am trying to eat healthier. Any quick recipes?', key: 'seed:mahamud:tasnia:1' },
    { id: '21000000-0000-4000-8000-000000000141', senderId: tasniaId, receiverId: mahamudId, content: 'Of course! A simple dal with spinach and lemon is a great start. Want more ideas?', key: 'seed:mahamud:tasnia:2' },
    { id: '21000000-0000-4000-8000-000000000142', senderId: mahamudId, receiverId: tasniaId, content: 'Yes please! I would love to hear more on a call.', key: 'seed:mahamud:tasnia:3' },
  ];
  for (const m of chatTasnia) await db.message.upsert({ where: { idempotencyKey: m.key }, create: { id: m.id, conversationId: convTasnia.id, senderId: m.senderId, receiverId: m.receiverId, type: 'TEXT', content: m.content, status: 'READ', readAt: new Date(), idempotencyKey: m.key }, update: { content: m.content, status: 'READ', readAt: new Date() } });

  // ── Call sessions ──
  const now = new Date();

  // Completed voice call with Nabila (5 days ago, 6 min)
  const callNabilaTime = new Date(now.getTime() - 5 * 86400000);
  const callNabilaDur = 360;
  await db.callSession.upsert({
    where: { idempotencyKey: 'seed:mahamud:call:nabila:1' },
    create: {
      id: '30000000-0000-4000-8000-000000000101', callerId: mahamudId, vendorId: nabila.id, callType: 'VOICE', status: 'COMPLETED',
      ratePerMinute: nabila.voiceRatePerMinute, reservedAmount: nabila.voiceRatePerMinute * 6, prepaidSeconds: 0,
      paymentSourceType: 'WALLET', connectedAt: callNabilaTime, lastHeartbeatAt: new Date(callNabilaTime.getTime() + callNabilaDur * 1000),
      lastHeartbeatSeconds: callNabilaDur, endedAt: new Date(callNabilaTime.getTime() + callNabilaDur * 1000),
      durationSeconds: callNabilaDur, billedSeconds: callNabilaDur,
      grossAmount: Math.ceil((callNabilaDur * nabila.voiceRatePerMinute) / 60),
      vendorAmount: Math.floor((Math.ceil((callNabilaDur * nabila.voiceRatePerMinute) / 60) * nabila.commissionPercent) / 100),
      platformAmount: Math.ceil((callNabilaDur * nabila.voiceRatePerMinute) / 60) - Math.floor((Math.ceil((callNabilaDur * nabila.voiceRatePerMinute) / 60) * nabila.commissionPercent) / 100),
      endedBy: mahamudId, idempotencyKey: 'seed:mahamud:call:nabila:1',
    },
    update: {},
  });

  // Completed video call with Farhan (4 days ago, 4 min 30 sec)
  const callFarhanTime = new Date(now.getTime() - 4 * 86400000);
  const callFarhanDur = 270;
  await db.callSession.upsert({
    where: { idempotencyKey: 'seed:mahamud:call:farhan:1' },
    create: {
      id: '30000000-0000-4000-8000-000000000102', callerId: mahamudId, vendorId: farhan.id, callType: 'VIDEO', status: 'COMPLETED',
      ratePerMinute: farhan.videoRatePerMinute, reservedAmount: farhan.videoRatePerMinute * 5, prepaidSeconds: 0,
      paymentSourceType: 'WALLET', connectedAt: callFarhanTime, lastHeartbeatAt: new Date(callFarhanTime.getTime() + callFarhanDur * 1000),
      lastHeartbeatSeconds: callFarhanDur, endedAt: new Date(callFarhanTime.getTime() + callFarhanDur * 1000),
      durationSeconds: callFarhanDur, billedSeconds: callFarhanDur,
      grossAmount: Math.ceil((callFarhanDur * farhan.videoRatePerMinute) / 60),
      vendorAmount: Math.floor((Math.ceil((callFarhanDur * farhan.videoRatePerMinute) / 60) * farhan.commissionPercent) / 100),
      platformAmount: Math.ceil((callFarhanDur * farhan.videoRatePerMinute) / 60) - Math.floor((Math.ceil((callFarhanDur * farhan.videoRatePerMinute) / 60) * farhan.commissionPercent) / 100),
      endedBy: mahamudId, idempotencyKey: 'seed:mahamud:call:farhan:1',
    },
    update: {},
  });

  // Completed voice call with Arif (2 days ago, 7 min)
  const callArifTime = new Date(now.getTime() - 2 * 86400000);
  const callArifDur = 420;
  await db.callSession.upsert({
    where: { idempotencyKey: 'seed:mahamud:call:arif:1' },
    create: {
      id: '30000000-0000-4000-8000-000000000103', callerId: mahamudId, vendorId: arif.id, callType: 'VOICE', status: 'COMPLETED',
      ratePerMinute: arif.voiceRatePerMinute, reservedAmount: arif.voiceRatePerMinute * 8, prepaidSeconds: 0,
      paymentSourceType: 'WALLET', connectedAt: callArifTime, lastHeartbeatAt: new Date(callArifTime.getTime() + callArifDur * 1000),
      lastHeartbeatSeconds: callArifDur, endedAt: new Date(callArifTime.getTime() + callArifDur * 1000),
      durationSeconds: callArifDur, billedSeconds: callArifDur,
      grossAmount: Math.ceil((callArifDur * arif.voiceRatePerMinute) / 60),
      vendorAmount: Math.floor((Math.ceil((callArifDur * arif.voiceRatePerMinute) / 60) * arif.commissionPercent) / 100),
      platformAmount: Math.ceil((callArifDur * arif.voiceRatePerMinute) / 60) - Math.floor((Math.ceil((callArifDur * arif.voiceRatePerMinute) / 60) * arif.commissionPercent) / 100),
      endedBy: mahamudId, idempotencyKey: 'seed:mahamud:call:arif:1',
    },
    update: {},
  });

  // Completed video call with Sadia (1 day ago, 3 min 15 sec)
  const callSadiaTime = new Date(now.getTime() - 86400000);
  const callSadiaDur = 195;
  await db.callSession.upsert({
    where: { idempotencyKey: 'seed:mahamud:call:sadia:1' },
    create: {
      id: '30000000-0000-4000-8000-000000000104', callerId: mahamudId, vendorId: sadia.id, callType: 'VIDEO', status: 'COMPLETED',
      ratePerMinute: sadia.videoRatePerMinute, reservedAmount: sadia.videoRatePerMinute * 4, prepaidSeconds: 0,
      paymentSourceType: 'WALLET', connectedAt: callSadiaTime, lastHeartbeatAt: new Date(callSadiaTime.getTime() + callSadiaDur * 1000),
      lastHeartbeatSeconds: callSadiaDur, endedAt: new Date(callSadiaTime.getTime() + callSadiaDur * 1000),
      durationSeconds: callSadiaDur, billedSeconds: callSadiaDur,
      grossAmount: Math.ceil((callSadiaDur * sadia.videoRatePerMinute) / 60),
      vendorAmount: Math.floor((Math.ceil((callSadiaDur * sadia.videoRatePerMinute) / 60) * sadia.commissionPercent) / 100),
      platformAmount: Math.ceil((callSadiaDur * sadia.videoRatePerMinute) / 60) - Math.floor((Math.ceil((callSadiaDur * sadia.videoRatePerMinute) / 60) * sadia.commissionPercent) / 100),
      endedBy: mahamudId, idempotencyKey: 'seed:mahamud:call:sadia:1',
    },
    update: {},
  });

  // Missed call with Tasnia (6 hours ago)
  const callTasniaTime = new Date(now.getTime() - 6 * 3600000);
  await db.callSession.upsert({
    where: { idempotencyKey: 'seed:mahamud:call:tasnia:missed' },
    create: {
      id: '30000000-0000-4000-8000-000000000105', callerId: mahamudId, vendorId: tasnia.id, callType: 'VOICE', status: 'MISSED',
      ratePerMinute: tasnia.voiceRatePerMinute, reservedAmount: tasnia.voiceRatePerMinute * 5, prepaidSeconds: 0,
      paymentSourceType: 'WALLET', endedAt: new Date(callTasniaTime.getTime() + 60000),
      durationSeconds: 0, billedSeconds: 0, grossAmount: 0, vendorAmount: 0, platformAmount: 0,
      endedBy: mahamudId, disconnectReason: 'NO_ANSWER', idempotencyKey: 'seed:mahamud:call:tasnia:missed',
    },
    update: {},
  });

  // Second call with Farhan (today, 2 min voice)
  const callFarhan2Time = new Date(now.getTime() - 2 * 3600000);
  const callFarhan2Dur = 120;
  await db.callSession.upsert({
    where: { idempotencyKey: 'seed:mahamud:call:farhan:2' },
    create: {
      id: '30000000-0000-4000-8000-000000000106', callerId: mahamudId, vendorId: farhan.id, callType: 'VOICE', status: 'COMPLETED',
      ratePerMinute: farhan.voiceRatePerMinute, reservedAmount: farhan.voiceRatePerMinute * 3, prepaidSeconds: 0,
      paymentSourceType: 'WALLET', connectedAt: callFarhan2Time, lastHeartbeatAt: new Date(callFarhan2Time.getTime() + callFarhan2Dur * 1000),
      lastHeartbeatSeconds: callFarhan2Dur, endedAt: new Date(callFarhan2Time.getTime() + callFarhan2Dur * 1000),
      durationSeconds: callFarhan2Dur, billedSeconds: callFarhan2Dur,
      grossAmount: Math.ceil((callFarhan2Dur * farhan.voiceRatePerMinute) / 60),
      vendorAmount: Math.floor((Math.ceil((callFarhan2Dur * farhan.voiceRatePerMinute) / 60) * farhan.commissionPercent) / 100),
      platformAmount: Math.ceil((callFarhan2Dur * farhan.voiceRatePerMinute) / 60) - Math.floor((Math.ceil((callFarhan2Dur * farhan.voiceRatePerMinute) / 60) * farhan.commissionPercent) / 100),
      endedBy: mahamudId, idempotencyKey: 'seed:mahamud:call:farhan:2',
    },
    update: {},
  });

  // Reviews for completed calls
  await db.review.upsert({
    where: { callId: '30000000-0000-4000-8000-000000000101' },
    create: { reviewerId: mahamudId, vendorId: nabila.id, callId: '30000000-0000-4000-8000-000000000101', rating: 5, behaviourRating: 5, qualityRating: 5, comment: 'Amazing travel tips for Bandarban! Nabila knows the best spots.' },
    update: {},
  });
  await db.review.upsert({
    where: { callId: '30000000-0000-4000-8000-000000000102' },
    create: { reviewerId: mahamudId, vendorId: farhan.id, callId: '30000000-0000-4000-8000-000000000102', rating: 5, behaviourRating: 5, qualityRating: 4, comment: 'Great video call! Farhan shared awesome workout and music tips.' },
    update: {},
  });
  await db.review.upsert({
    where: { callId: '30000000-0000-4000-8000-000000000103' },
    create: { reviewerId: mahamudId, vendorId: arif.id, callId: '30000000-0000-4000-8000-000000000103', rating: 4, behaviourRating: 5, qualityRating: 4, comment: 'Really insightful discussion about product strategy and startups.' },
    update: {},
  });

  // Notifications for mahamud
  const mahamudNotices = [
    { id: '22000000-0000-4000-8000-000000000101', type: 'WELCOME', title: 'Welcome to SocialConnect', body: 'Discover verified creators and start meaningful conversations!' },
    { id: '22000000-0000-4000-8000-000000000102', type: 'CALL_ENDED', title: 'Call completed', body: 'Your voice call with Nabila has ended. How was your experience?' },
    { id: '22000000-0000-4000-8000-000000000103', type: 'CALL_ENDED', title: 'Call completed', body: 'Your video call with Farhan has ended. Leave a review!' },
    { id: '22000000-0000-4000-8000-000000000104', type: 'MESSAGE', title: 'New message from Arif', body: 'Sounds promising! Let us schedule a call.' },
    { id: '22000000-0000-4000-8000-000000000105', type: 'MISSED_CALL', title: 'Missed call', body: 'Your call to Tasnia was not answered. Try again later.' },
    { id: '22000000-0000-4000-8000-000000000106', type: 'CONNECTION_ACCEPTED', title: 'Connection accepted', body: 'Arif Hasan accepted your connection request.' },
  ];
  for (const notice of mahamudNotices) await db.notification.upsert({ where: { id: notice.id }, create: { ...notice, userId: mahamudId, data: { seeded: true } }, update: { title: notice.title, body: notice.body, data: { seeded: true } } });
}

main().finally(() => db.$disconnect());
