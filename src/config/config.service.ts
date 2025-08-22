import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ConfigsService {
  constructor(private configService: ConfigService) {}

  get app_port(): number {
    const port = this.configService.get<string>('App.port');
    if (port === undefined) {
      throw new Error('App.port is not defined');
    }
    return parseInt(port);
  }

  get app_env(): any {
    const env = this.configService.get<string>('App.env');
    if (env === undefined) {
      throw new Error('App.env is not defined');
    }
    return env;
  }

  get zonicApiKey(): string {
    const key = this.configService.get<string>('App.zonicApiKey');
    if (key === undefined) {
      throw new Error('App.zonicApiKey is not defined');
    }
    return key;
  }

  get wapiBaseUrl(): string {
    const wapiUrl = this.configService.get<string>('App.wapiUrl');
    if (wapiUrl === undefined) {
      throw new Error('App.wapiUrl is not defined');
    }
    return wapiUrl;
  }

  get RedisUrl(): string {
    const redisUrl = this.configService.get<string>('App.redisUrl');
    if (redisUrl === undefined) {
      throw new Error('App.redisUrl  is not defined');
    }
    return redisUrl;
  }
  get RedisPort(): number {
    const redisPort = Number(this.configService.get<string>('App.redisPort'));
    if (redisPort === undefined) {
      throw new Error('App.redisPort  is not defined');
    }
    return redisPort;
  }

  get openAiApiKey(): string {
    const openAiApiKey = this.configService.get<string>('App.openAiApiKey');
    if (openAiApiKey === undefined) {
      throw new Error('App.openAiApiKey  is not defined');
    }
    return openAiApiKey;
  }
  get sentryUrl(): string {
    const sentryUrl = this.configService.get<string>('App.sentry');
    if (sentryUrl === undefined) {
      throw new Error('App.sentry is not defined');
    }
    return sentryUrl;
  }
  get Db_url(): string {
    const dbUrl = this.configService.get<string>('Db.url');
    if (dbUrl === undefined) {
      throw new Error('Db.url is not defined');
    }
    return dbUrl;
  }
  get n8n_url(): string {
    const n8nUrl = this.configService.get<string>('App.n8nUrl');
    if (n8nUrl === undefined) {
      throw new Error('Db.url is not defined');
    }
    return n8nUrl;
  }
}
