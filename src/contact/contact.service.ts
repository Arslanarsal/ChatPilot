import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCompanyDto } from '../clinic/dto/create-company.dto'
import {
  companies,
  contacts,
  messages,
  whatsapp_connector_server,
} from '@prisma/client'
import { WapiService } from '../utils/services/wapi.service'
import { Prisma } from '@prisma/client'
import {
  AUTHOR_TYPE,
  Clinic,
  Contact,
  ORIGINAL_MESSAGE_TYPE,
} from 'src/utils/constants/types'
import { WhatsBaileyService } from 'src/utils/services/whats-bailey.service'
import { WhatsAppConnectorType } from 'src/whatsapp-connector/dto/create-whatsapp-connector.dto'
import { DatesHelper } from 'src/utils/services/dates.service'
import { AiChatMessage } from 'src/utils/constants/types'
@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name)
  constructor(
    private readonly prisma: PrismaService,
    private readonly wapi: WapiService,
    private readonly whatsBailey: WhatsBaileyService,
    private readonly datesHelper: DatesHelper
  ) { }

  async createContact(createContactDto: CreateCompanyDto) {
    return await this.prisma.contacts.create({
      data: {
        ...createContactDto,
      },
      include: {
        companies: {
          include: {
            whatsapp_connector_server: true,
          },
        },
      },
    })
  }

  async getContactById(id: number): Promise<Contact> {
    return (await this.prisma.contacts.findUnique({
      where: { id, archived_on: null },
      include: {
        companies: {
          include: {
            whatsapp_connector_server: true,
          },
        },
      },
    })) as Contact
  }

  async updateContact(id: number, updateContactDto: Partial<contacts | any>) {
    return await this.prisma.contacts.update({
      where: { id },
      data: {
        ...updateContactDto,
      },
      include: {
        companies: {
          include: {
            whatsapp_connector_server: true,
          },
        },
      },
    })
  }

  async sendMessageToClinic(contact: Contact, text: string): Promise<void> {
    const clinic = contact.companies
    await this._sendMessage(contact, Number(clinic.phone), text)
    if (clinic.clinic_notification_phone) {
      await this._sendMessage(
        contact,
        Number(clinic.clinic_notification_phone),
        text,
      )
    }
    await this.sendMessageToDevs(
      contact,
      `_message sent to clinic:_ \n\n${text}`,
    )
  }

  async sendMessageToDevs(contact: Contact, text: string): Promise<void> {
    const DEV_PHONES = ['923423407767']
    await Promise.all(
      DEV_PHONES.map(devPhone =>
        this._sendMessage(contact, Number(devPhone), text),
      ),
    )
  }
  async archiveContact(contactId: number) {
    await this.updateContact(contactId, {
      archived_on: new Date(),
    })
  }
  async markMessagesProcessed(
    contact: contacts & {
      messages: messages[]
    },
  ) {
    const messageIds: number[] = contact.messages.map(
      (message: messages) => message.id,
    )
    return await this.prisma.messages.updateMany({
      where: { id: { in: messageIds } },
      data: {
        processed: true,
      },
    })
  }
  async getUnProcessedMessages(contactId: number): Promise<
    | (contacts & {
      companies:
      | (companies & {
        whatsapp_connector_server: whatsapp_connector_server
      })
      | companies
      | null
      messages: messages[]
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
    })
  }

  async deleteContact(id: number) {
    return await this.prisma.contacts.delete({
      where: { id },
    })
  }

  // to implement
  async sendMessage(
    self: Contact,
    text: string,
    mediaUrl?: string,
    authorType: AUTHOR_TYPE = AUTHOR_TYPE.BOT,
    source?: string,
  ): Promise<void> {
    const originalMessageType = mediaUrl
      ? ORIGINAL_MESSAGE_TYPE.IMAGE
      : ORIGINAL_MESSAGE_TYPE.TEXT
    await this.saveOutgoingMessage(
      self,
      text,
      mediaUrl,
      authorType,
      originalMessageType,
      source,
    )
    await this._sendMessage(self, Number(self.phone), text, mediaUrl)
  }
  // to implement
  async saveOutgoingMessage(
    self: contacts & {
      companies?: companies
    },
    text: string,
    imageUrl: string | null = null,
    authorType: AUTHOR_TYPE = AUTHOR_TYPE.BOT,
    originalMessageType: ORIGINAL_MESSAGE_TYPE = ORIGINAL_MESSAGE_TYPE.TEXT,
    source?: string,
  ): Promise<void> {
    await this.prisma.messages.create({
      data: {
        contact_id: self.id,
        message: text,
        image_url: imageUrl,
        message_type: imageUrl ? 'image' : 'text',
        author_type: authorType,
        processed: authorType === AUTHOR_TYPE.BOT ? true : false,
        original_message_type: originalMessageType,
        source,
      },
    })
  }
  // to implement
  private async _sendMessage(
    self: Contact,
    phone: number,
    text: string,
    imageUrl?: string,
  ): Promise<void> {
    const clinic: Clinic = self.companies

    console.log('clinc no : ', clinic.phone)
    console.log('Sending message with params:', { phone, text })
    if (clinic) {
      if (clinic.whatsapp_connector_server?.type === 'mega') {
      } else if (clinic.whatsapp_connector_server?.type === 'zapi') {
      } else if (
        clinic.whatsapp_connector_server?.type === WhatsAppConnectorType.WAPI
      ) {
        await this.wapi.sendMessage(clinic, phone, text, imageUrl)
      } else if (
        clinic.whatsapp_connector_server?.type ===
        WhatsAppConnectorType.WHATS_BAILEY
      ) {
        await this.whatsBailey.sendMessage(clinic, phone, text, imageUrl)
      }
    }
  }

  async getAiChatHistory(contactId: number, onlyProcessed: boolean = false): Promise<AiChatMessage[]> {
    const messages = await this.getAllMessages(contactId, onlyProcessed)
    const chatHistory = messages.map(msg => ({
      role: msg.author_type === AUTHOR_TYPE.HUMAN ? 'user' : 'assistant',
      content: [{
        type: 'text',
        text: msg.message
      }],
    }));
    return chatHistory
  }

  async getAllMessages(contactId: number, onlyProcessed: boolean = false) {
    const messages = await this.prisma.messages.findMany({
      where: {
        contact_id: contactId,
        ...(onlyProcessed ? { processed: onlyProcessed } : {})
      },
      orderBy: {
        sent_at: 'asc',
      },
    });
    return messages
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
    })
    return message
  }

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
          archived_on: null,
        },
        include: {
          companies: {
            include: {
              whatsapp_connector_server: true,
            },
          },
        },
      })

      if (!contact) {
        this.logger.log('creating clinic contact')
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
        })
        await this.syncContactPhotoUrl(newContact as Contact)
        return newContact as Contact
      }

      return contact as Contact
    } catch (e) {
      return null
    }
  }

  async updateField(
    contact: contacts,
    field: keyof Prisma.contactsUpdateInput,
    value: string | number | boolean,
  ): Promise<string> {
    // List of allowed fields to prevent updating protected/non-existent fields
    const allowedFields = [
      'name',
      'is_willing_to_schedule',
      'no_scheduling_reason',
      'is_recommendation_good',
    ]

    if (!allowedFields.includes(field as string)) {
      return `Invalid field: ${field}`
    }

    try {
      await this.prisma.contacts.update({
        where: { id: contact.id },
        data: {
          [field]: value,
        },
      })
      return 'success'
    } catch (error) {
      return 'Failed to update contact'
    }
  }

  async updateArrayField(
    contact: contacts,
    field: keyof Prisma.contactsUpdateInput,
    values: string[],
  ): Promise<string> {
    // Validate allowed array fields
    const allowedArrayFields = [
      'pain_points',
      'recommended_treatments',
      'treatments_of_interest',
    ]

    if (!allowedArrayFields.includes(field as string)) {
      return `Invalid array field: ${field}`
    }

    // Validate input is an array of strings
    if (!Array.isArray(values) || values.some(v => typeof v !== 'string')) {
      return 'Invalid array values - must be string array'
    }

    try {
      await this.prisma.contacts.update({
        where: { id: contact.id },
        data: {
          [field]: values,
        },
      })
      return 'success'
    } catch (error) {
      return 'Failed to update contact array field'
    }
  }

  async syncContactPhotoUrl(contact: Contact) {
    // const contact  =  await this.getContactById(contactId);
    if (!contact) {
      this.logger.log('contact not found')
      return
    }

    const clinic: Clinic = contact.companies
    if (clinic.whatsapp_connector_server?.type === WhatsAppConnectorType.WAPI) {
      const res = await this.wapi.getClientProfilePicture(contact as Contact)
      if (!res.success) {
        this.logger.log(`error : ${res.error} on wapi-getClientProfilePicture`)
        return
      }
      this.logger.log('photoUrl Result', res)
      const updatedContact = await this.updateContact(contact?.id as number, {
        photo_url: res?.result,
      })
      return updatedContact
    } else {
      return
    }
  }

  async mockTypingState(self: Contact): Promise<void> {
    try {
      const clinic: Clinic = self.companies

      if (clinic) {
        if (clinic.whatsapp_connector_server?.type === 'mega') {
        } else if (clinic.whatsapp_connector_server?.type === 'zapi') {
        } else if (clinic.whatsapp_connector_server?.type === WhatsAppConnectorType.WAPI) {
          await this.wapi.mockTypingState(self)
        } else if (
          clinic.whatsapp_connector_server?.type === WhatsAppConnectorType.WHATS_BAILEY) {
          await this.whatsBailey.mockTypingState(self)
        }
      }
    } catch (e) {
      this.logger.error(`error while mocking typing status: `, {
        clinicPhone: self.companies?.phone,
        contact: self,
      })
      return
    }
  }

  async clearTypingState(self: Contact): Promise<void> {
    const clinic: Clinic = self.companies
    try {
      this.logger.log('clear Typing State ', {
        clinicPhone: clinic.phone,
        contact: self,
      })
      if (clinic) {
        if (clinic.whatsapp_connector_server?.type === 'mega') {
        } else if (clinic.whatsapp_connector_server?.type === 'zapi') {
        } else if (clinic.whatsapp_connector_server?.type === WhatsAppConnectorType.WAPI) {
          await this.wapi.clearTypingState(self)
        }
        else if (
          clinic.whatsapp_connector_server?.type === WhatsAppConnectorType.WHATS_BAILEY) {
          await this.whatsBailey.clearTypingState(self)
        }
      }
    } catch (e) {
      this.logger.error(`error while clearing typing status: `, {
        clinicPhone: clinic.phone,
        contact: self,
      })
      return
    }
  }

  async reiniciar(contactId: number) {
    await Promise.all([
      this.prisma.smart_follow_ups.deleteMany({
        where: { contact_id: contactId },
      }),
      this.prisma.$queryRaw`
  UPDATE "contacts"
  SET
    -- name = NULL,
    is_recommendation_good = NULL,
    is_willing_to_schedule = NULL,
    no_scheduling_reason = NULL,
    schedule_event = NULL,
    thread_id = NULL,
    last_message_received = NOW(),
    last_reminder_sent = NULL,
    nr_reminders_sent = 0,
    total_messages = 0,
    needs_review = FALSE,
    is_bot_activated = TRUE,
    is_replies_activated = TRUE,
    crm_appointment_at = NULL,
    crm_appointment_id = NULL,
    next_smart_follow_up = NULL,
    smart_reminders_sent = 0,
    contact_stop_date = NULL
  WHERE id = ${contactId};
`,
    ])
  }

  async resetFollowUps(contactId: number) {
    const [deletedFollowUps, updatedContact] = await Promise.all([
      this.prisma.smart_follow_ups.deleteMany({
        where: { contact_id: contactId },
      }),
      this.updateContact(contactId, {
        last_message_received: new Date(),
        // total_messages: { increment: 1 },
        next_smart_follow_up: null,
        last_reminder_sent: null,
        nr_reminders_sent: 0,
        smart_reminders_sent: 0,
        contact_stop_date: null,
      }),
    ])
    this.logger.log('deletedFollowUps', deletedFollowUps)
    return updatedContact
  }

  async isOnWhatsapp(clinic: Clinic, phone: string) {
    const res = await this.wapi.isOnWhatsapp(clinic, phone)
    return res
  }

  async markUnread(contact: Contact) {
    const clinic: Clinic = contact.companies
    if (clinic) {
      if (clinic.whatsapp_connector_server?.type === 'mega') {
      } else if (clinic.whatsapp_connector_server?.type === 'zapi') {
      } else if (clinic.whatsapp_connector_server?.type === WhatsAppConnectorType.WAPI) {
        await this.wapi.markUnread(contact)
      }
      else if (
        clinic.whatsapp_connector_server?.type === WhatsAppConnectorType.WHATS_BAILEY) { }
    }
  }


  // detectBookingStatusChange method removed - was using OpenAI services
  // If needed, implement using Vercel AI instead

  cleanAndParseJson(rawResponse) {
    try {
      if (typeof rawResponse === 'object') {
        return rawResponse; // Already parsed
      }

      if (typeof rawResponse === 'string') {
        // Remove Markdown-style code fences
        const cleaned = rawResponse
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```$/g, '')
          .trim();

        // Try to parse cleaned string
        return JSON.parse(cleaned);
      }
    } catch (err) {
      console.error('Failed to parse assistant response:', err);
    }

    // Fallback if parsing fails
    return { status: 'no_event', date: null };
  }

}
