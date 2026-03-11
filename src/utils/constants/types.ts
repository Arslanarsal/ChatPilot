import { companies, contacts, whatsapp_connector_server } from '@prisma/client'
import { ToolSet } from 'ai'

export type Company = companies & {
  whatsapp_connector_server: whatsapp_connector_server | null
}
export type Contact = contacts & { companies: Company }

// AI SDK Tool types
export type AiSdkToolsNames =
  | 'save_name'
  | 'save_pain_points'
  | 'save_recommended_treatments'
  | 'save_treatments_of_interest'
  | 'update_user_data'
  | 'set_needs_review'
  | 'update_'
  | 'update_schedule_event'
  | 'get_available_appointments'
  | 'book_appointment'
  | 'book_appointment_v2'
  | 'cancel_appointment'
  | 'search_support_questions'
  | 'get_or_create_support_question'
  | 'get_products_info'

export type AiSdkToolConfig = ToolSet
export enum AUTHOR_TYPE {
  HUMAN = 'human',
  BOT = 'bot',
  USER_WHATSAPP = 'user_whatsapp',
}
export enum ORIGINAL_MESSAGE_TYPE {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
}

export type OpenAIScheduleEventPayload = {
  status: 'booked' | 'cancelled' | 'neither' | 'no_event'
  date: string | null
}

export type AiChatMessage = {
  role: string;
  content: {
    type: string;
    text: string;
  }[];
}