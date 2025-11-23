import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Queue } from 'bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { BackgroundQueue, NotificationJob } from 'src/utils/constants/background.constants'

@Injectable()
export class NotificationService   implements OnModuleInit{
  private readonly logger = new Logger(NotificationService.name)

  constructor(
    @InjectQueue(BackgroundQueue.NOTIFICATION) private notificationQueue: Queue,
  ) {}
  async onModuleInit() {
    // run every 5 minutes
    await this.notificationQueue.upsertJobScheduler(NotificationJob.SEND_WILD_FIRE_NOTIFICATION, 
      {
      // pattern: '0 7 * * *', // This pattern schedules the job to run at 7 AM every day
      pattern: '0 * * * *', // This pattern schedules the job to run every hour at minute 0
      'tz': 'America/Sao_Paulo',
      // pattern: '0 0 * * *', // This pattern schedules the job to run at midnight every day
    }
    )
  }

  
}
