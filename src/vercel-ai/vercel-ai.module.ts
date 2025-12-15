import { Module, forwardRef } from '@nestjs/common';

import { ContactModule } from '../contact/contact.module';

import { AiGoogleService } from './services/ai-google.service';
import { AiToolsService } from './services/ai-tools.service';
import { UnifiedMessageProcessingService } from './services/unified-message-processing.service';
import { AiController } from './ai.controller';
import { AiAssistantConfigService } from 'src/vercel-ai/services/ai-assistant-config.service';

@Module({
  controllers: [AiController],
  imports: [forwardRef(() => ContactModule)],
  providers: [AiGoogleService, AiToolsService, UnifiedMessageProcessingService, AiAssistantConfigService],
  exports: [AiGoogleService, AiToolsService, UnifiedMessageProcessingService, AiAssistantConfigService],
})
export class VercelAiModule { } 