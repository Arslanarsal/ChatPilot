import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { BackgroundQueue, FollowUpJob } from 'src/utils/constant/background.constants';

@Injectable()
export class FollowUpService implements OnModuleInit {
  constructor(@InjectQueue(BackgroundQueue.FOLLOW_UPS) private followUpsQueue: Queue) {}

  async onModuleInit() {
    await this.followUpsQueue.upsertJobScheduler(FollowUpJob.SEND_FOLLOW_UPS, {
      pattern: '*/5 * * * *',
      // pattern: '*/10 * * * * *', // Run every 10 minutes
    });
    await this.followUpsQueue.upsertJobScheduler(FollowUpJob.SCHEDULE_SMART_FOLLOW_UPS, {
      // pattern: '0 0 * * *', // Run at midnight every day
      pattern: '*/10 * * * * *', // Run every 10 minutes
      tz: 'America/Sao_Paulo',
    });
  }
}
