import { registerAs } from '@nestjs/config'

export enum ConfigKey {
  App = 'App',
  Db = 'Db',
}

export enum Environment {
  Local = 'local',
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
  Testing = 'testing',
}

const appConfig = registerAs(ConfigKey.App, () => ({
  env:
    Environment[process.env.NODE_ENV as keyof typeof Environment] ||
    Environment.Development,
  port: Number(process.env.PORT) || 3000,
  geminiApiKey: process.env.GEMINI_API_KEY,
  redisUrl: process.env.REDIS_URL,
  chatPilotApiKey: process.env.chatPilot_API_KEY,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  wbBaseUrl: process.env.WB_BASE_URL,
}))

const dbConfig = registerAs(ConfigKey.Db, () => ({
  url: process.env.DATABASE_URL,
}))

export const configurations = [appConfig, dbConfig]
