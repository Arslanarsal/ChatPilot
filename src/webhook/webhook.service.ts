import { Injectable, Logger } from '@nestjs/common';
import { ReplyService } from 'src/background-tasks/services/reply.service';
import { ContectService } from 'src/contect/contect.service';
import { AUTHOR_TYPE, ORIGINAL_MESSAGE_TYPE } from 'src/utils/constant/types';
import { shouldBotDeactivated, shouldBotReply } from 'src/utils/schedule.ts';
import { ClinicService } from '../clinic/clinic.service';
import { WhatsBaileyDto } from './dto/createWebhook.dto';
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private clinicService: ClinicService,
    private contactService: ContectService,
    private replyService: ReplyService,
  ) {}

  private async processWebhook({
    message,
    userPhone,
    clinicPhone,
    photoUrl,
    fromMe,
    originalMessageType,
    senderName,
    externalAdReply = null,
  }: {
    message: string;
    userPhone: BigInt;
    clinicPhone: BigInt;
    photoUrl: string | null;
    fromMe: boolean;
    originalMessageType: ORIGINAL_MESSAGE_TYPE;
    senderName: string | null;
    externalAdReply?: any | null;
  }) {
    try {
      this.logger.log('Receving message in Process WebHook ', {
        message,
        userPhone,
        clinicPhone,
        photoUrl,
        fromMe,
        originalMessageType,
        senderName,
        externalAdReply,
      });

      const clinic = await this.clinicService.findByPhone(Number(clinicPhone));

      this.logger.log(clinic);

      if (!clinic) {
        this.logger.error('Clinic not found', {
          clinicPhone,
          asNumber: Number(clinicPhone),
        });
        return;
      }

      const contact = await this.contactService.getOrCreateContact(
        clinic,
        Number(userPhone),
        senderName,
      );

      if (!contact) {
        this.logger.error('Contact not found');
        return;
      }

      if (fromMe) {
        //     // Save  OutGoing Message from Company itself
        this.logger.log('message is from clinic staff, deactivate bot', {
          contact,
        });
        await Promise.all([
          this.contactService.saveOutgoingMessage(
            contact,
            message,
            null,
            AUTHOR_TYPE.USER,
            originalMessageType,
            'whatsapp',
          ),
          this.contactService.updateContact(contact.id, {
            is_replies_activated: false,
            is_bot_activated: contact.companies.deactivate_on_human_reply ? false : true,
          }),
        ]);
      } else {
        if (!contact.whatsapp_profile_name) {
          this.contactService.updateContact(contact.id, {
            whatsapp_profile_name: senderName,
          });
        }
        // incoming Message

        const saveMessage = await Promise.all([
          // this.contactService.resetFollowUps(contact.id),
          this.contactService.saveIncomingMessage(contact, message, originalMessageType),
        ]);

        this.logger.log('Save Out going message :', saveMessage);
        this.logger.verbose('After creating contact', contact);
        const isFirstInteraction = contact.total_messages === 0;
        // const isFirstInteraction = contact.total_messages === 0 && contact.last_message_received === null;
        const deactivateBot = isFirstInteraction
          ? shouldBotDeactivated(contact.companies.bot_reply_to, externalAdReply ? true : false)
          : false;

        this.logger.log(
          `company: ${contact.companies.name} bot_reply_to: ${contact.companies.bot_reply_to} isFirstInteraction: ${isFirstInteraction} is_from_ad: ${externalAdReply ? true : false} deactivateBot: ${deactivateBot}  contactId: ${contact.id} `,
        );

        if (deactivateBot) {
          await this.contactService.updateContact(contact.id, {
            is_bot_activated: false,
          });
        }

        const shouldProcessMessage =
          message.toLowerCase() === '/reset' || (shouldBotReply(clinic, contact) && !deactivateBot);

        if (shouldProcessMessage) {
          await this.replyService.addReplyTask({
            clientId: contact.id,
            message,
            contactPhone: userPhone,
            clinicId: clinic.id,
            clinicPhone,
            fromMe,
            originalMessageType,
            senderName,
          });
        } else {
          // await this.contactService.markUnread(contact)
        }
      }
    } catch (error) {
      //     this.logger.error('Error in processWebhook:', error)
      //     throw error
    }
  }

  async whatsBailyWebhook(baileyDto: WhatsBaileyDto) {
    // this.logger.verbose('Bailey webhook received', baileyDto)
    baileyDto['originalMessageType'] = baileyDto.isAudio
      ? ORIGINAL_MESSAGE_TYPE.AUDIO
      : ORIGINAL_MESSAGE_TYPE.TEXT;
    //   this.logger.log(  baileyDto )
    if (baileyDto.isAudio) {
      this.logger.log(baileyDto.mediaBuffer);
      // baileyDto.text = await this.ttsService.transcribeMessage(
      //     Buffer.from(baileyDto.mediaBuffer),
      // )
    }

    if (!baileyDto?.text) {
      this.logger.log('message does not contain text', { baileyDto });
      return 'message does not contain text';
    }

    if (!/^\d+$/.test(baileyDto.clinicPhone)) {
      this.logger.error('clinicPhone number not numeric' + baileyDto.clinicPhone);
      return 'Phone number not numeric';
    }

    if (!/^\d+$/.test(baileyDto.userPhone)) {
      this.logger.error('userPhone number not numeric' + baileyDto.userPhone);
      return 'Phone number not numeric';
    }

    const messageInfo = {
      message: baileyDto.text,
      userPhone: BigInt(baileyDto.userPhone),
      clinicPhone: BigInt(baileyDto.clinicPhone),
      photoUrl: null,
      fromMe: baileyDto.fromMe,
      originalMessageType: baileyDto['originalMessageType'],
      senderName: baileyDto.fromMe ? null : (baileyDto?.senderName ?? null),
      externalAdReply: baileyDto?.externalAdReply ?? null,
    };

    if (!messageInfo.message) {
      return 'success';
    }

    this.processWebhook(messageInfo).catch((error) => {
      this.logger.error('Error processing webhook:', error);
    });
    return 'success';
  }
}
