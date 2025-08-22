import { Module } from '@nestjs/common';
import { BackgroundTasksModule } from 'src/background-tasks/background-tasks.module';
import { ClinicModule } from 'src/clinic/clinic.module';
import { ContectModule } from 'src/contect/contect.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [ClinicModule, ContectModule, BackgroundTasksModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
