import { forwardRef, Module } from '@nestjs/common';
import { ContectModule } from 'src/contect/contect.module';
import { OpenAiModule } from 'src/open-ai/open-ai.module';
import { UtilsModule } from 'src/utils/utils.module';
import { UnifiedMessageProcessingService } from './services/unified-message-processing.service';
import { AiGoogleService } from './services/ai-google.service';
import { AiToolsService } from './services/ai-tools.service';

@Module({
  imports: [UtilsModule, OpenAiModule, forwardRef(() => ContectModule)],
  providers: [UnifiedMessageProcessingService, AiGoogleService, AiToolsService],
  exports: [UnifiedMessageProcessingService, AiGoogleService, AiToolsService],
})
export class VercelAiModule {}
