import { ApiProperty } from '@nestjs/swagger'

export class WbConnectionUpdateDto {
  @ApiProperty({ description: 'Session ID of the WhatsApp connection' })
  sessionId: string

  @ApiProperty({ description: 'Connection status: true = connected, false = disconnected' })
  status: boolean

  @ApiProperty({ description: 'Status message with details', required: false })
  message?: string
}
