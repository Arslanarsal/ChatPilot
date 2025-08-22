import { Module } from '@nestjs/common';
import { WhatsappConnectorController } from './whatsapp-connector.controller';
import { WhatsappConnectorService } from './whatsapp-connector.service';

@Module({
  controllers: [WhatsappConnectorController],
  providers: [WhatsappConnectorService],
})
export class WhatsappConnectorModule {}
