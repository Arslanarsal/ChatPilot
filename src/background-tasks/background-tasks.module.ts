import { Module } from '@nestjs/common'
import { BackgroundTasksController } from './background-tasks.controller'
import { BullModule } from '@nestjs/bullmq'
import { ReplyService } from './services/reply.service'
import { ReplyProcessor } from './processors/reply.processor'
import { Global } from '@nestjs/common'
import { BackgroundQueue } from 'src/utils/constants/background.constants'

import { NotificationService } from './services/notification.service'
import { NotificationProcessor } from './processors/notification.processor'

import { VercelAiModule } from 'src/vercel-ai/vercel-ai.module'
import { ContactModule } from 'src/contact/contact.module'
// import { FollowUpProcessor } from './processors/follow-up.processor'
// import { FollowUpService } from './services/follow-up.service'
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
        name: BackgroundQueue.REPLIES, // Queue name
      },
      // {
      //   name: BackgroundQueue.NOTIFICATION,
      // },
      // {
      //   name: BackgroundQueue.FOLLOW_UPS,
      // },
      // {
      //   name: BackgroundQueue.WA_CONN_QUEUE,
      // },
    ),
    BullBoardModule.forFeature(
      {
        name: BackgroundQueue.REPLIES,
        adapter: BullMQAdapter,
      },
      // {
      //   name: BackgroundQueue.FOLLOW_UPS,
      //   adapter: BullMQAdapter,
      // },
      // {
      //   name: BackgroundQueue.NOTIFICATION,
      //   adapter: BullMQAdapter,
      // },
      // {
      //   name: BackgroundQueue.WA_CONN_QUEUE,
      //   adapter: BullMQAdapter,
      // },
    ),
  ],
  controllers: [BackgroundTasksController],
  providers: [
    ReplyService,
    ReplyProcessor,
    // NotificationService,
    // NotificationProcessor,
    // FollowUpProcessor,
    // FollowUpService,
    // WaConnService,
    // WaConnSProcessor,
  ],
  exports: [ReplyService],
})
export class BackgroundTasksModule { }
