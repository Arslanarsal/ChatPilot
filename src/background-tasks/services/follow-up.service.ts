import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { BackgroundQueue } from 'src/utils/constants/background.constants'

@Injectable()
export class FollowUpService implements OnModuleInit {
  private readonly logger = new Logger(FollowUpService.name)

  constructor(
    @InjectQueue(BackgroundQueue.FOLLOW_UP) private followUpQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.followUpQueue.upsertJobScheduler(
      'follow-up-check',
      { pattern: '0 * * * *' }, // every hour
      { name: 'follow-up-check' },
    )
    this.logger.log('Follow-up scheduler registered (runs every hour)')
  }
}
