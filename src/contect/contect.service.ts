import { Injectable, Logger } from '@nestjs/common';
import { companies, contacts, messages, whatsapp_connector_server } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AiChatMessage,
  AUTHOR_TYPE,
  Clinic,
  Contact,
  OpenAIScheduleEventPayload,
  ORIGINAL_MESSAGE_TYPE,
} from 'src/utils/constant/types';
import { WhatsBaileyService } from 'src/utils/services/whats-bailey.service';
import { WhatsAppConnectorType } from 'src/whatsapp-connector/dto/create-whatsapp-connector.dto';

@Injectable()
export class ContectService {
  private readonly logger = new Logger(ContectService.name);
  constructor(
    private prisma: PrismaService,
    private whatsBailey: WhatsBaileyService,
  ) {}

  async getOrCreateContact(
    clinic: companies,
    phone: number,
    senderName: string | null = null,
  ): Promise<Contact | null> {
    try {
      const contact = await this.prisma.contacts.findFirst({
        where: {
          phone: phone,
          company_id: clinic.id,
        },
        include: {
          companies: {
            include: {
              whatsapp_connector_server: true,
            },
          },
        },
      });

      if (!contact) {
        this.logger.log('creating clinic contact');
        const newContact = await this.prisma.contacts.create({
          data: {
            phone: phone,
            company_id: clinic.id,
            whatsapp_profile_name: senderName,
          },
          include: {
            companies: {
              include: {
                whatsapp_connector_server: true,
              },
            },
          },
        });
        this.syncContactPhotoUrl(newContact as Contact);
        return newContact as Contact;
      }

      return contact as Contact;
    } catch (e) {
      this.logger.error('Error in getOrCreateContact:', { e, clinic, phone, senderName });
      return null;
    }
  }

  async syncContactPhotoUrl(contact: Contact) {
    if (!contact) {
      this.logger.log('syncContactPhotoUrl cancelled: Contact not provided.');
      return;
    }

    const serviceMap = {
      [WhatsAppConnectorType.WHATS_BAILEY]: {
        service: this.whatsBailey,
        name: 'WhatsBailey',
      },
    };

    const connectorType = contact.companies?.whatsapp_connector_server?.type;

    const connector = connectorType ? serviceMap[connectorType] : undefined;

    if (!connector) {
      this.logger.log(
        `syncContactPhotoUrl cancelled for contact ${contact.id}: No valid or supported WhatsApp connector type found.`,
      );
      return;
    }

    try {
      const { service: whatsAppService, name: serviceName } = connector;
      const res = await whatsAppService.getClientProfilePicture(contact as Contact);
      this.logger.log(`res from ${serviceName} for contact ${contact.id}: ${JSON.stringify(res)}`);
      if (!res.success) {
        this.logger.log(`Error from ${serviceName} for contact ${contact.id}: ${res.error}`);
        return;
      }

      this.logger.log(
        `Successfully fetched photo URL via ${serviceName} for contact ${contact.id}.`,
      );

      return this.updateContact(contact.id as number, {
        photo_url: res.result,
      });
    } catch (error) {
      this.logger.error(
        `An unexpected exception occurred while calling ${connector.name} for contact ${contact.id}`,
        error,
      );
      return;
    }
  }

  async updateContact(id: number, updateContactDto: Partial<contacts>): Promise<Contact> {
    return (await this.prisma.contacts.update({
      where: { id },
      data: {
        ...(updateContactDto as any),
      },
      include: {
        companies: {
          include: {
            whatsapp_connector_server: true,
          },
        },
      },
    })) as Contact;
  }

  async saveOutgoingMessage(
    self: contacts & {
      companies?: companies;
    },
    text: string,
    imageUrl: string | null = null,
    authorType: AUTHOR_TYPE = AUTHOR_TYPE.BOT,
    originalMessageType: ORIGINAL_MESSAGE_TYPE = ORIGINAL_MESSAGE_TYPE.TEXT,
    source?: string | null,
    authorAuthId?: string | null,
  ): Promise<messages> {
    return await this.prisma.messages.create({
      data: {
        contact_id: self.id,
        message: text,
        image_url: imageUrl,
        message_type: imageUrl ? 'image' : 'text',
        author_type: authorType,
        processed: authorType === AUTHOR_TYPE.BOT ? true : false,
        original_message_type: originalMessageType,
        source,
        author_auth_id: authorAuthId,
      },
    });
  }

  async saveIncomingMessage(
    self: contacts,
    text: string,
    originalMessageType: ORIGINAL_MESSAGE_TYPE = ORIGINAL_MESSAGE_TYPE.TEXT,
  ): Promise<messages> {
    const message = await this.prisma.messages.create({
      data: {
        contact_id: self.id,
        sender_phone: self.phone,
        message: text,
        author_type: AUTHOR_TYPE.HUMAN,
        original_message_type: originalMessageType,
      },
    });
    return message;
  }

  async getUnProcessedMessages(contactId: number): Promise<
    | (contacts & {
        companies:
          | (companies & {
              whatsapp_connector_server: whatsapp_connector_server;
            })
          | companies
          | null;
        messages: messages[];
      })
    | null
  > {
    return await this.prisma.contacts.findFirst({
      where: { id: contactId },
      include: {
        companies: {
          include: {
            whatsapp_connector_server: true,
          },
        },
        messages: {
          where: {
            processed: false,
          },
          orderBy: { sent_at: 'asc' },
        },
      },
    });
  }

  async archiveContact(contactId: number) {
    await Promise.all([
      this.reiniciar(contactId),
      // this.removeScheduledSmartFollowUps(contactId),
      this.prisma.messages.deleteMany({ where: { contact_id: contactId } }),
    ]);
  }

  async reiniciar(contactId: number) {
    try {
      await this.prisma.$queryRaw`
      UPDATE "contacts" 
      SET 
    
      custom_data = NULL, -- JSON field
      is_bot_activated = true,
      is_replies_activated = true,
      thread_id = NULL,
      last_immediate_followup_sent = NULL,
      nr_immediate_followups_sent = 0,
      nr_smart_followups_sent = 0,
      schedule_event = NULL,
      last_smart_followup_sent = NULL,
      next_smart_follow_up = NULL,
      smart_follow_up_stop_date = NULL,
      crm_appointment_at = NULL,
      crm_appointment_id = NULL,
      is_recommendation_good = NULL, 
      is_willing_to_schedule = NULL, 
      last_message_received = NULL,
      lead_status_id = NULL,
      needs_review = false,
      no_scheduling_reason = NULL,
      objection = NULL,
      total_messages = 0,
      recommended_treatments = NULL, -- Setting NULL for String[] array
      treatments_of_interest = NULL,
      pain_points = NULL -- Setting NULL for String[] array
      WHERE id = ${contactId};
    `;
    } catch (error) {
      this.logger.error('Error during reiniciar process', {
        contactId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  async markMessagesProcessed(
    contact: contacts & {
      messages: messages[];
    },
  ) {
    const messageIds: number[] = contact.messages.map((message: messages) => message.id);
    return await this.prisma.messages.updateMany({
      where: { id: { in: messageIds } },
      data: {
        processed: true,
      },
    });
  }

  async sendMessage(
    self: Contact,
    text: string,
    mediaUrl?: string,
    authorType: AUTHOR_TYPE = AUTHOR_TYPE.BOT,
    source?: string | null,
    originalMessageType: ORIGINAL_MESSAGE_TYPE = ORIGINAL_MESSAGE_TYPE.TEXT,
    authorAuthId?: string | null,
  ): Promise<messages> {
    const isVoiceMode = originalMessageType === ORIGINAL_MESSAGE_TYPE.AUDIO;

    const [savedMessage, sendOnWhatsapp] = await Promise.all([
      this.saveOutgoingMessage(
        self,
        text,
        mediaUrl,
        authorType,
        originalMessageType,
        source,
        authorAuthId,
      ),
      this._sendMessage(self, Number(self.phone), text, mediaUrl, isVoiceMode),
    ]);
    return savedMessage;
  }

  private async _sendMessage(
    self: Contact,
    phone: number,
    text: string,
    imageUrl?: string,
    isVoiceMode: boolean = false,
  ): Promise<void> {
    const clinic: Clinic = self.companies;

    console.log('clinc no : ', clinic.phone);
    console.log('Sending message with params:', { phone, text });
    if (clinic) {
      if (clinic.whatsapp_connector_server?.type === WhatsAppConnectorType.WHATS_BAILEY) {
        await this.whatsBailey.sendMessage(clinic, phone, text, imageUrl, isVoiceMode);
      }
    }
  }

  async getContactById(id: number): Promise<Contact> {
    return (await this.prisma.contacts.findUnique({
      where: { id },
      include: {
        companies: {
          include: {
            whatsapp_connector_server: true,
          },
        },
      },
    })) as Contact;
  }

  async getAllMessages(contactId: number, onlyProcessed: boolean = false) {
    const messages = await this.prisma.messages.findMany({
      where: {
        contact_id: contactId,
        ...(onlyProcessed ? { processed: onlyProcessed } : {}),
      },
      orderBy: {
        sent_at: 'asc',
      },
    });
    return messages;
  }

  async getAiChatHistory(
    contactId: number,
    onlyProcessed: boolean = false,
  ): Promise<AiChatMessage[]> {
    const messages = await this.getAllMessages(contactId, onlyProcessed);
    const chatHistory = messages.map((msg) => ({
      role: msg.author_type === AUTHOR_TYPE.HUMAN ? 'user' : 'assistant',
      content: [
        {
          type: 'text',
          text: msg.message,
        },
      ],
    }));
    return chatHistory;
  }

  // async detectBookingStatusChange(contact: Contact): Promise<OpenAIScheduleEventPayload> {
  //   const clinic = contact.companies;

  //   if (!contact.thread_id) {
  //     this.logger.warn(`detectBookingStatusChange :: Skipping ${contact.name}: Missing thread_id.`);
  //     return {
  //       status: 'no_event',
  //       date: null,
  //     };
  //   }

  //   const chatHistory = await this.getAiChatHistory(contact.id);
  //   const prompt = this.promptHelper.detect_booking_status_change_prompt(
  //     contact as any,
  //     chatHistory,
  //   );
  //   const content = await this.aiGoogleService.processPromptsUsingOpenAI(
  //     contact,
  //     chatHistory,
  //     prompt,
  //     prompt,
  //   );

  //   const scheduleEvent: OpenAIScheduleEventPayload = this.cleanAndParseJson(content);
  //   this.logger.log(`after cleaning content ${JSON.stringify(scheduleEvent)}`);
  //   if (scheduleEvent.status === 'booked') {
  //     scheduleEvent.date = this.datesHelper.interpretAsLocalTime(
  //       new Date(scheduleEvent.date as string),
  //       clinic.timezone as string,
  //     );
  //     this.updateContact(contact.id, {
  //       schedule_event: {
  //         date: scheduleEvent.date,
  //         success: true,
  //         error: null,
  //         provider: clinic.crm_provider,
  //       },
  //     });
  //   } else if (scheduleEvent.status === 'cancelled') {
  //     this.updateContact(contact.id, {
  //       schedule_event: Prisma.DbNull as any,
  //       crm_appointment_at: null,
  //       crm_appointment_id: null,
  //     });
  //   }

  //   return scheduleEvent;
  // }
}
