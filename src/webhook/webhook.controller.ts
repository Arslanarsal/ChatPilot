import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation } from '@nestjs/swagger';
import { WhatsBaileyDto } from './dto/createWebhook.dto';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @ApiOperation({ summary: 'Webhook whats-bailey' })
  @ApiBody({ type: WhatsBaileyDto, description: 'The webhook data in JSON format' })
  @Post('whats-bailey')
  whatsBailyWebhook(@Body() createWebhookDTO: WhatsBaileyDto) {
    return this.webhookService.whatsBailyWebhook(createWebhookDTO);
  }
}
