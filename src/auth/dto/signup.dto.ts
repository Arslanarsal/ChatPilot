import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'
import { IsStrongPassword } from './password.validator'

export class SignupDto {
  @ApiProperty({ example: '923001234567' })
  @IsString()
  phone: string

  @ApiProperty({ example: 'Str0ng!Pass' })
  @IsString()
  @IsStrongPassword()
  password: string

  @ApiProperty({ example: 'My Company' })
  @IsString()
  company_name: string
}
