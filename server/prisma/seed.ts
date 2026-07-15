import { PackageType, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
const db = new PrismaClient();
async function main() {
  for (const p of [{name:'Starter Voice',type:PackageType.VOICE,price:100,voiceSeconds:300,validityDays:7},{name:'Standard Voice',type:PackageType.VOICE,price:500,voiceSeconds:1800,validityDays:30},{name:'Chat 50',type:PackageType.CHAT,price:100,messageCount:50,validityDays:7}]) await db.package.upsert({where:{id:`seed-${p.name.toLowerCase().replaceAll(' ','-')}`},create:{id:`seed-${p.name.toLowerCase().replaceAll(' ','-')}`,points:0,messageCount:0,voiceSeconds:0,...p},update:p});
  for (const g of [{id:'seed-rose',name:'Rose',iconUrl:'🌹',pointPrice:20},{id:'seed-crown',name:'Crown',iconUrl:'👑',pointPrice:100}]) await db.digitalGift.upsert({where:{id:g.id},create:g,update:g});
  for (const card of [{id:'seed-voice-card',name:'Five-Minute Voice Card',type:PackageType.VOICE,price:100,voiceSeconds:300,messageCount:0,validityDays:7,transferable:true},{id:'seed-chat-card',name:'Chat 50 Gift Card',type:PackageType.CHAT,price:100,voiceSeconds:0,messageCount:50,validityDays:7,transferable:true}]) await db.giftCard.upsert({where:{id:card.id},create:card,update:card});
  const phone = process.env.SEED_ADMIN_PHONE ?? '01900000000';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  await db.user.upsert({ where: { phone }, create: { phone, passwordHash: await argon2.hash(password), role: 'ADMIN', phoneVerifiedAt: new Date(), dateOfBirth: new Date('1990-01-01'), profile: { create: { username: 'admin', displayName: 'Administrator', languages: [], interests: [] } }, wallet: { create: {} } }, update: { role: 'ADMIN', passwordHash: await argon2.hash(password) } });
}
main().finally(() => db.$disconnect());
