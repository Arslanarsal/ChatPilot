import { companies, contacts, whatsapp_connector_server } from '@prisma/client'
import { ToolSet } from 'ai'

export type Company = companies & {
  whatsapp_connector_server: whatsapp_connector_server | null
}
export type Contact = contacts & { companies: Company }

// AI SDK Tool types
export type AiSdkToolsNames =
  | 'save_name'
  | 'set_needs_review'
  | 'change_bot_status'
  | 'notify_company'
  | 'activate_replies'
  | 'get_available_slots'
  | 'book_appointment'
  | 'cancel_appointment'

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
  role: string
  content: {
    type: string
    text: string
  }[]
}
