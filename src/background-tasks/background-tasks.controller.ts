import { Controller, Post, Body, Get } from '@nestjs/common'
import { ReplyService } from './services/reply.service'
import { ApiBody } from '@nestjs/swagger'

import { FollowUpProcessor } from './processors/follow-up.processor'
import { FollowUpJob } from 'src/utils/constants/background.constants'

import { NotificationProcessor } from './processors/notification.processor'

@Controller('background-tasks')
export class BackgroundTasksController {
  constructor(
    private readonly replyService: ReplyService,
    private readonly smartFollowUpService : FollowUpProcessor,
    private readonly notificationService: NotificationProcessor,

  ) {}

  @Post('reply')
  @ApiBody({
    description: 'The webhook data in JSON format',
    schema: {
      type: 'object',
      properties: { clientId: { type: 'number', default: 2 } },
    },
  })
  async createTask(@Body() taskData: { clientId: number }) {
    await this.replyService.addReplyTask(taskData)
    return { message: 'Task queued successfully!' }
  }

  @Post('fire-notification')
  @ApiBody({
    description: 'The webhook data in JSON format',
    schema: {
      type: 'object',
      properties: { clientId: { type: 'number', default: 2 } },
    },
  })
  async runReminder(@Body() taskData: { clientId: number }) {
    const res = await this.notificationService.sendWildFireNotification()
    return { message: 'Task queued successfully!' , res}
  }
  @Get('remove-stale-jobs')
  async removeStaleJobs() {
    return await this.replyService.findStuckJobs()
  }

  @Post( FollowUpJob.SCHEDULE_SMART_FOLLOW_UPS)
  @ApiBody({
    description: 'The webhook data in JSON format',
    schema: {
      type: 'object',
      properties: { clientId: { type: 'number', default: 2 } },
    },
  })
  async scheduleSmartFollowUps (@Body() taskData: { clientId: number }) {
    return await this.smartFollowUpService.scheduleSmartFollowUps()
    //  { message: 'Task queued successfully!' }
  }



}
