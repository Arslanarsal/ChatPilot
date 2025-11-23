import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  IsArray,
  IsObject,
  IsOptional,
} from 'class-validator'

class MessageDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  ack: number

  @ApiProperty({ example: false })
  @IsBoolean()
  hasMedia: boolean

  @ApiProperty({ example: '<your_message_here>' })
  @IsString()
  body: string

  @ApiProperty({ example: 'chat' })
  @IsString()
  type: string

  @ApiProperty({ example: 1737371357 })
  @IsInt()
  timestamp: number

  @ApiProperty({ example: '923557609998@c.us' })
  @IsString()
  from: string

  @ApiProperty({ example: '923114502464@c.us' })
  @IsString()
  to: string

  @ApiProperty({ example: 'ios' })
  @IsString()
  deviceType: string

  @ApiProperty({ example: false })
  @IsBoolean()
  isStatus: boolean

  @ApiProperty({ example: false })
  @IsBoolean()
  fromMe: boolean

  @ApiProperty({ example: false })
  @IsBoolean()
  isGif: boolean

  @ApiProperty({ example: [] })
  @IsArray()
  links: any[]

  @ApiProperty({ example: '' })
  @IsString()
  author: string
}

class DataDto {
  @ApiProperty({ type: MessageDto })
  @IsObject()
  message: MessageDto
}

export class WapiDto {
  @ApiPropertyOptional({ example: 'message' })
  @IsOptional()
  @IsString()
  dataType?: string

  @ApiPropertyOptional({ type: DataDto })
  @IsObject()
  @IsOptional()
  data?: DataDto

  @ApiPropertyOptional({ example: 'test_clinic' })
  @IsString()
  @IsOptional()
  sessionId?: string
}
