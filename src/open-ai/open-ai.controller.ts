import { Controller } from '@nestjs/common';
import { OpenAiService } from './services/open-ai.service';

@Controller('open-ai')
export class OpenAiController {
  constructor(private readonly openAiService: OpenAiService) {}
}
