import { Module, Global } from '@nestjs/common'
import { BackgroundTasksController } from './background-tasks.controller'
import { BullModule } from '@nestjs/bullmq'
import { ReplyService } from './services/reply.service'
import { ReplyProcessor } from './processors/reply.processor'
import { BackgroundQueue } from 'src/utils/constants/background.constants'

import { VercelAiModule } from 'src/vercel-ai/vercel-ai.module'
import { ContactModule } from 'src/contact/contact.module'
import { BullBoardModule } from '@bull-board/nestjs'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { CompanyModule } from 'src/company/company.module'
import { FollowUpService } from './services/follow-up.service'
import { FollowUpProcessor } from './processors/follow-up.processor'

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
      {
        name: BackgroundQueue.FOLLOW_UP,
      },
    ),
    BullBoardModule.forFeature(
      {
        name: BackgroundQueue.REPLIES,
        adapter: BullMQAdapter,
      },
      {
        name: BackgroundQueue.FOLLOW_UP,
        adapter: BullMQAdapter,
      },
    ),
  ],
  controllers: [BackgroundTasksController],
  providers: [ReplyService, ReplyProcessor, FollowUpService, FollowUpProcessor],
  exports: [ReplyService],
})
export class BackgroundTasksModule {}
