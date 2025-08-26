import { Injectable, Logger } from '@nestjs/common';
import { ContectService } from 'src/contect/contect.service';
import { MessageProcessingService } from 'src/open-ai/services/message-processing.service';
import { Clinic, Contact } from 'src/utils/constant/types';
import { DatesHelper } from 'src/utils/services/dates.service';

const MAX_MESSAGES = 50;

@Injectable()
export class UnifiedMessageProcessingService {
  private readonly logger = new Logger(UnifiedMessageProcessingService.name);
  constructor(
    private readonly contactService: ContectService,
    private readonly datesHelper: DatesHelper,
    private readonly openaiMessageProcessing: MessageProcessingService,
  ) {}

  async processClientMessage(
    contact: Contact,
    text: string,
    clinicId: number,
  ): Promise<string | null> {
    const company = contact.companies as Clinic;

    if (text === '/reset') {
      await this.contactService.archiveContact(contact.id);
      return `Perfect! 🚀 You have successfully restarted the conversation. Now you can start again and send your next question or message. I'm here to help! 😊`;
    }

    const updatedContact = await this.contactService.updateContact(contact.id, {
      last_message_received: new Date(),
      total_messages: { increment: 1 } as any,
      next_smart_follow_up: null,
      last_immediate_followup_sent: null,
      nr_immediate_followups_sent: 0,
      nr_smart_followups_sent: 0,
      smart_follow_up_stop_date: null,
      objection: null,
    });

    if (updatedContact.total_messages >= MAX_MESSAGES) {
      if (updatedContact.total_messages === MAX_MESSAGES) {
        return 'Hello! 😊 You have reached the maximum number of allowed messages. To start a new conversation, just type “restart”.';
      }
      return null;
    }

    const companyTimezone = company.timezone || 'Etc/UTC';
    const nowInCompanyTimezone = this.datesHelper.localNow(companyTimezone);
    const dateAugmentedText = `
      ${text}
      [mensagem do sistema: Esta mensagem foi enviada ${this.datesHelper.localWeekdayName(nowInCompanyTimezone)} ${nowInCompanyTimezone.toISO()}
      se precisa saber os nomes dos dias próximos, utiliza estes valores:
      ${this.datesHelper.getDateAliases(companyTimezone).join(', ')}]
      `;

    // if (company.llm_stack === LlmStack.AI_SDK ) {
    //   this.logger.log(`Using Gemini for company ${clinicId}`)

    // Get the prompt from the existing assistant configuration
    //   const systemPrompt = await this.getSystemPrompt(company)
    //   const chatHistory = await this.contactService.getAiChatHistory(contact.id, true)
    //   chatHistory.push({
    //     role: 'user',
    //     content: [{
    //       type: 'text',
    //       text: dateAugmentedText
    //     }],
    //   })
    //   return await this.AiGeminiService.processMessage(
    //     updatedContact,
    //     chatHistory,
    //     systemPrompt,
    //   )
    // } else {
    this.logger.log(`Using OpenAI for company ${clinicId}`);
    return await this.openaiMessageProcessing.processClientMessage(
      updatedContact,
      dateAugmentedText,
      clinicId,
    );
    // }
    return null;
  }
}
