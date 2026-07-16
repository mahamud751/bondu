import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Earnings')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('earnings')
export class EarningsController {
  constructor(private readonly db:PrismaService){}

  @Get('summary')
  async summary(@CurrentUser()user:{sub:string}){
    const vendor=await this.db.vendorProfile.findUnique({where:{userId:user.sub},select:{id:true,commissionPercent:true}});if(!vendor)throw new NotFoundException('Creator profile not found');
    const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),week=new Date(today.getTime()-6*86400000),month=new Date(now.getFullYear(),now.getMonth(),1);
    const [wallet,total,todayTotal,weekTotal,monthTotal,source,callStats,withdrawalSetting]=await Promise.all([
      this.db.wallet.findUniqueOrThrow({where:{userId:user.sub},select:{pendingEarning:true,availableEarning:true,held:true}}),
      this.db.earning.aggregate({where:{vendorId:vendor.id},_sum:{vendorAmount:true,grossAmount:true,platformAmount:true},_count:true}),
      this.db.earning.aggregate({where:{vendorId:vendor.id,createdAt:{gte:today}},_sum:{vendorAmount:true}}),
      this.db.earning.aggregate({where:{vendorId:vendor.id,createdAt:{gte:week}},_sum:{vendorAmount:true}}),
      this.db.earning.aggregate({where:{vendorId:vendor.id,createdAt:{gte:month}},_sum:{vendorAmount:true}}),
      this.db.earning.groupBy({by:['sourceType'],where:{vendorId:vendor.id},_sum:{vendorAmount:true,grossAmount:true},_count:true}),
      this.db.callSession.aggregate({where:{vendorId:vendor.id,status:'COMPLETED'},_count:true,_sum:{durationSeconds:true,vendorAmount:true}}),
      this.db.setting.findUnique({where:{key:'WITHDRAWAL_RULES'},select:{value:true}}),
    ]);
    return{today:todayTotal._sum.vendorAmount??0,week:weekTotal._sum.vendorAmount??0,month:monthTotal._sum.vendorAmount??0,total:total._sum.vendorAmount??0,gross:total._sum.grossAmount??0,platformCommission:total._sum.platformAmount??0,pending:wallet.pendingEarning,available:wallet.availableEarning,held:wallet.held,commissionPercent:vendor.commissionPercent,completedCalls:callStats._count,averageCallSeconds:callStats._count?Math.round((callStats._sum.durationSeconds??0)/callStats._count):0,averageCallEarning:callStats._count?Math.round((callStats._sum.vendorAmount??0)/callStats._count):0,withdrawalRules:withdrawalSetting?.value??{minimum:500,feePoints:0},sources:source.map(item=>({type:item.sourceType,amount:item._sum.vendorAmount??0,gross:item._sum.grossAmount??0,count:item._count}))};
  }

  @Get()
  async list(@CurrentUser()user:{sub:string}){const vendor=await this.db.vendorProfile.findUnique({where:{userId:user.sub},select:{id:true}});if(!vendor)throw new NotFoundException('Creator profile not found');return this.db.earning.findMany({where:{vendorId:vendor.id},orderBy:{createdAt:'desc'},take:200})}
}
