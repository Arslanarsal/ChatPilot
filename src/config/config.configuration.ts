import { registerAs } from '@nestjs/config';

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
  env: Environment[process.env.NODE_ENV as keyof typeof Environment] || Environment.Development,
  port: Number(process.env.PORT) || 3000,
  wapiUrl: process.env.WAPI_BASE_URL,
  openAiApiKey: process.env.OPENAI_API_KEY,
  sentry: process.env.SENTRY_URL,
  redisUrl: process.env.REDIS_URL,
  n8nUrl: process.env.N8N_BASE_URL,
  zonicApiKey: process.env.ZONIC_API_KEY,
  supaBaseStorageUrl: process.env.SUPABASE_STORAGE_URL,
  supaBaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
}));

const dbConfig = registerAs(ConfigKey.Db, () => ({
  url: process.env.DATABASE_URL,
}));

export const configurations = [appConfig, dbConfig];
