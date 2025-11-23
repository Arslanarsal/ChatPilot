import { Injectable, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { BackgroundQueue } from 'src/utils/constants/background.constants'

@Injectable()
export class ReplyService {
  private readonly logger = new Logger(ReplyService.name)
  constructor(
    @InjectQueue(BackgroundQueue.REPLIES) private replyQueue: Queue,
  ) {}
  async addReplyTask(taskData: { 
    clientId: number,
    message?: string,
    contactPhone?: BigInt,
    clinicId?: number,
    clinicPhone?: BigInt,
    fromMe?: boolean,
    originalMessageType?: string,
    senderName?: string
  }) {
    const task =  await this.replyQueue.add(BackgroundQueue.REPLIES, taskData, {
      // attempts: 0, // Retry the task up to 3 times
      // backoff: 20000, // 20 seconds between retries,
      delay: 16000, // 16 seconds delay
      // delay: 5000,
    })
    this.logger.log('Task added to the queue')
    return task
  }

  async findStuckJobs() {
    const activeJobs = await this.replyQueue.getJobs(['active'])
    activeJobs.forEach(job => {
      console.log(
        `Job ID: ${job.id}, State: active, Timestamp: ${job.processedOn}`,
      )
    })
    for (const job of activeJobs) {
      await this.replyQueue.remove(job.id)
    }
    return { totalRemovedJobs: activeJobs.length, jobs: activeJobs }
  }

  async removeStuckJob(jobId: string) {
    await this.replyQueue.remove(jobId)
  }
}
