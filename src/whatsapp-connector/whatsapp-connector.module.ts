import { Module } from '@nestjs/common';
import { WhatsappConnectorService } from './whatsapp-connector.service';
import { WhatsappConnectorController } from './whatsapp-connector.controller';

@Module({
  controllers: [WhatsappConnectorController],
  providers: [WhatsappConnectorService],
})
export class WhatsappConnectorModule {}
