import { BadRequestException,Injectable,UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { createHash,randomBytes,timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type ProviderIdentity={provider:'GOOGLE'|'APPLE';subject:string;email:string;displayName?:string};
@Injectable()
export class ProviderAuthService {
  private readonly google=new OAuth2Client();
  constructor(private readonly db:PrismaService,private readonly config:ConfigService){}
  async issueNonce(){const nonce=randomBytes(32).toString('base64url'),hash=this.hash(nonce);await this.db.oAuthNonce.create({data:{hash,expiresAt:new Date(Date.now()+10*60_000)}});return{nonce,expiresInSeconds:600}}
  async verifyGoogle(token:string,nonce:string):Promise<ProviderIdentity>{const audiences=(this.config.get<string>('GOOGLE_CLIENT_IDS')??'').split(',').map(v=>v.trim()).filter(Boolean);if(!audiences.length)throw new BadRequestException('Google sign-in is not configured');let payload;try{payload=(await this.google.verifyIdToken({idToken:token,audience:audiences})).getPayload()}catch{throw new UnauthorizedException('Invalid Google identity token')}if(!payload?.sub||!payload.email||payload.email_verified!==true)throw new UnauthorizedException('Google email is not verified');await this.consumeNonce(nonce,payload.nonce,false);return{provider:'GOOGLE',subject:payload.sub,email:payload.email.toLowerCase(),displayName:payload.name}}
  async verifyApple(token:string,nonce:string):Promise<ProviderIdentity>{const audience=this.config.get<string>('APPLE_CLIENT_ID');if(!audience)throw new BadRequestException('Apple sign-in is not configured');try{const jose=await (Function('return import("jose")')() as Promise<typeof import('jose')>),jwks=jose.createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys')),verified=await jose.jwtVerify(token,jwks,{issuer:'https://appleid.apple.com',audience,algorithms:['RS256']});const payload=verified.payload;if(!payload.sub||typeof payload.email!=='string'||!['true',true].includes(payload.email_verified as never))throw new Error();await this.consumeNonce(nonce,typeof payload.nonce==='string'?payload.nonce:undefined);return{provider:'APPLE',subject:payload.sub,email:payload.email.toLowerCase()}}catch(error){if(error instanceof BadRequestException||error instanceof UnauthorizedException)throw error;throw new UnauthorizedException('Invalid Apple identity token')}}
  private async consumeNonce(raw:string,claim?:string,requireClaim=true){const hash=this.hash(raw),expected=this.hash(raw);if((requireClaim&&!claim)||(claim&&!this.equal(claim,raw)&&!this.equal(claim,expected)))throw new UnauthorizedException('Identity token nonce mismatch');const used=await this.db.oAuthNonce.updateMany({where:{hash,usedAt:null,expiresAt:{gt:new Date()}},data:{usedAt:new Date()}});if(used.count!==1)throw new UnauthorizedException('Sign-in nonce is invalid or already used')}
  private hash(value:string){return createHash('sha256').update(value).digest('hex')}
  private equal(one:string,two:string){const a=Buffer.from(one),b=Buffer.from(two);return a.length===b.length&&timingSafeEqual(a,b)}
}
