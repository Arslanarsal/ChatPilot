import { Transform } from '@nestjs/class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'leetcode' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'asst_Durr9hR8ZapSnLFzwh1cCFtp' })
  @IsString()
  openai_assistant_id: string;

  @ApiProperty({ example: 'url_id' })
  @IsString()
  url_id: string;

  @ApiProperty({ example: 923252679212 })
  @IsInt()
  phone: number;

  @ApiPropertyOptional({ example: 923252679212 })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => BigInt(value))
  clinic_notification_phone?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_bot_activated?: boolean;

  @ApiPropertyOptional({ example: 'cal.com' })
  @IsOptional()
  @IsString()
  crm_provider?: string;

  // @ApiPropertyOptional({ example: 'api_key' })
  // @IsOptional()
  // @IsString()
  // belle_api_key?: string

  // @ApiPropertyOptional({ example: 1234567890 })
  // @IsOptional()
  // @IsNumber()
  // @Transform(({ value }) => BigInt(value))
  // belle_estab_id?: number

  // @ApiPropertyOptional({ example: 1234567890 })
  // @IsOptional()
  // @IsNumber()
  // @Transform(({ value }) => BigInt(value))
  // belle_client_id?: number

  @ApiPropertyOptional({ example: 2809359 })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => BigInt(value))
  cal_event_type_id?: number;

  @ApiPropertyOptional({ example: 'testing' })
  @IsOptional()
  @IsString()
  cal_event_slug?: string;

  @ApiPropertyOptional({ example: 'cal_live_f61f372f3a98dac00c08b37c5e051b86' })
  @IsOptional()
  @IsString()
  cal_api_key?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => BigInt(value))
  cal_booking_length?: number;

  @ApiPropertyOptional({ example: '2022-01-01T00:00:00Z' })
  @IsOptional()
  @IsString()
  updated_at?: string;

  @ApiProperty({ example: '2022-01-01T00:00:00Z' })
  @IsString()
  created_at: string;
}
