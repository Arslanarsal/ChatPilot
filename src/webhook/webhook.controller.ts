import { Controller, Post, Body } from '@nestjs/common'
import { WebhookService } from './webhook.service'
import { ApiBody, ApiOperation } from '@nestjs/swagger'
import { WhatsBaileyDto } from './dto/whats-bailey.dto'

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @ApiOperation({ summary: 'Webhook whats-bailey' })
  @ApiBody({
    type: WhatsBaileyDto,
    description: 'The webhook data in JSON format',
  })
  @Post('whats-bailey')
  whatsBaileyWebhook(@Body() createWebhookDto: WhatsBaileyDto) {
    return this.webhookService.whatsBaileyWebhook(createWebhookDto)
  }
}
