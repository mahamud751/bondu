const { PrismaClient } = require('@prisma/client');
const { WalletService } = require('../dist/src/wallet/wallet.service');
const { PackagesController } = require('../dist/src/packages/packages.controller');
const { GiftsController } = require('../dist/src/gifts/gifts.controller');
const { WithdrawalsController } = require('../dist/src/withdrawals/withdrawals.controller');
const { GiftCardsService } = require('../dist/src/gift-cards/gift-cards.service');
const { PaymentsService } = require('../dist/src/payments/payments.service');
const { ConfigService } = require('@nestjs/config');
const { AdminController } = require('../dist/src/admin/admin.controller');

const url=process.env.INTEGRATION_DATABASE_URL;
(url?describe:describe.skip)('PostgreSQL financial concurrency',()=>{
  const db=new PrismaClient({datasourceUrl:url});
  const wallets=new WalletService(db);
  const userId='20000000-0000-4000-8000-000000000001';
  const receiverId='00000000-0000-4000-8000-000000000002';

  beforeEach(async()=>{
    await db.callSession.deleteMany({where:{callerId:userId}});
    await db.withdrawal.deleteMany({where:{userId}});
    await db.giftTransaction.deleteMany({where:{senderId:userId}});
    await db.paymentWebhook.deleteMany({where:{payment:{userId}}});
    await db.payment.deleteMany({where:{userId}});
    await db.userGiftCard.deleteMany({where:{purchaserId:userId}});
    await db.fraudAssessment.deleteMany({where:{userId}});
    await db.userPackage.deleteMany({where:{userId}});
    await db.earning.deleteMany({where:{sourceId:{startsWith:`gift:${userId}:integration-gift`}}});
    await db.platformLedger.deleteMany({where:{referenceId:{startsWith:`gift:${userId}:integration-gift`}}});
    await db.walletLedger.deleteMany({where:{userId:receiverId,referenceId:{startsWith:`gift:${userId}:integration-gift`}}});
    await db.wallet.update({where:{userId:receiverId},data:{pendingEarning:0}});
    await db.walletLedger.deleteMany({where:{userId}});
    await db.auditLog.deleteMany({where:{entityId:userId,action:'USER_BALANCE_ADJUSTED'}});
    await db.user.deleteMany({where:{id:userId}});
    await db.user.create({data:{id:userId,phone:'integration:wallet',passwordHash:'not-a-login',dateOfBirth:new Date('1990-01-01'),termsAcceptedAt:new Date(),profile:{create:{username:'integration_wallet',displayName:'Integration Wallet',languages:[],interests:[]}},wallet:{create:{purchased:100}}}});
  });
  afterAll(async()=>{await db.callSession.deleteMany({where:{callerId:userId}});await db.withdrawal.deleteMany({where:{userId}});await db.giftTransaction.deleteMany({where:{senderId:userId}});await db.paymentWebhook.deleteMany({where:{payment:{userId}}});await db.payment.deleteMany({where:{userId}});await db.userGiftCard.deleteMany({where:{purchaserId:userId}});await db.fraudAssessment.deleteMany({where:{userId}});await db.earning.deleteMany({where:{sourceId:{startsWith:`gift:${userId}:integration-gift`}}});await db.platformLedger.deleteMany({where:{referenceId:{startsWith:`gift:${userId}:integration-gift`}}});await db.walletLedger.deleteMany({where:{userId:receiverId,referenceId:{startsWith:`gift:${userId}:integration-gift`}}});await db.wallet.update({where:{userId:receiverId},data:{pendingEarning:0}});await db.userPackage.deleteMany({where:{userId}});await db.walletLedger.deleteMany({where:{userId}});await db.user.deleteMany({where:{id:userId}});await db.$disconnect()});

  it('allows only one competing reservation and never over-reserves',async()=>{
    const results=await Promise.allSettled([
      wallets.transaction(tx=>wallets.reserve(tx,userId,80,'race-a')),
      wallets.transaction(tx=>wallets.reserve(tx,userId,80,'race-b')),
    ]);
    expect(results.filter(item=>item.status==='fulfilled')).toHaveLength(1);
    const wallet=await db.wallet.findUniqueOrThrow({where:{userId}}),ledgers=await db.walletLedger.findMany({where:{userId,type:'RESERVE'}});
    expect(wallet).toMatchObject({purchased:100,reserved:80});
    expect(ledgers).toHaveLength(1);
  });

  it('allows only one competing debit and preserves a nonnegative balance',async()=>{
    const debit=(key)=>wallets.transaction(tx=>wallets.debitPurchased(tx,{userId,type:'PACKAGE_PURCHASE',direction:'DEBIT',amount:60,referenceType:'TEST',referenceId:key,description:'Concurrent test debit',idempotencyKey:`integration:${key}`}));
    const results=await Promise.allSettled([debit('debit-a'),debit('debit-b')]);
    expect(results.filter(item=>item.status==='fulfilled')).toHaveLength(1);
    const wallet=await db.wallet.findUniqueOrThrow({where:{userId}});
    expect(wallet.purchased+wallet.promotional).toBe(40);
    expect(wallet.purchased).toBeGreaterThanOrEqual(0);
  });
  it('makes admin adjustments idempotent, reasoned and ledger-backed',async()=>{
    const controller=new AdminController(db,wallets,{},{}),actor={sub:'integration-admin',role:'ADMIN'};
    await controller.adjustBalance(userId,{amount:25,reason:'Verified support correction',idempotencyKey:'adjust-credit'},actor);await expect(controller.adjustBalance(userId,{amount:25,reason:'Verified support correction',idempotencyKey:'adjust-credit'},actor)).resolves.toMatchObject({duplicate:true});await controller.adjustBalance(userId,{amount:-60,reason:'Reversal of incorrect credit',idempotencyKey:'adjust-debit'},actor);
    const wallet=await db.wallet.findUniqueOrThrow({where:{userId}}),ledgers=await db.walletLedger.findMany({where:{userId,type:'ADMIN_ADJUSTMENT'}}),audits=await db.auditLog.findMany({where:{entityId:userId,action:'USER_BALANCE_ADJUSTED'}});expect(wallet.purchased).toBe(65);expect(ledgers).toHaveLength(2);expect(audits).toHaveLength(2);
  });

  it('prevents competing package purchases from overspending',async()=>{
    await db.wallet.update({where:{userId},data:{purchased:600}});
    const controller=new PackagesController(db,wallets),user={sub:userId};
    const results=await Promise.allSettled([
      controller.purchase('seed-standard-voice',{idempotencyKey:'package-race-a'},user),
      controller.purchase('seed-standard-voice',{idempotencyKey:'package-race-b'},user),
    ]);
    expect(results.filter(item=>item.status==='fulfilled')).toHaveLength(1);
    expect(await db.userPackage.count({where:{userId}})).toBe(1);
    expect((await db.wallet.findUniqueOrThrow({where:{userId}})).purchased).toBe(100);
  });

  it('credits package bonus points once with an immutable promotional ledger',async()=>{
    await db.wallet.update({where:{userId},data:{purchased:600,promotional:0}});const controller=new PackagesController(db,wallets),user={sub:userId},dto={idempotencyKey:'package-bonus'};
    const first=await controller.purchase('seed-standard-voice',dto,user);await expect(controller.purchase('seed-standard-voice',dto,user)).resolves.toMatchObject({id:first.id});
    const wallet=await db.wallet.findUniqueOrThrow({where:{userId}}),bonus=await db.walletLedger.findMany({where:{userId,idempotencyKey:`package:${userId}:package-bonus:bonus`}});
    expect(wallet).toMatchObject({purchased:100,promotional:50});expect(bonus).toHaveLength(1);expect(bonus[0]).toMatchObject({type:'PROMOTIONAL_BONUS',amount:50});
  });

  it('charges an idempotent digital gift once under concurrent retries',async()=>{
    await db.wallet.update({where:{userId},data:{purchased:300}});
    const controller=new GiftsController(db,wallets,{assertAllowed:jest.fn().mockResolvedValue(undefined)},{users:jest.fn()}),dto={receiverId,idempotencyKey:'integration-gift'},user={sub:userId};
    const first=await Promise.allSettled([controller.send('seed-diamond',dto,user),controller.send('seed-diamond',dto,user)]);
    expect(first.some(item=>item.status==='fulfilled')).toBe(true);
    await expect(controller.send('seed-diamond',dto,user)).resolves.toMatchObject({duplicate:true});
    const wallet=await db.wallet.findUniqueOrThrow({where:{userId}}),ledgers=await db.walletLedger.findMany({where:{userId,idempotencyKey:`gift:${userId}:integration-gift:purchase`}}),transactions=await db.giftTransaction.findMany({where:{senderId:userId}});
    expect(wallet.purchased).toBe(50);
    expect(ledgers).toHaveLength(1);
    expect(transactions).toHaveLength(1);
  });

  it('holds an idempotent withdrawal once under concurrent retries',async()=>{
    await db.wallet.update({where:{userId},data:{purchased:0,availableEarning:1000}});
    const assessment=await db.fraudAssessment.create({data:{userId,context:'WITHDRAWAL',score:0,reasons:[],action:'ALLOW'}}),controller=new WithdrawalsController(db,wallets,{assessWithdrawal:jest.fn().mockResolvedValue(assessment)},{encrypt:value=>`encrypted:${value}`,mask:last4=>`*******${last4}`},{assertAllowed:jest.fn().mockResolvedValue(undefined)}),dto={amount:600,method:'BKASH',accountNumber:'01700000000',idempotencyKey:'integration-withdrawal'},user={sub:userId};
    const first=await Promise.allSettled([controller.create(user,dto),controller.create(user,dto)]);
    expect(first.filter(item=>item.status==='fulfilled')).toHaveLength(1);
    await expect(controller.create(user,dto)).resolves.toMatchObject({duplicate:true,netAmount:600});
    const wallet=await db.wallet.findUniqueOrThrow({where:{userId}}),records=await db.withdrawal.findMany({where:{userId}}),holds=await db.walletLedger.findMany({where:{userId,type:'WITHDRAWAL'}});
    expect(wallet).toMatchObject({availableEarning:400,held:600});expect(records).toHaveLength(1);expect(holds).toHaveLength(1);
  });
  it('prevents concurrent gift-card purchases from exceeding available points',async()=>{
    await db.wallet.update({where:{userId},data:{purchased:150}});const service=new GiftCardsService(db,wallets),dto={recipientId:userId,idempotencyKey:'gift-card-race'};
    const results=await Promise.allSettled([service.purchase(userId,'seed-voice-card',dto),service.purchase(userId,'seed-voice-card',{...dto,idempotencyKey:'gift-card-race-two'})]);
    expect(results.filter(item=>item.status==='fulfilled')).toHaveLength(1);expect(await db.userGiftCard.count({where:{purchaserId:userId}})).toBe(1);expect((await db.wallet.findUniqueOrThrow({where:{userId}})).purchased).toBe(50);
  });
  it('prevents one allowance from backing two simultaneous active calls',async()=>{
    const vendor=await db.vendorProfile.findFirstOrThrow({where:{status:'APPROVED'}}),owned=await db.userGiftCard.create({data:{giftCardId:'seed-voice-card',purchaserId:userId,recipientId:userId,remainingVoiceSeconds:300,remainingVideoSeconds:0,remainingMessages:0,activatedAt:new Date(),expiresAt:new Date(Date.now()+86400000)}}),create=(suffix)=>db.callSession.create({data:{callerId:userId,vendorId:vendor.id,callType:'VOICE',ratePerMinute:20,reservedAmount:0,prepaidSeconds:300,paymentSourceType:'GIFT_CARD',paymentSourceId:owned.id,idempotencyKey:`allowance-lock-${suffix}`}});
    const results=await Promise.allSettled([create('a'),create('b')]);expect(results.filter(item=>item.status==='fulfilled')).toHaveLength(1);expect(await db.callSession.count({where:{paymentSourceId:owned.id,status:{in:['REQUESTED','ACCEPTED','CONNECTING','ACTIVE']}}})).toBe(1);
  });
  it('settles duplicate provider confirmations exactly once',async()=>{
    await db.wallet.update({where:{userId},data:{purchased:0}});const payment=await db.payment.create({data:{userId,gateway:'STRIPE',transactionId:'integration-intent',gatewayIntentId:'integration-pending',amount:200,currency:'BDT',currencyAmountMinor:25000,conversionMinorPerPoint:125,status:'SUBMITTED'}}),service=new PaymentsService(db,new ConfigService({}),wallets,{qualifyFirstPayment:jest.fn().mockResolvedValue(undefined)},{configured:false});
    const results=await Promise.allSettled([service.settleOnlinePayment(payment.id,'integration-intent',25000,'bdt'),service.settleOnlinePayment(payment.id,'integration-intent',25000,'BDT')]);expect(results.some(item=>item.status==='fulfilled')).toBe(true);
    await expect(service.settleOnlinePayment(payment.id,'integration-intent',25000,'BDT')).resolves.toMatchObject({status:'APPROVED'});
    const wallet=await db.wallet.findUniqueOrThrow({where:{userId}}),deposits=await db.walletLedger.findMany({where:{userId,idempotencyKey:`payment:${payment.id}:approve`}});expect(wallet.purchased).toBe(200);expect(deposits).toHaveLength(1);
  });
  it('persists a provider webhook event only once under concurrent delivery',async()=>{
    const payment=await db.payment.create({data:{userId,gateway:'STRIPE',transactionId:'integration-webhook-payment',amount:100,currency:'BDT',currencyAmountMinor:10000,conversionMinorPerPoint:100,status:'SUBMITTED'}}),create=()=>db.paymentWebhook.create({data:{gateway:'STRIPE',eventId:'integration-webhook-event',eventType:'payment_intent.succeeded',paymentId:payment.id,payload:{test:true}}});
    const results=await Promise.allSettled([create(),create()]);expect(results.filter(item=>item.status==='fulfilled')).toHaveLength(1);expect(await db.paymentWebhook.count({where:{gateway:'STRIPE',eventId:'integration-webhook-event'}})).toBe(1);
  });
});
