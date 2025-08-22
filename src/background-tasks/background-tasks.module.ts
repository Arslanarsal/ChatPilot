import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ContectModule } from 'src/contect/contect.module';
import { BackgroundQueue } from 'src/utils/constant/background.constants';
import { UtilsModule } from 'src/utils/utils.module';
import { VercelAiModule } from 'src/vercel-ai/vercel-ai.module';
import { BackgroundTasksController } from './background-tasks.controller';
import { ReplyProcessor } from './processors/reply.processor';
import { ReplyService } from './services/reply.service';
import { OpenAiModule } from 'src/open-ai/open-ai.module';
import { FollowUpService } from './services/follow-up.service';
import { FollowUpProcessor } from './processors/follow-up.processor';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [
    ContectModule,
    VercelAiModule,
    UtilsModule,
    OpenAiModule,
    PrismaModule,
    BullModule.registerQueue(
      {
        name: BackgroundQueue.REPLIES,
      },
      {
        name: BackgroundQueue.FOLLOW_UPS,
      },
    ),
    BullBoardModule.forFeature(
      {
        name: BackgroundQueue.REPLIES,
        adapter: BullMQAdapter,
      },
      {
        name: BackgroundQueue.FOLLOW_UPS,
        adapter: BullMQAdapter,
      },
    ),
  ],
  controllers: [BackgroundTasksController],
  providers: [ReplyService, ReplyProcessor, FollowUpService, FollowUpProcessor],
  exports: [ReplyService],
})
export class BackgroundTasksModule {}
