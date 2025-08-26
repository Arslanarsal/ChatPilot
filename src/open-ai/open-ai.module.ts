import { forwardRef, Module } from '@nestjs/common';
import { ConfigsModule } from 'src/config/config.module';
import { ContectModule } from 'src/contect/contect.module';
import { MessageProcessingService } from './services/message-processing.service';
import { OpenAiToolsService } from './services/open-ai-tools.service';
import { OpenAiService } from './services/open-ai.service';

@Module({
  imports: [ConfigsModule, forwardRef(() => ContectModule)],
  providers: [OpenAiService, MessageProcessingService, OpenAiToolsService],
  exports: [MessageProcessingService, OpenAiService, OpenAiToolsService],
})
export class OpenAiModule {}
