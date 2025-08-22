import { Module } from '@nestjs/common';
import { ContectController } from './contect.controller';
import { ContectService } from './contect.service';

@Module({
  controllers: [ContectController],
  providers: [ContectService],
  exports: [ContectService],
})
export class ContectModule {}
