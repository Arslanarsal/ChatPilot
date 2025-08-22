import { Module } from '@nestjs/common';
import { ConfigsModule } from 'src/config/config.module';
import { ContectModule } from 'src/contect/contect.module';
import { OpenAiController } from './open-ai.controller';
import { MessageProcessingService } from './services/message-processing.service';
import { OpenAiToolsService } from './services/open-ai-tools.service';
import { OpenAiService } from './services/open-ai.service';

@Module({
  imports: [ConfigsModule, ContectModule],
  controllers: [OpenAiController],
  providers: [OpenAiService, MessageProcessingService, OpenAiToolsService],
  exports: [MessageProcessingService, OpenAiService, OpenAiToolsService],
})
export class OpenAiModule {}
