import { Global, Module } from '@nestjs/common';
import { DatesHelper } from './services/dates.service';
import { WhatsBaileyService } from './services/whats-bailey.service';
import { WhatsAppFormatter } from './services/whatsapp-formatter.helper';
import { PromptHelper } from './services/prompt.helper';

@Global()
@Module({
  providers: [WhatsBaileyService, DatesHelper, WhatsAppFormatter, PromptHelper],
  exports: [WhatsBaileyService, DatesHelper, WhatsAppFormatter, PromptHelper],
})
export class UtilsModule {}
