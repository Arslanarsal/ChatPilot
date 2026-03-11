import { Module } from '@nestjs/common'
import { BackgroundTasksController } from './background-tasks.controller'
import { BullModule } from '@nestjs/bullmq'
import { ReplyService } from './services/reply.service'
import { ReplyProcessor } from './processors/reply.processor'
import { Global } from '@nestjs/common'
import { BackgroundQueue } from 'src/utils/constants/background.constants'

import { VercelAiModule } from 'src/vercel-ai/vercel-ai.module'
import { ContactModule } from 'src/contact/contact.module'
import { BullBoardModule } from '@bull-board/nestjs'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { CompanyModule } from 'src/company/company.module'
import { WaConnService } from './services/whatsapp-connection-status.service'
import { WaConnSProcessor } from './processors/whatsapp-connection-status.processor'

@Global()
@Module({
  imports: [
    VercelAiModule,
    ContactModule,
    CompanyModule,
    BullModule.registerQueue(
      {
        name: BackgroundQueue.REPLIES,
      },
    ),
    BullBoardModule.forFeature(
      {
        name: BackgroundQueue.REPLIES,
        adapter: BullMQAdapter,
      },
    ),
  ],
  controllers: [BackgroundTasksController],
  providers: [
    ReplyService,
    ReplyProcessor,
    // WaConnService,
    // WaConnSProcessor,
  ],
  exports: [ReplyService],
})
export class BackgroundTasksModule { }
