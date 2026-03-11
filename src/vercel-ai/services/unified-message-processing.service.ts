import { Injectable, Logger } from '@nestjs/common'
import { ContactService } from 'src/contact/contact.service'
import { Contact } from 'src/utils/constants/types'
import { DatesHelper } from 'src/utils/services/dates.service'
import { AiGoogleService } from 'src/vercel-ai/services/ai-google.service'

const MAX_MESSAGES = 50

@Injectable()
export class UnifiedMessageProcessingService {
  private readonly logger = new Logger(UnifiedMessageProcessingService.name)

  constructor(
    private readonly AiGeminiService: AiGoogleService,
    private readonly contactService: ContactService,
    private readonly datesHelper: DatesHelper,
  ) { }

  async processClientMessage(
    contact: Contact,
    text: string,
    companyId: number,
    isUnauthorized: boolean,
  ): Promise<string | null> {
    this.logger.log(`contact: ${contact}`)
    if (isUnauthorized) {
      return `Please make sure you are using the same phone number registered on your chatpilot account, or contact our support team for assistance.`
    }

    if (text.toLowerCase().includes('/reset')) {
      await this.contactService.archiveContact(contact.id)
      return `Perfect! You have successfully restarted the conversation. Now you can start again and send your next question or message. I'm here to help!`;
    }
    this.logger.log(`text: ${text}`)

    const updatedContact = await this.contactService.updateContact(contact.id, {
      last_message_received: new Date(),
      total_messages: { increment: 1 } as any,
      next_smart_follow_up: null,
      last_reminder_sent: null,
      nr_reminders_sent: 0,
      smart_reminders_sent: 0,
      contact_stop_date: null
    })
    this.logger.log(`updatedContact: ${updatedContact}`)
    if (updatedContact.total_messages >= MAX_MESSAGES) {
      if (updatedContact.total_messages === MAX_MESSAGES) {
        return 'Hello! You have reached the maximum number of messages allowed. To start a new conversation, just type "reset".'
      }
      return null
    }

    const nowInCompanyTimezone = this.datesHelper.localNow()
    this.logger.log(`nowInCompanyTimezone: ${nowInCompanyTimezone}`)
    const dateAugmentedText = `
      ${text}
      [System message: This message was sent ${this.datesHelper.localWeekdayName()} ${nowInCompanyTimezone}
      if you need to know the names of the next days, use these values:
      ${this.datesHelper.getDateAliases()}]
      `
    this.logger.log(`dateAugmentedText: ${dateAugmentedText}`)
    this.logger.log(`Using Gemini for company ${companyId}`)

    const chatHistory = await this.contactService.getAiChatHistory(contact.id, true)
    chatHistory.push({
      role: 'user',
      content: [{
        type: 'text',
        text: dateAugmentedText
      }],
    })

    // Use original contact with companies relation, update total_messages
    const contactWithCompanies = {
      ...contact,
      ...updatedContact,
      companies: contact.companies,
    } as Contact;

    const response = await this.AiGeminiService.processMessage(
      contactWithCompanies,
      chatHistory,
    )

    return response.text
  }
}
