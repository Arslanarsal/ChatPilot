import { Global, Module } from '@nestjs/common';
import { DatesHelper } from './services/dates.service';
import { WhatsBaileyService } from './services/whats-bailey.service';
import { WhatsAppFormatter } from './services/whatsapp-formatter.helper';

@Global()
@Module({
  providers: [WhatsBaileyService, DatesHelper, WhatsAppFormatter],
  exports: [WhatsBaileyService, DatesHelper, WhatsAppFormatter],
})
export class UtilsModule {}
