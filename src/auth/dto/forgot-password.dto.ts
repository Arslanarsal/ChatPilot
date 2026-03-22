import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

export class ForgotPasswordDto {
  @ApiProperty({ example: '923001234567' })
  @IsString()
  phone: string
}
