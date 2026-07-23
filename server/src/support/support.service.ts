import { ForbiddenException,Injectable,NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto,ReplyTicketDto,UpdateTicketDto } from './support.dto';

@Injectable()
export class SupportService {
  constructor(private readonly db:PrismaService){}
  async create(userId:string,dto:CreateTicketDto){
    await this.validateEvidence(userId,dto.evidenceIds??[]);
    return this.db.$transaction(async tx=>{const ticket=await tx.supportTicket.create({data:{userId,subject:dto.subject.trim(),category:dto.category,messages:{create:{senderId:userId,body:dto.body.trim(),evidenceIds:dto.evidenceIds??[]}}},include:{messages:true}});await tx.notification.create({data:{userId,type:'SUPPORT',title:'Support request received',body:`We received “${ticket.subject}”. Our team will reply here.`,data:{ticketId:ticket.id}}});return ticket});
  }
  mine(userId:string){return this.db.supportTicket.findMany({where:{userId},include:{messages:{where:{internal:false},orderBy:{createdAt:'asc'},include:{sender:{select:{role:true,profile:{select:{displayName:true}}}}}}},orderBy:{lastReplyAt:'desc'},take:100})}
  async replyUser(userId:string,id:string,dto:ReplyTicketDto){
    const ticket=await this.db.supportTicket.findUnique({where:{id}});if(!ticket||ticket.userId!==userId)throw new NotFoundException();if(['RESOLVED','CLOSED'].includes(ticket.status))throw new ForbiddenException('This ticket is closed');await this.validateEvidence(userId,dto.evidenceIds??[]);
    return this.db.$transaction(async tx=>{const message=await tx.supportMessage.create({data:{ticketId:id,senderId:userId,body:dto.body.trim(),evidenceIds:dto.evidenceIds??[]}});await tx.supportTicket.update({where:{id},data:{status:'OPEN',lastReplyAt:new Date()}});return message});
  }
  async queue(){
    const rows=await this.db.supportTicket.findMany({where:{status:{not:'CLOSED'}},include:{user:{select:{phone:true,profile:{select:{displayName:true,username:true}}}},assignedTo:{select:{profile:{select:{displayName:true}}}},messages:{where:{internal:false},orderBy:{createdAt:'desc'},take:1}},orderBy:[{priority:'desc'},{lastReplyAt:'asc'}],take:250});
    const now=Date.now();
    // SLA: staff-owned open tickets waiting > 24h are breached
    return rows.map(row=>{
      const waitingMs=now-new Date(row.lastReplyAt??row.createdAt).getTime();
      const slaBreached =
        ['OPEN', 'IN_PROGRESS'].includes(row.status) && waitingMs > 24 * 3600 * 1000;
      return {...row,slaBreached,waitingHours:Math.floor(waitingMs/3600000)};
    });
  }
  detail(id:string){return this.db.supportTicket.findUniqueOrThrow({where:{id},include:{user:{select:{phone:true,profile:true}},assignedTo:{select:{profile:true}},messages:{orderBy:{createdAt:'asc'},include:{sender:{select:{role:true,profile:{select:{displayName:true}}}}}}}})}
  async replyStaff(actor:{sub:string;role:string},id:string,dto:ReplyTicketDto){
    const ticket=await this.db.supportTicket.findUniqueOrThrow({where:{id}});
    return this.db.$transaction(async tx=>{const message=await tx.supportMessage.create({data:{ticketId:id,senderId:actor.sub,body:dto.body.trim(),evidenceIds:dto.evidenceIds??[],internal:dto.internal===true}});await tx.supportTicket.update({where:{id},data:{assignedToId:actor.sub,status:dto.internal?'IN_PROGRESS':'WAITING_FOR_USER',lastReplyAt:new Date()}});if(!dto.internal)await tx.notification.create({data:{userId:ticket.userId,type:'SUPPORT',title:'Support replied',body:dto.body.trim().slice(0,160),data:{ticketId:id}}});await tx.auditLog.create({data:{actorId:actor.sub,actorRole:actor.role,action:dto.internal?'SUPPORT_NOTE_ADDED':'SUPPORT_REPLIED',entityType:'SUPPORT_TICKET',entityId:id}});return message});
  }
  async update(actor:{sub:string;role:string},id:string,dto:UpdateTicketDto){
    const result=await this.db.supportTicket.update({where:{id},data:{...dto,resolvedAt:dto.status==='RESOLVED'?new Date():dto.status==='OPEN'?null:undefined}});
    const auditValue={status:dto.status,priority:dto.priority,assignedToId:dto.assignedToId} as Prisma.InputJsonObject;
    await this.db.auditLog.create({data:{actorId:actor.sub,actorRole:actor.role,action:'SUPPORT_TICKET_UPDATED',entityType:'SUPPORT_TICKET',entityId:id,newValue:auditValue}});return result;
  }
  private async validateEvidence(userId:string,ids:string[]){if(!ids.length)return;const count=await this.db.fileAsset.count({where:{id:{in:ids},ownerId:userId,category:'REPORT',status:'READY',visibility:'PRIVATE'}});if(count!==new Set(ids).size)throw new ForbiddenException('Support evidence is unavailable')}
}
