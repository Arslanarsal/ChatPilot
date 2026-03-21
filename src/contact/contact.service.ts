import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCompanyDto } from '../company/dto/create-company.dto'
import {
  companies,
  contacts,
  messages,
  Prisma,
  whatsapp_connector_server,
} from '@prisma/client'
import {
  AUTHOR_TYPE,
  AiChatMessage,
  Company,
  Contact,
  ORIGINAL_MESSAGE_TYPE,
} from 'src/utils/constants/types'
import { WhatsBaileyService } from 'src/utils/services/whats-bailey.service'
import { WhatsAppConnectorType } from 'src/whatsapp-connector/dto/create-whatsapp-connector.dto'

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name)
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsBailey: WhatsBaileyService,
  ) {}

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

  async sendMessageToCompany(contact: Contact, text: string): Promise<void> {
    const company = contact.companies
    await this._sendMessage(contact, Number(company.phone), text)
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
    )
    const isFromLid = !self.phone && !!self.lid
    const sendNumber = self.phone ? Number(self.phone) : Number(self.lid)
    await this._sendMessage(self, sendNumber, text, mediaUrl, isFromLid)
  }

  async saveOutgoingMessage(
    self: contacts & {
      companies?: companies
    },
    text: string,
    imageUrl: string | null = null,
    authorType: AUTHOR_TYPE = AUTHOR_TYPE.BOT,
    originalMessageType: ORIGINAL_MESSAGE_TYPE = ORIGINAL_MESSAGE_TYPE.TEXT,
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
      },
    })
  }

  private async _sendMessage(
    self: Contact,
    phone: number,
    text: string,
    imageUrl?: string,
    isFromLid: boolean = false,
  ): Promise<void> {
    const company: Company = self.companies

    if (company) {
      if (
        company.whatsapp_connector_server?.type ===
        WhatsAppConnectorType.WHATS_BAILEY
      ) {
        await this.whatsBailey.sendMessage(company, phone, text, imageUrl, undefined, isFromLid)
      }
    }
  }

  async getAiChatHistory(
    contactId: number,
    onlyProcessed: boolean = false,
  ): Promise<AiChatMessage[]> {
    const messages = await this.getAllMessages(contactId, onlyProcessed)
    const chatHistory = messages.map(msg => ({
      role: msg.author_type === AUTHOR_TYPE.HUMAN ? 'user' : 'assistant',
      content: [
        {
          type: 'text',
          text: msg.message,
        },
      ],
    }))
    return chatHistory
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
    })
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
    company: companies,
    phone: number | null,
    senderName: string | null = null,
    userlid: bigint | null = null,
    isFromLid: boolean = false,
  ): Promise<Contact | null> {
    try {
      // If we have phone but no LID, fetch LID from WB API
      if (!isFromLid && phone != null && userlid == null) {
        try {
          userlid = await this.whatsBailey.getLid(
            company as any,
            phone.toString(),
          )
        } catch {
          // LID lookup failed, continue without it
        }
      }

      // Build where clause: search by LID if isFromLid, otherwise by phone (with optional LID match)
      const whereClause: any = isFromLid
        ? { lid: userlid, company_id: company.id, archived_on: null }
        : userlid != null
          ? {
              OR: [
                { phone: phone, company_id: company.id, archived_on: null },
                { lid: userlid, company_id: company.id, archived_on: null },
              ],
            }
          : { phone: phone, company_id: company.id, archived_on: null }

      const contact = await this.prisma.contacts.findFirst({
        where: whereClause,
        include: {
          companies: {
            include: {
              whatsapp_connector_server: true,
            },
          },
        },
      })

      if (!contact) {
        this.logger.log('creating company contact')
        // isFromLid → phone=null, only store LID
        const newContact = await this.prisma.contacts.create({
          data: {
            phone: isFromLid ? null : phone,
            company_id: company.id,
            whatsapp_profile_name: senderName,
            lid: userlid,
          },
          include: {
            companies: {
              include: {
                whatsapp_connector_server: true,
              },
            },
          },
        })
        return newContact as Contact
      }

      // Merge: fill in missing phone or LID on existing contact
      const updateData: any = {}
      if (contact.phone == null && phone != null && !isFromLid) {
        updateData.phone = phone
      }
      if (contact.lid == null && userlid != null) {
        updateData.lid = userlid
      }
      if (Object.keys(updateData).length > 0) {
        const updated = await this.prisma.contacts.update({
          where: { id: contact.id },
          data: updateData,
          include: {
            companies: {
              include: {
                whatsapp_connector_server: true,
              },
            },
          },
        })
        return updated as Contact
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
    const allowedFields = ['name']

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

  async mockTypingState(self: Contact): Promise<void> {
    try {
      const company: Company = self.companies

      if (company) {
        if (
          company.whatsapp_connector_server?.type ===
          WhatsAppConnectorType.WHATS_BAILEY
        ) {
          await this.whatsBailey.mockTypingState(self)
        }
      }
    } catch (e) {
      this.logger.error(`error while mocking typing status: `, {
        companyPhone: self.companies?.phone,
        contact: self,
      })
      return
    }
  }

  async clearTypingState(self: Contact): Promise<void> {
    const company: Company = self.companies
    try {
      if (company) {
        if (
          company.whatsapp_connector_server?.type ===
          WhatsAppConnectorType.WHATS_BAILEY
        ) {
          await this.whatsBailey.clearTypingState(self)
        }
      }
    } catch (e) {
      this.logger.error(`error while clearing typing status: `, {
        companyPhone: company.phone,
        contact: self,
      })
      return
    }
  }

  async resetContact(contactId: number) {
    await this.prisma.$queryRaw`
  UPDATE "contacts"
  SET
    schedule_event = NULL,
    last_message_received = NOW(),
    total_messages = 0,
    needs_review = FALSE,
    is_bot_activated = TRUE,
    is_replies_activated = TRUE,
    is_follow_up_sent = FALSE,
    crm_appointment_at = NULL,
    crm_appointment_id = NULL,
    contact_stop_date = NULL
  WHERE id = ${contactId};
`
  }

  async resetFollowUps(contactId: number) {
    const updatedContact = await this.updateContact(contactId, {
      last_message_received: new Date(),
      is_follow_up_sent: false,
      contact_stop_date: null,
    })
    return updatedContact
  }

  async markUnread(_contact: Contact) {
    // markUnread not supported in WhatsApp Bailey
  }
}
