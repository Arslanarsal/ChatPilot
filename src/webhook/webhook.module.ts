import { Module } from '@nestjs/common'
import { WebhookService } from './webhook.service'
import { WebhookController } from './webhook.controller'
import { ContactModule } from 'src/contact/contact.module'
import { ClinicModule } from 'src/clinic/clinic.module'

@Module({
  imports: [ContactModule, ClinicModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
