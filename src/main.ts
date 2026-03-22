// IMPORTANT: Make sure to import `instrument.ts` at the top of your file.
// If you're using CommonJS (CJS) syntax, use `require("./instrument.ts");`
import './instrument'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { LoggerService } from './common/logging/logger.service'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { json, urlencoded } from 'express'
;(BigInt.prototype as any).toJSON = function () {
  const int = Number.parseInt(this.toString())
  return int ?? this.toString()
}
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new LoggerService({
      prefix: 'api',
      lokiUrl: process.env.LOKI_URL,
    }),
  })

  // Configure body parser limits
  app.use(json({ limit: '50mb' }))
  app.use(urlencoded({ limit: '50mb', extended: true }))

  app.setGlobalPrefix('api/v1')
  if (process.env.NODE_ENV !== 'Production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('RAMP-API')
      .addCookieAuth()
      .setDescription('RAMP API Services')
      .setExternalDoc('Postman Collection', '/api-json')
      .setVersion('1.0')
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('api', app, document)
  }
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  })
  app.useGlobalFilters(new AllExceptionsFilter())
  app.useGlobalPipes(new ValidationPipe())
  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
