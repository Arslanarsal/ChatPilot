import { forwardRef, Global, Module } from '@nestjs/common'
import { DatesHelper } from './services/dates.service'
import { CalComService } from './services/calcom.service'
import { AppointmentService } from './services/appointment.service'
import { CompanyModule } from 'src/company/company.module'
import { WhatsAppFormatter } from './services/whatsapp-formatter.helper'
import { WhatsBaileyService } from './services/whats-bailey.service'
import { PromptHelper } from './services/prompt.helper'
import { SupabaseStorageService } from './services/supabase-storage.service'

@Global()
@Module({
  imports: [forwardRef(() => CompanyModule)],
  controllers: [],
  providers: [
    DatesHelper,
    CalComService,
    AppointmentService,
    WhatsAppFormatter,
    WhatsBaileyService,
    PromptHelper,
    SupabaseStorageService,
  ],
  exports: [
    DatesHelper,
    AppointmentService,
    WhatsAppFormatter,
    WhatsBaileyService,
    PromptHelper,
    SupabaseStorageService,
  ],
})
export class UtilsModule {}
