import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { messages } from '@prisma/client';
import { Job } from 'bullmq';
import { ContectService } from 'src/contect/contect.service';
import { BackgroundQueue } from 'src/utils/constant/background.constants';
import { AUTHOR_TYPE, Clinic, Contact, ORIGINAL_MESSAGE_TYPE } from 'src/utils/constant/types';
import { WhatsAppFormatter } from 'src/utils/services/whatsapp-formatter.helper';
import { UnifiedMessageProcessingService } from 'src/vercel-ai/services/unified-message-processing.service';

@Processor(BackgroundQueue.REPLIES, { concurrency: 1 })
export class ReplyProcessor extends WorkerHost {
  private readonly logger = new Logger(ReplyProcessor.name);

  constructor(
    private readonly contactService: ContectService,
    private readonly unifiedMessageProcessing: UnifiedMessageProcessingService,
    private readonly WaFormattingService: WhatsAppFormatter,
  ) {
    super();
  }

  async process(job: Job, token?: string): Promise<any> {
    const contact = await this.contactService.getUnProcessedMessages(job.data.clientId);
    const contactMessagesList = contact?.messages;
    const replyMessages: any = [];

    const isVoiceMode =
      contactMessagesList?.some((message) => message.original_message_type === 'audio') || false;

    // this.contactService.mockTypingState(contact as Contact, isVoiceMode)
    if (contact) {
      if (contact.messages.length > 0) {
        const clinic = contact.companies as Clinic;
        const combinedMessages = this.formatMessage(contact.messages);
        this.logger.log(`combinedMessages: ${combinedMessages}`);

        const shouldProcessMessage =
          combinedMessages.toLowerCase() === '/reset' ||
          (clinic.is_bot_activated && contact.is_bot_activated && contact.is_replies_activated);

        if (shouldProcessMessage) {
          const openAIMessage = await this.unifiedMessageProcessing.processClientMessage(
            contact as any,
            combinedMessages,
            contact?.companies?.id as number,
          );

          this.logger.log(`open AI Message ===> ${contact.phone} `, {
            openAIMessage,
            contactInfo: `${contact.phone}  clinicPhone: ${clinic.phone} `,
          });
          // save message in db and also send to contact
          if (!openAIMessage) {
            this.logger.error(`No openAIMessage generated for contact ${contact.phone}`);
            await this.contactService.markMessagesProcessed(contact);
            return {
              messagesProcessed: contactMessagesList,
              generatedReplies: replyMessages,
            };
          }
          const contentParts = this.WaFormattingService.splitMessage(openAIMessage);

          for (const part of contentParts) {
            const image = this.WaFormattingService.getMarkdownImage(part);

            // Handle markdown image
            if (image) {
              await this.contactService.sendMessage(
                contact as Contact,
                image.alt_text,
                image.url,
                AUTHOR_TYPE.BOT,
                null,
                ORIGINAL_MESSAGE_TYPE.IMAGE,
              );
              replyMessages.push({ message: image.alt_text, image: image.url });
              continue;
            }

            // Handle voice mode with audio generation
            // if (isVoiceMode) {
            //   const audioBuffer = await this.ttsService.tts_open_ai(part);

            //   if (audioBuffer) {
            //     const fileName = `${contact.companies?.id}-${contact.phone}.mp3`;
            //     const publicUrl = await this.storageService.uploadToSupabase(fileName, audioBuffer);

            //     if (publicUrl) {
            //       await this.contactService.sendMessage(
            //         contact as Contact,
            //         part,
            //         publicUrl,
            //         AUTHOR_TYPE.BOT,
            //         null,
            //         ORIGINAL_MESSAGE_TYPE.AUDIO
            //       );

            //       replyMessages.push({ message: part, image: publicUrl });
            //       continue;
            //     }
            //   }
            // }

            // Default to text message
            await this.contactService.sendMessage(contact as Contact, part);
            replyMessages.push({ message: part });
          }

          // await this.contactService.markMessagesProcessed(contact)
        }
      } else {
        this.logger.log(`message processing not required `);
      }
    } else {
      this.logger.error('Contact not found');
    }
    // this.contactService.clearTypingState(contact as Contact)
    return {
      messagesProcessed: contactMessagesList,
      generatedReplies: replyMessages,
    };
  }

  formatMessage(messages: messages[]): string {
    const isIncludeCompanyReply = messages.some(
      (msg) =>
        msg.author_type === AUTHOR_TYPE.USER_WHATSAPP || msg.author_type === AUTHOR_TYPE.USER,
    );
    const resetTriggers = ['reiniciar', '/reset'];

    const matchedReset = messages.find((msg) => resetTriggers.includes(msg.message.toLowerCase()));

    const isResetChat = Boolean(matchedReset);
    const matchedText = matchedReset?.message || '';

    if (isResetChat) {
      return matchedText;
    }
    if (isIncludeCompanyReply) {
      const lastWAUserMsgIndex =
        messages.length -
        1 -
        messages
          .slice()
          .reverse()
          .findIndex(
            (msg) =>
              msg.author_type === AUTHOR_TYPE.USER_WHATSAPP || msg.author_type === AUTHOR_TYPE.USER,
          );

      const doNotReplyMsg = messages.slice(0, lastWAUserMsgIndex + 1);
      const needToReplyMsg = messages.slice(lastWAUserMsgIndex + 1, messages.length);
      return `  
          Instructions
          Ignore messages in <do-not-reply> tags — use for context only. however you can tool call on these.
           however you can save recommended treatment, save contact details other other tools calls to update context in database
          <do-not-reply>  ${this.toXmlFormat(doNotReplyMsg)} </do-not-reply>
    
          Respond only to messages in <probably-need-to-reply> tags.
                     <probably-need-to-reply> ${this.toXmlFormat(needToReplyMsg)} </probably-need-to-reply>`;
    } else {
      return `<need-to-reply> ${this.toXmlFormat(messages)} </need-to-reply>`;
    }
  }

  toXmlFormat(messages: messages[]): string {
    return messages.reduce((xml, msg) => {
      if (msg.author_type === AUTHOR_TYPE.USER_WHATSAPP || msg.author_type === AUTHOR_TYPE.USER) {
        return xml + `<company-manual-reply>${msg.message}</company-manual-reply>`;
      } else if (msg.author_type === AUTHOR_TYPE.HUMAN) {
        return xml + `<user-message>${msg.message}</user-message>`;
      } else {
        return xml + `<bot-message>${msg.message}</bot-message>`;
      }
    }, '');
  }
}
