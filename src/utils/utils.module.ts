import { forwardRef, Global, Module } from '@nestjs/common'
import { N8nWorkflowService } from './services/n8n-workflow.service'
import { DatesHelper } from './services/dates.service'
import { CalComService } from './services/calcom.service'
import { AppointmentService } from './services/appointment.service'
import { N8NService } from './services/n8n.service'
import { CompanyModule } from 'src/company/company.module'
import { WhatsAppFormatter } from './services/whatsapp-formatter.helper'
import { WhatsBaileyService } from './services/whats-bailey.service'
import { PromptHelper } from './services/prompt.helper'

@Global()
@Module({
  imports: [forwardRef(() => CompanyModule)],
  controllers: [],
  providers: [
    N8nWorkflowService,
    DatesHelper,
    CalComService,
    AppointmentService,
    N8NService,
    WhatsAppFormatter,
    WhatsBaileyService,
    PromptHelper
  ],
  exports: [
    N8nWorkflowService,
    DatesHelper,
    AppointmentService,
    N8NService,
    WhatsAppFormatter,
    WhatsBaileyService,
    PromptHelper
  ],
})
export class UtilsModule {}
