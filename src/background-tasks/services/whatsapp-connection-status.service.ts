import { Injectable, OnModuleInit } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue, Worker, Job } from 'bullmq'

import { BackgroundQueue } from 'src/utils/constants/background.constants'

@Injectable()
export class WaConnService implements OnModuleInit {
  constructor(
    @InjectQueue(BackgroundQueue.WA_CONN_QUEUE) private waConnQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.waConnQueue.upsertJobScheduler(
      'whatsapp-connection-status-job',
      {
        pattern: '*/30 * * * *', // Runs every 30 minutes
      },
    )
  }
}
