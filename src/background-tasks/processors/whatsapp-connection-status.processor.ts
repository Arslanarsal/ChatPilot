import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { BackgroundQueue } from 'src/utils/constants/background.constants'
import { PrismaService } from 'src/prisma/prisma.service'
import { CompanyService } from 'src/company/company.service'

@Processor(BackgroundQueue.WA_CONN_QUEUE)
export class WaConnSProcessor extends WorkerHost {
  private readonly logger = new Logger(WaConnSProcessor.name)

  constructor(private readonly companyService: CompanyService) {
    super()
  }

  async process(job: Job): Promise<any> {
    this.logger.log(
      `Processing job ${job.id}: syncing WhatsApp connection status for all companies`,
    )
    return await this.companyService.syncAllSessionStatus()
  }
}
