import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappConnectorService } from './whatsapp-connector.service';

describe('WhatsappConnectorService', () => {
  let service: WhatsappConnectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WhatsappConnectorService],
    }).compile();

    service = module.get<WhatsappConnectorService>(WhatsappConnectorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
