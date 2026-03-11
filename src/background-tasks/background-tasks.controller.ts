import { Controller, Post, Body, Get } from '@nestjs/common'
import { ReplyService } from './services/reply.service'
import { ApiBody } from '@nestjs/swagger'

@Controller('background-tasks')
export class BackgroundTasksController {
  constructor(
    private readonly replyService: ReplyService,
  ) { }

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

  @Get('remove-stale-jobs')
  async removeStaleJobs() {
    return await this.replyService.findStuckJobs()
  }
}
