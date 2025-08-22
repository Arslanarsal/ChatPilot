import { plainToClass } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  validateSync,
} from 'class-validator';
import { Environment } from './config.configuration';
class EnvironmentVariables {
  @IsDefined()
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsDefined()
  @IsNumberString()
  @MinLength(1)
  PORT: string;

  @IsDefined()
  @IsString()
  @MinLength(1)
  DATABASE_URL: string;

  @IsDefined()
  @IsString()
  @MinLength(1)
  WAPI_BASE_URL: string;

  @IsDefined()
  @IsString()
  @MinLength(1)
  OPENAI_API_KEY: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  SENTRY_URL?: string;

  @IsDefined()
  @IsString()
  @MinLength(1)
  REDIS_URL: string;

  @IsUrl()
  @IsDefined()
  N8N_BASE_URL: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  ZONIC_API_KEY?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  SUPABASE_STORAGE_URL: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  SUPABASE_SERVICE_KEY: string;

  @IsNotEmpty()
  @IsString()
  @IsUrl()
  SLACK_WEBHOOK_URL: string;
}

export function validateConfig(configuration: Record<string, unknown>) {
  const finalConfig = plainToClass(EnvironmentVariables, configuration, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(finalConfig, { skipMissingProperties: false });

  if (errors.length) {
    let errorMessage = '';
    for (const err of errors) {
      if (err.constraints) {
        Object.values(err.constraints).forEach((msg) => {
          errorMessage += ` ${msg}\n`;
        });
      }
    }
    throw new Error(errorMessage);
  }

  return finalConfig;
}
