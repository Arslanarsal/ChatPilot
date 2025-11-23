import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common'
import * as winston from 'winston'
import LokiTransport from 'winston-loki'

interface LoggerOptions {
  prefix?: string
  lokiUrl?: string
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger

  constructor(options?: LoggerOptions) {
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(
            ({ timestamp, level, message, context, ...meta }) => {
              const prefix = options?.prefix || 'NestJS'
              const metaStr = Object.keys(meta).length
                ? JSON.stringify(meta)
                : ''
              return `${timestamp} [${prefix}] ${level} ${message}: [${context}] ${metaStr}`
            },
          ),
        ),
      }),
    ]

    // Add Loki transport if URL is provided
    if (options?.lokiUrl) {
      transports.push(
        new LokiTransport({
          host: options.lokiUrl,
          labels: { app: options.prefix || 'nestjs' },
          json: true,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      )
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      transports,
    })
  }

  log(message: string, context?: string) {
    console.log('this is inside logger service', { message, context })
    this.logger.info(message, { context })
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context })
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context })
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context })
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context })
  }

  // Additional custom methods
  logWithMetadata(message: string, metadata: any, context?: string) {
    this.logger.info(message, { ...metadata, context })
  }
}
