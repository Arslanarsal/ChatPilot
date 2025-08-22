import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BackgroundTasksModule } from './background-tasks/background-tasks.module';
import { ClinicModule } from './clinic/clinic.module';
import { ConfigsModule } from './config/config.module';
import { ContectModule } from './contect/contect.module';
import { OpenAiModule } from './open-ai/open-ai.module';
import { PrismaModule } from './prisma/prisma.module';
import { GlobalExceptionFilter } from './utils/global-interceptors/global-exception-filter.interceptor';
import { bullBoardAuthMiddleware } from './utils/Middlewares/bull-board-auth.middleware';
import { VercelAiModule } from './vercel-ai/vercel-ai.module';
import { WebhookModule } from './webhook/webhook.module';
import { WhatsappConnectorModule } from './whatsapp-connector/whatsapp-connector.module';

@Module({
  imports: [
    ConfigsModule,
    WebhookModule,
    ClinicModule,
    PrismaModule,
    WhatsappConnectorModule,
    ContectModule,
    BackgroundTasksModule,
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL,
      },
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 0,
      },
    }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
      middleware: [
        bullBoardAuthMiddleware(
          process.env.BULL_BOARD_USER || 'admin',
          process.env.BULL_BOARD_PASSWORD || 'password',
        ),
      ],
    }),
    VercelAiModule,
    OpenAiModule,
    ConfigModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
