// webhook.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { ContactService } from '../contact/contact.service'
import { ReplyService } from 'src/background-tasks/services/reply.service'
import { CompanyService } from 'src/company/company.service'
import { AUTHOR_TYPE, ORIGINAL_MESSAGE_TYPE } from 'src/utils/constants/types'
import OpenAI from 'openai'
import { WhatsBaileyDto } from './dto/whats-bailey.dto'

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name)
  constructor(
    private readonly contactService: ContactService,
    private readonly replyService: ReplyService,
    private readonly companyService: CompanyService,
  ) {}

  private async processWebhook({
    message,
    userPhone,
    companyPhone,
    photoUrl,
    fromMe,
    originalMessageType,
    senderName,
  }: {
    message: string
    userPhone: bigint
    companyPhone: bigint
    photoUrl: string | null
    fromMe: boolean
    originalMessageType: ORIGINAL_MESSAGE_TYPE
    senderName?: string
  }) {
    try {
      const company = await this.companyService.findByPhone(
        Number(companyPhone),
      )

      if (!company) {
        this.logger.log('Company not found', {
          companyPhone,
          asNumber: Number(companyPhone),
        })
        return
      }

      const contact = await this.contactService.getOrCreateContact(
        company,
        Number(userPhone),
        !fromMe ? senderName : null,
      )
      if (!contact) {
        return
      }
      if (photoUrl) {
        const updateContactPicture = await this.contactService.updateContact(
          contact.id,
          { photo_url: photoUrl },
        )
        contact.photo_url = updateContactPicture.photo_url
      }

      if (fromMe) {
        // Save  OutGoing Message from Company itself
        this.logger.log('message is from company staff, deactivate bot', {
          contact,
        })
        await Promise.all([
          this.contactService.saveOutgoingMessage(
            contact,
            message,
            null,
            AUTHOR_TYPE.USER_WHATSAPP,
            originalMessageType,
          ),
          this.contactService.updateContact(contact.id, {
            is_replies_activated: false,
          }),
        ])
      } else {
        if (!contact.whatsapp_profile_name) {
          this.contactService.updateContact(contact.id, {
            whatsapp_profile_name: senderName,
          })
        }
        // incoming Message

        await Promise.all([
          this.contactService.resetFollowUps(contact.id),
          this.contactService.saveIncomingMessage(
            contact,
            message,
            originalMessageType,
          ),
        ])
        const shouldProcessMessage =
          message.toLowerCase() === '/reset' ||
          (company.is_bot_activated &&
            contact.is_bot_activated &&
            contact.is_replies_activated)

        if (shouldProcessMessage) {
          await this.replyService.addReplyTask({
            clientId: contact.id,
            message,
            contactPhone: userPhone,
            companyId: company.id,
            companyPhone,
            fromMe,
            originalMessageType,
            senderName,
          })
        } else {
          await this.contactService.markUnread(contact)
        }
      }
    } catch (error) {
      this.logger.error('Error in processWebhook:', error)
      throw error
    }
  }

  async transcribeMessage(buffer) {
    try {
      const openai = new OpenAI()
      const transcription = await openai.audio.transcriptions.create({
        file: new File([buffer], 'audio.ogg', { type: 'audio/ogg' }),
        model: 'whisper-1',
        response_format: 'text',
      })

      return transcription
    } catch (error) {
      console.error('Error:', error)
      throw error
    }
  }

  async whatsBaileyWebhook(baileyDto: WhatsBaileyDto): Promise<string> {
    this.logger.verbose('Bailey webhook received', { baileyDto })
    this.logger.log('baileyDto', baileyDto)
    baileyDto['originalMessageType'] = baileyDto.isAudio
      ? ORIGINAL_MESSAGE_TYPE.AUDIO
      : ORIGINAL_MESSAGE_TYPE.TEXT
    if (baileyDto.isAudio) {
      baileyDto.text = await this.transcribeMessage(
        Buffer.from(baileyDto.mediaBuffer),
      )
    }
    if (baileyDto.hasLocation && baileyDto.location) {
      baileyDto.text = `/location  latitude:${baileyDto.location.latitude}, longitude: ${baileyDto.location.longitude}`
    }

    if (!baileyDto?.text) {
      this.logger.log('message does not contain text', { baileyDto })
      return 'message does not contain text'
    }

    if (!/^\d+$/.test(baileyDto.companyPhone)) {
      this.logger.error(
        'companyPhone number not numeric' + baileyDto.companyPhone,
      )
      return 'Phone number not numeric'
    }

    if (!/^\d+$/.test(baileyDto.userPhone)) {
      this.logger.error('userPhone number not numeric' + baileyDto.userPhone)
      return 'Phone number not numeric'
    }

    const messageInfo = {
      message: baileyDto.text,
      userPhone: BigInt(baileyDto.userPhone),
      companyPhone: BigInt(baileyDto.companyPhone),
      photoUrl: null,
      fromMe: baileyDto.fromMe,
      originalMessageType: baileyDto['originalMessageType'],
      senderName: baileyDto.fromMe ? '' : 'PUSH NAME',
    }

    if (!messageInfo.message) {
      return 'success'
    }

    this.processWebhook(messageInfo).catch(error => {
      this.logger.error('Error processing webhook:', error)
    })

    return 'success'
  }
}
