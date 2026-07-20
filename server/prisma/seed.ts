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
  for (const [index,[id, name, iconUrl, pointPrice, vendorPercent]] of gifts.entries()) await db.digitalGift.upsert({ where: { id: `seed-${id}` }, create: { id: `seed-${id}`, name, iconUrl, pointPrice, vendorPercent,category:pointPrice>=150?'PREMIUM':'STANDARD',displayOrder:index }, update: { name, iconUrl, pointPrice, vendorPercent,category:pointPrice>=150?'PREMIUM':'STANDARD',displayOrder:index,enabledInCalls:true,enabledInChats:true,active: true } });

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

  async function seedPerson(input: { id: string; phone: string; username: string; name: string; password?: string; role?: Role; city: string; languages: string[]; interests: string[]; bio: string; avatarUrl?: string; vendor?: { rate: number; chat: number; rating: number; online: boolean } }) {
  const passwordHash = await argon2.hash(input.password ?? 'Demo123!');
  const avatarUrl = input.avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/png?seed=${input.username}&size=512`;
  const user = await db.user.upsert({
    where: { phone: input.phone },
    create: { id: input.id, phone: input.phone, passwordHash, role: input.role ?? (input.vendor ? 'VENDOR' : 'USER'), status: 'ACTIVE', phoneVerifiedAt: new Date(), termsAcceptedAt: new Date(), dateOfBirth: new Date('1995-06-15'), profile: { create: { username: input.username, displayName: input.name, city: input.city, country: 'Bangladesh', languages: input.languages, interests: input.interests, bio: input.bio, avatarUrl, isVerified: Boolean(input.vendor) } }, wallet: { create: { promotional: 500 } } },
    update: { passwordHash, role: input.role ?? (input.vendor ? 'VENDOR' : 'USER'), status: 'ACTIVE' },
    include: { wallet: true },
  });
  await db.profile.update({ where: { userId: user.id }, data: { avatarUrl } });
  if (user.wallet) await db.walletLedger.upsert({ where: { idempotencyKey: `seed:${user.id}:welcome` }, create: { walletId: user.wallet.id, userId: user.id, type: 'PROMOTIONAL_BONUS', direction: 'CREDIT', amount: 500, balanceBefore: 0, balanceAfter: 500, referenceType: 'SEED', referenceId: user.id, description: 'Demo welcome balance', idempotencyKey: `seed:${user.id}:welcome` }, update: {} });
  if (input.vendor) await db.vendorProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, status: 'APPROVED', legalName: input.name, commissionPercent: 60, voiceRatePerMinute: input.vendor.rate, videoRatePerMinute: input.vendor.rate * 2, voiceCallEnabled: true, videoCallEnabled: true, paidChatRate: input.vendor.chat, availableForCall: input.vendor.online, breakActive:false,autoAcceptCalls:false,maximumDailyCalls:25,minimumCallerBalance:input.vendor.rate*5,averageRating: input.vendor.rating, approvedAt: new Date() }, update: { status: 'APPROVED', voiceRatePerMinute: input.vendor.rate, videoRatePerMinute: input.vendor.rate * 2, voiceCallEnabled: true, videoCallEnabled: true, paidChatRate: input.vendor.chat, availableForCall: input.vendor.online,breakActive:false,autoAcceptCalls:false,maximumDailyCalls:25,minimumCallerBalance:input.vendor.rate*5,averageRating: input.vendor.rating, approvedAt: new Date() } });
  return user;
}

async function main() {
  await seedCatalog();
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? '01900000000';
  await seedPerson({ id: '00000000-0000-4000-8000-000000000001', phone: adminPhone, username: 'admin', name: 'SocialConnect Admin', password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!', role: 'ADMIN', city: 'Dhaka', languages: ['Bangla', 'English'], interests: ['Community', 'Safety'], bio: 'Platform operations account.' });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000002', phone: '01810000001', username: 'nabila', name: 'Nabila Rahman', city: 'Dhaka', languages: ['Bangla', 'English'], interests: ['Travel', 'Books', 'Coffee'], bio: 'Travel storyteller, book lover and friendly listener.', avatarUrl: 'https://i.ibb.co.com/Fb5m9tDH/Chat-GPT-Image-Jul-18-2026-07-22-45-PM.png', vendor: { rate: 20, chat: 2, rating: 4.9, online: true } });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000003', phone: '01810000002', username: 'farhan', name: 'Farhan Ahmed', city: 'Chattogram', languages: ['Bangla', 'English', 'Hindi'], interests: ['Music', 'Fitness', 'Movies'], bio: 'Musician and fitness enthusiast. Let’s talk about your next big goal.', vendor: { rate: 25, chat: 3, rating: 4.8, online: true } });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000004', phone: '01810000003', username: 'tasnia', name: 'Tasnia Noor', city: 'Sylhet', languages: ['Bangla', 'English'], interests: ['Cooking', 'Wellness', 'Art'], bio: 'Warm conversations about food, art and everyday wellbeing.', avatarUrl: 'https://i.ibb.co.com/67f5YdLz/Chat-GPT-Image-Jul-18-2026-07-09-00-PM.png', vendor: { rate: 18, chat: 2, rating: 4.7, online: false } });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000005', phone: '01810000004', username: 'demo', name: 'Demo Member', role: 'USER', city: 'Dhaka', languages: ['Bangla', 'English'], interests: ['Technology', 'Gaming'], bio: 'Exploring new people and conversations.' });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000006', phone: '01810000005', username: 'moderator', name: 'Safety Moderator', password: process.env.SEED_STAFF_PASSWORD ?? 'Staff123!', role: 'MODERATOR', city: 'Dhaka', languages: ['Bangla', 'English'], interests: ['Safety', 'Community'], bio: 'Demo moderation and trust account.' });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000007', phone: '01810000006', username: 'finance', name: 'Finance Manager', password: process.env.SEED_STAFF_PASSWORD ?? 'Staff123!', role: 'FINANCE', city: 'Dhaka', languages: ['Bangla', 'English'], interests: ['Finance', 'Operations'], bio: 'Demo finance operations account.' });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000008', phone: '01810000007', username: 'sadia', name: 'Sadia Karim', city: 'Rajshahi', languages: ['Bangla', 'English'], interests: ['Photography', 'Nature', 'Culture'], bio: 'Photographer sharing gentle conversations about creativity and culture.', avatarUrl: 'https://i.ibb.co.com/TM87pjS3/18c56a3a-4dd8-4b22-8ab6-0e3f7b615050.png', vendor: { rate: 22, chat: 3, rating: 4.85, online: true } });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000009', phone: '01810000008', username: 'arif', name: 'Arif Hasan', city: 'Khulna', languages: ['Bangla', 'English'], interests: ['Career', 'Technology', 'Startups'], bio: 'Product builder who enjoys practical career and technology conversations.', vendor: { rate: 28, chat: 4, rating: 4.75, online: true } });
  await seedPerson({ id: '00000000-0000-4000-8000-000000000010', phone: '01810000009', username: 'mahin', name: 'Mahin Chowdhury', role: 'USER', city: 'Barishal', languages: ['Bangla'], interests: ['Cricket', 'Music'], bio: 'Here to meet kind people and discover new perspectives.' });
  for (const setting of [{ key: 'DEFAULT_VENDOR_COMMISSION', value: { percent: 60 } }, { key: 'EARNING_HOLD_DAYS', value: { days: 7 } }, { key: 'CALL_GRACE_SECONDS', value: { seconds: 30 } }, { key: 'BILLING_ROUNDING', value: { method: 'EXACT_SECOND' } }, { key: 'POINT_CONVERSION', value: { currencyMinorUnitsPerPoint: 100, currency: 'BDT' } }, { key: 'WITHDRAWAL_RULES', value: { minimum: 500, maximumDaily: 50000, feePoints: 0, requiredAccountAgeDays: 0, requiredCompletedCalls: 0, requiredIdentityVerification: false } }]) await db.setting.upsert({ where: { key: setting.key }, create: { ...setting, description: 'Seeded platform default' }, update: { value: setting.value } });
  for (const item of [{ term: 'pay me outside', category: 'EXTERNAL_PAYMENT' }, { term: 'send money directly', category: 'EXTERNAL_PAYMENT' }, { term: 'whatsapp me', category: 'CONTACT_SHARING' }, { term: 'telegram me', category: 'CONTACT_SHARING' }]) await db.blockedTerm.upsert({ where: { term: item.term }, create: { ...item, severity: 'BLOCK' }, update: { category: item.category, severity: 'BLOCK', active: true } });
  await seedCommunity();
}

main().finally(() => db.$disconnect());
