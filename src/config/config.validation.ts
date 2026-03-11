import { plainToClass } from 'class-transformer'
import {
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator'
import { Environment } from './config.configuration'
class EnvironmentVariables {
  @IsDefined()
  @IsEnum(Environment)
  NODE_ENV: Environment

  @IsDefined()
  @IsNumberString()
  @MinLength(1)
  PORT: string

  @IsDefined()
  @IsString()
  @MinLength(1)
  DATABASE_URL: string

  @IsDefined()
  @IsString()
  @MinLength(1)
  OPENAI_API_KEY: string

  @IsDefined()
  @IsString()
  @MinLength(1)
  REDIS_URL: string

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  chatPilot_API_KEY?: string
}

export function validateConfig(configuration: Record<string, unknown>) {
  const finalConfig = plainToClass(EnvironmentVariables, configuration, {
    enableImplicitConversion: true,
  })

  const errors = validateSync(finalConfig, { skipMissingProperties: false })

  if (errors.length) {
    let errorMessage = ''
    for (const err of errors) {
      if (err.constraints) {
        Object.values(err.constraints).forEach(msg => {
          errorMessage += ` ${msg}\n`
        })
      }
    }
    throw new Error(errorMessage)
  }

  return finalConfig
}
