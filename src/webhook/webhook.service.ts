// webhook.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { WapiDto } from './dto/wapi.dto'
import { ContactService } from '../contact/contact.service'
import { ReplyService } from 'src/background-tasks/services/reply.service'
import { ClinicService } from 'src/clinic/clinic.service'
import { AUTHOR_TYPE, ORIGINAL_MESSAGE_TYPE } from 'src/utils/constants/types'
import { WapiService } from 'src/utils/services/wapi.service'
import OpenAI from 'openai'
import { PrismaService } from 'src/prisma/prisma.service'
import { WhatsBaileyDto } from './dto/whats-bailey.dto'

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name)
  constructor(
    private readonly contactService: ContactService,
    private readonly replyService: ReplyService,
    private readonly clinicService: ClinicService,
    private readonly wapiService: WapiService,
  ) {}

  async wapiWebhook(wapiDto: WapiDto): Promise<string> {
    this.logger.verbose('webhook received', { wapiDto })
    if (wapiDto.dataType !== 'message_create') {
      return 'Not a message'
    }

    const messageData: any = wapiDto?.data?.message
    if (messageData?.from.endsWith('@g.us')) {
      return 'message in group'
    }
    const fromPhone = messageData?.from.split('@')[0] || ''
    const toPhone = messageData?.to.split('@')[0] || ''
    const fromMe = messageData?.fromMe || false

    let userPhone: BigInt, clinicPhone: BigInt

    if (!/^\d+$/.test(fromPhone)) {
      this.logger.error('Phone number not numeric' + fromPhone)
      return 'Phone number not numeric'
    }

    if (fromMe) {
      if (!messageData?.author) {
        // message was sent from bot, ignore
        return 'success'
      }
      clinicPhone = BigInt(fromPhone)
      userPhone = BigInt(toPhone)
    } else {
      userPhone = BigInt(fromPhone)
      clinicPhone = BigInt(toPhone)
    }

    const message = messageData?.body || ''
    const messageInfo = {
      message,
      userPhone,
      clinicPhone,
      photoUrl: null,
      fromMe: fromMe,
      originalMessageType: ORIGINAL_MESSAGE_TYPE.TEXT,
      senderName: messageData?._data?.notifyName,
    }
    // handle audio message
    if ((messageData as any)?._data?.mimetype === 'audio/ogg; codecs=opus') {
      const mediaMessage = await this.wapiService.downloadMediaMessage(
        clinicPhone,
        userPhone,
        (wapiDto as any)?.data?.message._data.id.id,
      )

      if (mediaMessage.success) {
        const textMessage = await this.transcribeMessage(Buffer.from(mediaMessage.messageMedia.data, 'base64'))
        this.logger.log(`textMessage from open AI==> ${textMessage}`)
        messageInfo.message = textMessage
        messageInfo.originalMessageType = ORIGINAL_MESSAGE_TYPE.AUDIO
      } else {
        return 'success'
      }
    }
    

    // do'not process if message is empty or null
    if (!messageInfo.message) {
      return 'success'
    }
    this.logger.log(
      `message from ${fromPhone} to ${toPhone}:  ${messageInfo.message}`,
      messageInfo,
    )
    // Process in background
    this.processWebhook(messageInfo).catch(error => {
      this.logger.error('Error processing webhook:', error)
    })

    return 'success'
  }

  private async processWebhook({
    message,
    userPhone,
    clinicPhone,
    photoUrl,
    fromMe,
    originalMessageType,
    senderName
  }: {
    message: string
    userPhone: BigInt
    clinicPhone: BigInt
    photoUrl: string | null
    fromMe: boolean
    originalMessageType: ORIGINAL_MESSAGE_TYPE
    senderName?: string,
  }) {
    try {
      const clinic = await this.clinicService.findByPhone(Number(clinicPhone))

      if (!clinic) {
        this.logger.log('Clinic not found', {
          clinicPhone,
          asNumber: Number(clinicPhone),
        })
        return
      }

      const contact = await this.contactService.getOrCreateContact(
        clinic,
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
        this.logger.log('message is from clinic staff, deactivate bot', {
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
            is_replies_activated : false
          }),
        ])
      } else {
        if (!contact.whatsapp_profile_name) {
          this.contactService.updateContact(contact.id, {
            whatsapp_profile_name: senderName,
          })
        }
        // incoming Message
        
        await Promise.all([ this.contactService.resetFollowUps(contact.id),
         this.contactService.saveIncomingMessage(
          contact,
          message,
          originalMessageType,
        )])
        const shouldProcessMessage =
          (message.toLowerCase() === 'reiniciar' ||
            message.toLowerCase() === '/reset') ||
          (clinic.is_bot_activated && contact.is_bot_activated && contact.is_replies_activated) 

        if (shouldProcessMessage) {
          await this.replyService.addReplyTask({ clientId: contact.id ,message,
            contactPhone: userPhone,
            clinicId: clinic.id,
            clinicPhone,
            fromMe,
            originalMessageType,
            senderName
          })
        }else {
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
    baileyDto['originalMessageType']= baileyDto.isAudio ? ORIGINAL_MESSAGE_TYPE.AUDIO : ORIGINAL_MESSAGE_TYPE.TEXT
    if(baileyDto.isAudio){
      
      baileyDto.text = await this.transcribeMessage(Buffer.from(baileyDto.mediaBuffer))
    }
    if (baileyDto.hasLocation && baileyDto.location)
    {
      baileyDto.text = `/location  latitude:${ baileyDto.location.latitude}, longitude: ${baileyDto.location.longitude}`
    }
    // do'not process if message is empty or null
    if ( ! baileyDto?.text ) {
      this.logger.log('message does not contain text', { baileyDto })
      return 'message does not contain text'
    }
    


    if (!/^\d+$/.test(baileyDto.clinicPhone)) {
      this.logger.error('clinicPhone number not numeric' + baileyDto.clinicPhone)
      return 'Phone number not numeric'
    }
    if (!/^\d+$/.test(baileyDto.userPhone)) {
      this.logger.error('userPhone number not numeric' + baileyDto.userPhone)
      return 'Phone number not numeric'
    }



    const messageInfo = {
      message : baileyDto.text,
      userPhone :BigInt(baileyDto.userPhone),
      clinicPhone: BigInt(baileyDto.clinicPhone),
      photoUrl: null,
      fromMe: baileyDto.fromMe,
      originalMessageType: baileyDto['originalMessageType'],
      senderName: baileyDto.fromMe ? '': 'PUSH NAME',
    }

    // do'not process if message is empty or null
    if (!messageInfo.message) {
      return 'success'
    }

    // Process in background
    this.processWebhook(messageInfo).catch(error => {
      this.logger.error('Error processing webhook:', error)
    })

    return 'success'
  }

}
