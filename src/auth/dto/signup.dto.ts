import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength } from 'class-validator'

export class SignupDto {
  @ApiProperty({ example: '923001234567' })
  @IsString()
  phone: string

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string

  @ApiProperty({ example: 'My Company' })
  @IsString()
  company_name: string
}
