import { Controller } from '@nestjs/common';
import { WhatsappConnectorService } from './whatsapp-connector.service';

@Controller('whatsapp-connector')
export class WhatsappConnectorController {
  constructor(private readonly whatsappConnectorService: WhatsappConnectorService) {}
}
