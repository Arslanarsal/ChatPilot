import { ApiProperty } from '@nestjs/swagger'
import { IsString, Length, MinLength } from 'class-validator'

export class ResetPasswordDto {
  @ApiProperty({ example: '923001234567' })
  @IsString()
  phone: string

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  otp: string

  @ApiProperty({ example: 'newpassword123' })
  @IsString()
  @MinLength(6)
  new_password: string
}
