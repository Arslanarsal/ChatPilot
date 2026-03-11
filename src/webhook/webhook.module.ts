import { Module } from '@nestjs/common'
import { WebhookService } from './webhook.service'
import { WebhookController } from './webhook.controller'
import { ContactModule } from 'src/contact/contact.module'
import { CompanyModule } from 'src/company/company.module'

@Module({
  imports: [ContactModule, CompanyModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
