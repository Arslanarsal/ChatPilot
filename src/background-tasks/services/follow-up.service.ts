import { Injectable, OnModuleInit } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue, Worker, Job } from 'bullmq'

import {
  BackgroundQueue,
  FollowUpJob,
} from 'src/utils/constants/background.constants'

@Injectable()
export class FollowUpService implements OnModuleInit {
  constructor(
    @InjectQueue(BackgroundQueue.FOLLOW_UPS) private followUpQueue: Queue,
  ) {}

  async onModuleInit() {
    // run every 5 minutes
    await this.followUpQueue.upsertJobScheduler(FollowUpJob.SEND_FOLLOW_UPS, 
      {
      pattern: '*/5 * * * *', // This pattern schedules the job to run every 1 minutes
      // pattern: '0 0 * * *', // This pattern schedules the job to run at midnight every day
    }
    )
    // // run at 12:00 PM BRT timezone
    // await this.followUpQueue.upsertJobScheduler(
    //   FollowUpJob.BOOKING_REMINDER_1,
    //   {
    //     // pattern: '*/5 * * * *', // Run every 5 minutes
    //     pattern: '* * * * *', // Run every minute
    //     'endDate': new Date(Date.now() + 2 * 60 * 1000), // Current time + 2 minutes
    //     // pattern: '* * * * *', // Run every minute
    //   },
    // )
    // // run at 8:00 AM BRT timezone
    // await this.followUpQueue.upsertJobScheduler(
    //   FollowUpJob.BOOKING_REMINDER_2,
    //   {
    //     // pattern: '*/5 * * * *', // Run every 5 minutes
    //     pattern: '* * * * *', // Run every minute
    //     'endDate': new Date(Date.now() + 2 * 60 * 1000), // Current time + 2 minutes
    //     // pattern: '* * * * *', // Run every minute
    //   },
    // )
    // // Run at midnight every day
    // await this.followUpQueue.upsertJobScheduler(
    //   FollowUpJob.SCHEDULE_SMART_FOLLOW_UPS,
    //   {
    //     // pattern: '*/5 * * * *', // Run every 5 minutes
    //     pattern: '* * * * *', // Run every minute
    //     'endDate': new Date(Date.now() + 2 * 60 * 1000), // Current time + 2 minutes
    //     // pattern: '* * * * *', // Run every minute
    //   },
    // )

    // // Schedule the job to run every 5 minutes
    // await this.followUpQueue.upsertJobScheduler(
    //   FollowUpJob.SEND_SMART_FOLLOW_UPS,
    //   {
    //     // pattern: '*/5 * * * *', // Run every 5 minutes
    //     pattern: '* * * * *', // Run every minute
    //     'endDate': new Date(Date.now() + 2 * 60 * 1000), // Current time + 2 minutes
    //     // pattern: '* * * * *', // Run every minute
    //   },
    // )
  }
}
