// webhook.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { ContactService } from '../contact/contact.service'
import { ReplyService } from 'src/background-tasks/services/reply.service'
import { CompanyService } from 'src/company/company.service'
import { AUTHOR_TYPE, ORIGINAL_MESSAGE_TYPE } from 'src/utils/constants/types'
import { SupabaseStorageService } from 'src/utils/services/supabase-storage.service'
import OpenAI from 'openai'
import { WhatsBaileyDto } from './dto/whats-bailey.dto'
import { WbConnectionUpdateDto } from './dto/wb-connection-update.dto'

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name)
  constructor(
    private readonly contactService: ContactService,
    private readonly replyService: ReplyService,
    private readonly companyService: CompanyService,
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {}

  private async processWebhook({
    message,
    userPhone,
    companyPhone,
    photoUrl,
    fromMe,
    originalMessageType,
    senderName,
    userlid,
    isFromLid,
    wbId,
  }: {
    message: string
    userPhone: bigint | null
    companyPhone: bigint
    photoUrl: string | null
    fromMe: boolean
    originalMessageType: ORIGINAL_MESSAGE_TYPE
    senderName?: string
    userlid?: bigint | null
    isFromLid?: boolean
    wbId?: string | null
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
        userPhone != null ? Number(userPhone) : null,
        !fromMe ? senderName : null,
        userlid ?? null,
        isFromLid ?? false,
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
            wbId ?? null,
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
            wbId ?? null,
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
            contactPhone: userPhone ?? userlid ?? BigInt(0),
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

  async updateConnectionStatus(statusDto: WbConnectionUpdateDto): Promise<string> {
    this.logger.log('Connection status webhook received', JSON.stringify(statusDto))

    const company = await this.companyService.findBySessionId(statusDto.sessionId)
    if (!company) {
      this.logger.warn('Company not found for session', { sessionId: statusDto.sessionId })
      return 'company not found'
    }


    await this.companyService.updateCompany(company.id, {
      whatsapp_connection_status: statusDto.status,
    } as any)

    this.logger.log(
      `Updated whatsapp_connection_status for company ${company.id} to ${statusDto.status} - ${statusDto.message}`,
    )

    return 'success'
  }

  async uploadMedia(body: {
    mediaBuffer: any
    mimeType: string
    companyPhone: string
    contactPhone: string
  }): Promise<{ success: boolean; mediaUrl: string | null }> {
    try {
      const buffer = Buffer.from(body.mediaBuffer)
      const mediaUrl = await this.supabaseStorageService.uploadMedia(
        buffer,
        body.mimeType,
        body.companyPhone,
        body.contactPhone,
      )

      if (mediaUrl) {
        this.logger.log(`Media uploaded: ${mediaUrl}`)
        return { success: true, mediaUrl }
      }

      return { success: false, mediaUrl: null }
    } catch (error) {
      this.logger.error('uploadMedia failed', { error: error.message })
      return { success: false, mediaUrl: null }
    }
  }

  async whatsBaileyWebhook(baileyDto: WhatsBaileyDto): Promise<string> {
    this.logger.verbose('Bailey webhook received', { baileyDto })
    this.logger.log('baileyDto', baileyDto)

    // Determine message type
    if (baileyDto.isAudio) {
      baileyDto['originalMessageType'] = ORIGINAL_MESSAGE_TYPE.AUDIO
    } else if (baileyDto.hasMedia && baileyDto.mediaUrl) {
      baileyDto['originalMessageType'] = ORIGINAL_MESSAGE_TYPE.TEXT
    } else {
      baileyDto['originalMessageType'] = ORIGINAL_MESSAGE_TYPE.TEXT
    }

    if (baileyDto.isAudio) {
      baileyDto.text = await this.transcribeMessage(
        Buffer.from(baileyDto.mediaBuffer),
      )
    }

    // If message has media with a URL (image/video/doc), include it in the text
    if (baileyDto.hasMedia && !baileyDto.isAudio && baileyDto.mediaUrl) {
      const mediaNote = `[Media: ${baileyDto.mediaUrl}]`
      baileyDto.text = baileyDto.text
        ? `${baileyDto.text}\n${mediaNote}`
        : mediaNote
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

    const isFromLid = baileyDto.isFromLid ?? false

    // When isFromLid, phone is null - contact identified by LID only
    if (!isFromLid && !/^\d+$/.test(baileyDto.userPhone)) {
      this.logger.error('userPhone number not numeric' + baileyDto.userPhone)
      return 'Phone number not numeric'
    }

    const messageInfo = {
      message: baileyDto.text,
      userPhone: isFromLid ? null : BigInt(baileyDto.userPhone),
      companyPhone: BigInt(baileyDto.companyPhone),
      photoUrl: null,
      fromMe: baileyDto.fromMe,
      originalMessageType: baileyDto['originalMessageType'],
      senderName: baileyDto.fromMe ? '' : (baileyDto['senderName'] || 'PUSH NAME'),
      userlid: baileyDto.userlid ? BigInt(baileyDto.userlid) : null,
      isFromLid,
      wbId: baileyDto.id ?? null,
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
