import { ConflictException, Injectable } from '@nestjs/common';
import { Direction, LedgerType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
type Tx = Prisma.TransactionClient;
type LedgerInput = { userId:string; type:LedgerType; direction:Direction; amount:number; referenceType:string; referenceId:string; description:string; idempotencyKey:string; metadata?:Prisma.InputJsonObject };
@Injectable()
export class WalletService {
  constructor(private readonly db:PrismaService) {}
  transaction<T>(operation:(tx:Tx)=>Promise<T>) { return this.db.$transaction(operation,{isolationLevel:'Serializable'}); }
  async creditPurchased(tx:Tx,input:LedgerInput){
    const wallet=await tx.wallet.findUniqueOrThrow({where:{userId:input.userId}});
    const updated=await tx.wallet.update({where:{id:wallet.id},data:{purchased:{increment:input.amount},version:{increment:1}}});
    await this.ledger(tx,wallet.id,input,wallet.purchased,updated.purchased);return updated;
  }
  async debitPurchased(tx:Tx,input:LedgerInput){
    const wallet=await tx.wallet.findUniqueOrThrow({where:{userId:input.userId}});
    if(wallet.purchased+wallet.promotional-wallet.reserved<input.amount)throw new ConflictException('Insufficient available points');
    const purchasedDebit=Math.min(wallet.purchased,input.amount),promotionalDebit=input.amount-purchasedDebit;
    const updated=await tx.wallet.update({where:{id:wallet.id},data:{purchased:{decrement:purchasedDebit},promotional:{decrement:promotionalDebit},version:{increment:1}}});
    await this.ledger(tx,wallet.id,{...input,metadata:{...(input.metadata??{}),purchasedDebit,promotionalDebit}},wallet.purchased+wallet.promotional,updated.purchased+updated.promotional);return updated;
  }
  async reserve(tx:Tx,userId:string,amount:number,referenceId:string){
    const wallet=await tx.wallet.findUniqueOrThrow({where:{userId}});if(wallet.purchased+wallet.promotional-wallet.reserved<amount)throw new ConflictException('Insufficient available points');
    const updated=await tx.wallet.update({where:{id:wallet.id},data:{reserved:{increment:amount},version:{increment:1}}});
    await this.ledger(tx,wallet.id,{userId,type:'RESERVE',direction:'DEBIT',amount,referenceType:'CALL',referenceId,description:'Reserved points for call',idempotencyKey:`call:${referenceId}:reserve`},wallet.purchased,wallet.purchased);return updated;
  }
  async settleReservation(tx:Tx,userId:string,reserved:number,charge:number,referenceId:string){
    if(charge>reserved)throw new ConflictException('Charge exceeds reservation');const wallet=await tx.wallet.findUniqueOrThrow({where:{userId}});if(wallet.reserved<reserved||wallet.purchased+wallet.promotional<charge)throw new ConflictException('Invalid wallet reservation');
    const purchasedDebit=Math.min(wallet.purchased,charge),promotionalDebit=charge-purchasedDebit,updated=await tx.wallet.update({where:{id:wallet.id},data:{reserved:{decrement:reserved},purchased:{decrement:purchasedDebit},promotional:{decrement:promotionalDebit},version:{increment:1}}});
    if(charge>0)await this.ledger(tx,wallet.id,{userId,type:'CALL_CHARGE',direction:'DEBIT',amount:charge,referenceType:'CALL',referenceId,description:'Settled voice call',idempotencyKey:`call:${referenceId}:charge`,metadata:{purchasedDebit,promotionalDebit}},wallet.purchased+wallet.promotional,updated.purchased+updated.promotional);
    const released=reserved-charge;if(released>0)await this.ledger(tx,wallet.id,{userId,type:'RELEASE',direction:'CREDIT',amount:released,referenceType:'CALL',referenceId,description:'Released unused call reservation',idempotencyKey:`call:${referenceId}:release`},updated.purchased,updated.purchased);return updated;
  }
  async creditPendingEarning(tx:Tx,userId:string,amount:number,referenceId:string,sourceType='CALL'){
    const wallet=await tx.wallet.findUniqueOrThrow({where:{userId}});await tx.wallet.update({where:{id:wallet.id},data:{pendingEarning:{increment:amount},version:{increment:1}}});
    await this.ledger(tx,wallet.id,{userId,type:'VENDOR_EARNING',direction:'CREDIT',amount,referenceType:sourceType,referenceId,description:`Pending ${sourceType.toLowerCase()} earning`,idempotencyKey:`${sourceType.toLowerCase()}:${referenceId}:earning`},wallet.pendingEarning,wallet.pendingEarning+amount);
  }
  platformCommission(tx:Tx,amount:number,referenceType:string,referenceId:string,description:string){if(amount<=0)return Promise.resolve(null);return tx.platformLedger.create({data:{type:'COMMISSION',amount,referenceType,referenceId,description,idempotencyKey:`commission:${referenceType}:${referenceId}`}})}
  private ledger(tx:Tx,walletId:string,input:LedgerInput,before:number,after:number){return tx.walletLedger.create({data:{walletId,userId:input.userId,type:input.type,direction:input.direction,amount:input.amount,balanceBefore:before,balanceAfter:after,referenceType:input.referenceType,referenceId:input.referenceId,description:input.description,idempotencyKey:input.idempotencyKey,metadata:input.metadata}})}
}
