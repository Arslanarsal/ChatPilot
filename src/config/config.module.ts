import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { configurations } from './config.configuration'
import { validateConfig } from './config.validation'
import { ConfigsService } from './config.service'

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [...configurations],
      isGlobal: true,
      validate: validateConfig,
    }),
  ],
  providers: [ConfigsService],
  exports: [ConfigsService],
})
export class ConfigsModule {}
