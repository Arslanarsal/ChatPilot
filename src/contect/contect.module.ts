import { forwardRef, Module } from '@nestjs/common';
import { ContectController } from './contect.controller';
import { ContectService } from './contect.service';
import { UtilsModule } from 'src/utils/utils.module';
import { VercelAiModule } from 'src/vercel-ai/vercel-ai.module';

@Module({
  imports: [UtilsModule, forwardRef(() => VercelAiModule)],
  controllers: [ContectController],
  providers: [ContectService],
  exports: [ContectService],
})
export class ContectModule {}
