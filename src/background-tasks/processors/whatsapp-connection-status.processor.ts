import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { BackgroundQueue } from 'src/utils/constants/background.constants'
import { PrismaService } from 'src/prisma/prisma.service'
import { ClinicService } from 'src/clinic/clinic.service'

@Processor(BackgroundQueue.WA_CONN_QUEUE)
export class WaConnSProcessor extends WorkerHost {
  private readonly logger = new Logger(WaConnSProcessor.name)

  constructor(private readonly clinicService: ClinicService) {
    super()
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.id}: will sync WhatsApp connection status for all companies connected with wapi`)
    return await this.clinicService.syncAllWapiSessionStatus()
  }
}
