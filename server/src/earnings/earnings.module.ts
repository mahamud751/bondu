import { Module } from '@nestjs/common';
import { EarningsController } from './earnings.controller';
@Module({controllers:[EarningsController]})export class EarningsModule{}
