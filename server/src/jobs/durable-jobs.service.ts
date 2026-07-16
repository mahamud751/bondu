import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import { NotificationDispatcher } from '../notifications/notification-dispatcher.service';
import { PaymentsService } from '../payments/payments.service';
import { CallExpiryService } from './call-expiry.service';
import { EarningReleaseService } from './earning-release.service';

const QUEUE='socialconnect-maintenance';
@Injectable()
export class DurableJobsService implements OnModuleInit,OnModuleDestroy {
  private readonly logger=new Logger(DurableJobsService.name);private queue?:Queue;private worker?:Worker;
  constructor(private readonly config:ConfigService,private readonly earnings:EarningReleaseService,private readonly calls:CallExpiryService,private readonly payments:PaymentsService,private readonly notifications:NotificationDispatcher){}
  async onModuleInit(){if(this.config.get('BACKGROUND_QUEUE_MODE')!=='bullmq')return;const url=this.config.get<string>('REDIS_URL');if(!url)throw new Error('BullMQ mode requires REDIS_URL');const role=this.config.get<string>('BACKGROUND_PROCESS_ROLE')??'all',connection=this.connection(url);this.queue=new Queue(QUEUE,{connection,defaultJobOptions:{attempts:5,backoff:{type:'exponential',delay:5000},removeOnComplete:{age:86400,count:1000},removeOnFail:{age:2592000,count:5000}}});if(role!=='worker')await Promise.all([
    this.queue.upsertJobScheduler('call-expiry',{every:5000},{name:'call-expiry'}),
    this.queue.upsertJobScheduler('notifications',{every:10000},{name:'notifications'}),
    this.queue.upsertJobScheduler('earning-release',{every:Math.max(30000,Number(this.config.get('EARNING_RELEASE_INTERVAL_MS')??300000))},{name:'earning-release'}),
    this.queue.upsertJobScheduler('payment-reconciliation',{every:Math.max(3600000,Number(this.config.get('PAYMENT_RECONCILIATION_INTERVAL_MS')??86400000))},{name:'payment-reconciliation'}),
  ]);if(role!=='api'){this.worker=new Worker(QUEUE,job=>this.process(job),{connection,concurrency:Number(this.config.get('BACKGROUND_JOB_CONCURRENCY')??4),lockDuration:120000});this.worker.on('failed',(job,error)=>this.logger.error(`Job ${job?.name}/${job?.id} failed attempt ${job?.attemptsMade}: ${error.message}`));this.worker.on('error',error=>this.logger.error(`BullMQ worker error: ${error.message}`));this.logger.log('Durable BullMQ maintenance worker started')}else this.logger.log('BullMQ schedulers started; processing delegated to worker service')}
  async status(){if(!this.queue)return{mode:'inline'};const counts=await this.queue.getJobCounts('active','waiting','delayed','completed','failed');return{mode:'bullmq',counts,workerRunning:Boolean(this.worker?.isRunning())}}
  async retryFailed(limit=100){if(!this.queue)return{retried:0,mode:'inline'};const jobs=await this.queue.getFailed(0,Math.min(limit,500)-1);await Promise.all(jobs.map(job=>job.retry()));return{retried:jobs.length}}
  private process(job:Job){switch(job.name){case'call-expiry':return this.calls.expire();case'notifications':return this.notifications.dispatchPending(200);case'earning-release':return this.earnings.releaseDue(500);case'payment-reconciliation':return this.payments.reconcileAll(500);default:throw new Error(`Unknown maintenance job ${job.name}`)}}
  private connection(value:string){const url=new URL(value);return{host:url.hostname,port:Number(url.port||6379),username:url.username||undefined,password:url.password||undefined,db:Number(url.pathname.slice(1)||0),...(url.protocol==='rediss:'?{tls:{}}:{})}}
  async onModuleDestroy(){await Promise.allSettled([this.worker?.close()??Promise.resolve(),this.queue?.close()??Promise.resolve()])}
}
