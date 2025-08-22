import { companies, contacts, whatsapp_connector_server } from '@prisma/client';

export type Clinic = companies & {
  whatsapp_connector_server: whatsapp_connector_server | null;
};
export type Contact = contacts & { companies: Clinic };
export enum ORIGINAL_MESSAGE_TYPE {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
}

export enum AUTHOR_TYPE {
  HUMAN = 'human',
  BOT = 'bot',
  USER_WHATSAPP = 'user_whatsapp',
  USER = 'user',
}

export type OpenAIScheduleEventPayload = {
  status: 'booked' | 'cancelled' | 'neither' | 'no_event';
  date: string | null;
};

export enum LlmStack {
  OPENAI_ASSISTANT = 'openai_assistant',
  AI_SDK = 'ai_sdk',
}

export type AiChatMessage = {
  role: string;
  content: {
    type: string;
    text: string;
  }[];
};
