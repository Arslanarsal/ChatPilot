import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { MessageProcessingService } from 'src/open-ai/services/message-processing.service'
import { BackgroundQueue } from 'src/utils/constants/background.constants'
import { ContactService } from 'src/contact/contact.service'
import { AUTHOR_TYPE, Clinic, Contact } from 'src/utils/constants/types'
import { WhatsAppFormatter } from '../../utils/services/whatsapp-formatter.helper'
import { messages } from '@prisma/client'

@Processor(BackgroundQueue.REPLIES, { concurrency: 1 })
export class ReplyProcessor extends WorkerHost {
  private readonly logger = new Logger(ReplyProcessor.name)
  constructor(
    private readonly contactService: ContactService,
    private readonly messageProcessingService: MessageProcessingService,
    private readonly WaFormattingService: WhatsAppFormatter,
  ) {
    super()
  }
  async process(job: Job, token?: string): Promise<any> {
    const contact = await this.contactService.getUnProcessedMessages(
      job.data.clientId,
    )
    const contactMessagesList = contact?.messages
    const replyMessages: any = []

    this.contactService.mockTypingState(contact as Contact)
    if (contact) {
      if (contact.messages.length > 0) {
    
        const clinic = contact.companies as Clinic;
        const combinedMessages = this.formatMessage(contact.messages);
        this.logger.log(`combinedMessages: ${combinedMessages}`)

        const openAIMessage =
          await this.messageProcessingService.processClientMessage(
            contact as any,
            combinedMessages,
            contact?.companies?.id as number,
          )

        this.logger.log(`open AI Message ===> ${contact.phone} `, {
          openAIMessage,
          contactInfo: `${contact.phone}  clinicPhone: ${clinic.phone} `,
        })
        // save message in db and also send to contact
        if (!openAIMessage) {
          await this.contactService.markMessagesProcessed(contact)
          return {
            messagesProcessed: contactMessagesList,
            generatedReplies: replyMessages,
          }
        }
        const contentParts =
          this.WaFormattingService.splitMessage(openAIMessage)

        for (let i = 0; i < contentParts.length; i++) {
          const part = contentParts[i]
          const image = this.WaFormattingService.getMarkdownImage(part)

          if (image) {
            await this.contactService.sendMessage(
              contact as Contact,
              image.alt_text,
              image.url,
            )
            replyMessages.push({
              message: image.alt_text,
              image: image.url,
            })
          } else {
            await this.contactService.sendMessage(contact as Contact, part)
            replyMessages.push({ message: part })
          }
        }
        await this.contactService.markMessagesProcessed(contact)
      } else {
        this.logger.log(`message processing not required `)
      }
    } else {
      this.logger.error('Contact not found')
    }
    this.contactService.clearTypingState(contact as Contact)
    return {
      messagesProcessed: contactMessagesList,
      generatedReplies: replyMessages,
    }
  }

  formatMessage(messages:messages[]):string {
    const isIncludeCompanyReply = messages.some(msg => msg.author_type === AUTHOR_TYPE.USER_WHATSAPP);
    const resetTriggers = ['reiniciar', '/reset'];

    const matchedReset = messages.find(msg =>
      resetTriggers.includes(msg.message.toLowerCase())
    );
    
    const isResetChat = Boolean(matchedReset);
    const matchedText = matchedReset?.message || '';
    
    if(isResetChat)
    {
      return matchedText 
    }
    if(isIncludeCompanyReply)
    {
      const lastWAUserMsgIndex = messages.length - 1 - messages.slice().reverse().findIndex(msg => msg.author_type === AUTHOR_TYPE.USER_WHATSAPP);
      const doNotReplyMsg =messages.slice(0,lastWAUserMsgIndex +1) 
      const needToReplyMsg =messages.slice(lastWAUserMsgIndex +1,messages.length )
      return `  
      Instructions
      Ignore messages in <do-not-reply> tags — use for context only. however you can tool call on these.
       however you can save recommended treatment, save contact details other other tools calls to update context in database
      <do-not-reply>  ${this.toXmlFormat(doNotReplyMsg)} </do-not-reply>

      Respond only to messages in <probably-need-to-reply> tags.
                 <probably-need-to-reply> ${this.toXmlFormat(needToReplyMsg)} </probably-need-to-reply>`
    }

    else {
     return `<need-to-reply> ${this.toXmlFormat(messages)} </need-to-reply>`
    }
  }

  toXmlFormat(messages: messages[]): string {
    return messages.reduce((xml, msg) => {
      if (msg.author_type === AUTHOR_TYPE.USER_WHATSAPP) {
        return xml + `<company-manual-reply>${msg.message}</company-manual-reply>`;
      } else if (msg.author_type === AUTHOR_TYPE.HUMAN) {
        return xml + `<user-message>${msg.message}</user-message>`;
      } else {
        return xml + `<bot-message>${msg.message}</bot-message>`;
      }
    }, '');
  }
  
}
