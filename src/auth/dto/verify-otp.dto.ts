import { ApiProperty } from '@nestjs/swagger'
import { IsString, Length } from 'class-validator'

export class VerifyOtpDto {
  @ApiProperty({ example: '923001234567' })
  @IsString()
  phone: string

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  otp: string
}
