import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappConnectorController } from './whatsapp-connector.controller';
import { WhatsappConnectorService } from './whatsapp-connector.service';

describe('WhatsappConnectorController', () => {
  let controller: WhatsappConnectorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappConnectorController],
      providers: [WhatsappConnectorService],
    }).compile();

    controller = module.get<WhatsappConnectorController>(WhatsappConnectorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
