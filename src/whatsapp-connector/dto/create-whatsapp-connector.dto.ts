import { IsEnum, IsUrl } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export enum WhatsAppConnectorType {
  WAPI = 'wapi',
  WHATS_BAILEY = 'whats_bailey',
}
export class CreateWhatsappConnectorDto {
  @ApiProperty({
    description: 'The URL for the WhatsApp connector',
    type: String,
  })
  @IsUrl()
  url: string

  @ApiProperty({
    description: 'The Type for the WhatsApp connector',
  })
  @IsEnum(WhatsAppConnectorType)
  type: WhatsAppConnectorType
}
