import { ApiProperty } from '@nestjs/swagger'
import { IsString, Length } from 'class-validator'
import { IsStrongPassword } from './password.validator'

export class ResetPasswordDto {
  @ApiProperty({ example: '923001234567' })
  @IsString()
  phone: string

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  otp: string

  @ApiProperty({ example: 'Str0ng!Pass' })
  @IsString()
  @IsStrongPassword()
  new_password: string
}
