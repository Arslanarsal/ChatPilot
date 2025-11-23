import { forwardRef, Module } from '@nestjs/common'
import { OpenAIService } from './services/open-ai.service'
import { MessageProcessingService } from './services/message-processing.service'
import { ContactModule } from 'src/contact/contact.module'
import { OpenAiToolsService } from './services/open-ai-tools.service'
import { ClinicModule } from 'src/clinic/clinic.module'

@Module({
  imports: [forwardRef(() => ContactModule), ClinicModule],
  controllers: [],
  providers: [OpenAIService, MessageProcessingService, OpenAiToolsService],
  exports: [MessageProcessingService, OpenAiToolsService, OpenAIService],
})
export class OpenAIModule {}
