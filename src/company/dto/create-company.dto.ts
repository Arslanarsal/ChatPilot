import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsInt } from 'class-validator'

export class CreateCompanyDto {
  @ApiProperty({ example: 'GeeksHub' })
  @IsString()
  name: string

  @ApiProperty({ example: 'abc123' })
  @IsString()
  url_id: string

  @ApiProperty({ example: 1234567890 })
  @IsInt()
  phone: number
}
