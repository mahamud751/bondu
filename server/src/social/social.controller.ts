import { Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';import { JwtGuard } from '../common/guards/jwt.guard';import { SearchUsersDto } from './social.dto';import { SocialService } from './social.service';
@ApiTags('Social')@ApiBearerAuth()@UseGuards(JwtGuard)@Controller('social') export class SocialController { constructor(private readonly service:SocialService){}
@Get('discover')discover(@CurrentUser()u:{sub:string},@Query()q:SearchUsersDto){return this.service.search(u.sub,q)}
@Post('follow/:userId')follow(@CurrentUser()u:{sub:string},@Param('userId')id:string){return this.service.follow(u.sub,id)}
@Delete('follow/:userId')unfollow(@CurrentUser()u:{sub:string},@Param('userId')id:string){return this.service.unfollow(u.sub,id)}
@Get('followers/:userId')followers(@Param('userId')id:string){return this.service.followers(id)} @Get('following/:userId')following(@Param('userId')id:string){return this.service.following(id)}
@Post('connections/:userId')request(@CurrentUser()u:{sub:string},@Param('userId')id:string){return this.service.request(u.sub,id)} @Get('connections')connections(@CurrentUser()u:{sub:string}){return this.service.connections(u.sub)} @Get('connections/requests')requests(@CurrentUser()u:{sub:string}){return this.service.requests(u.sub)}
@Patch('connections/:id/accept')accept(@CurrentUser()u:{sub:string},@Param('id')id:string){return this.service.respond(id,u.sub,true)} @Patch('connections/:id/reject')reject(@CurrentUser()u:{sub:string},@Param('id')id:string){return this.service.respond(id,u.sub,false)} @Delete('connections/:id')remove(@CurrentUser()u:{sub:string},@Param('id')id:string){return this.service.remove(id,u.sub)} }
