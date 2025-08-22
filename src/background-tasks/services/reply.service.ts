import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { BackgroundQueue } from 'src/utils/constant/background.constants';

@Injectable()
export class ReplyService {
  private readonly logger = new Logger(ReplyService.name);
  constructor(@InjectQueue(BackgroundQueue.REPLIES) private replyQueue: Queue) {}

  async addReplyTask(taskData: {
    clientId: number;
    message?: string;
    contactPhone?: BigInt;
    clinicId?: number;
    clinicPhone?: BigInt;
    fromMe?: boolean;
    originalMessageType?: string;
    senderName?: string | null;
  }) {
    const task = await this.replyQueue.add(
      BackgroundQueue.REPLIES,
      taskData,
      // , {
      // attempts: 0, // Retry the task up to 3 times
      // backoff: 20000, // 20 seconds between retries,
      // delay: 16000, // 16 seconds delay
      // delay: 5000,
      // }
    );
    this.logger.log('Task added to the queue', task.data);
    return task;
  }
}
