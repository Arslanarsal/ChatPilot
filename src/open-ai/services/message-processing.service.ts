import { Injectable, Logger } from '@nestjs/common';
import { companies } from '@prisma/client';
import { ContectService } from 'src/contect/contect.service';
import { Clinic, Contact } from 'src/utils/constant/types';
import { OpenAiToolsService } from './open-ai-tools.service';
import { OpenAiService } from './open-ai.service';

@Injectable()
export class MessageProcessingService {
  private readonly logger = new Logger(MessageProcessingService.name);
  constructor(
    private openAIService: OpenAiService,
    private readonly contactService: ContectService,
    private readonly openAiToolsService: OpenAiToolsService,
  ) {}

  async processClientMessage(
    contact: Contact,
    text: string,
    clinicId: number,
  ): Promise<string | null> {
    try {
      const clinic = contact.companies as companies;

      // Handle special commands
      // if (text === '/reset') {
      //   await this.contactService.updateContact(contact.id, {
      //     thread_id: null,
      //   })
      //   return 'Thread cleared. Please start the conversation again'
      // }

      // if (text.toLowerCase() === 'reiniciar') {
      //   await this.contactService.reiniciar(contact.id)
      //   return 'Perfeito! 🚀 Você reiniciou a conversa com sucesso. Agora pode começar de novo e enviar sua próxima pergunta ou mensagem. Estou aqui para ajudar! 😊'
      //   // return `Perfect! 🚀 You have successfully restarted the conversation. Now you can start again and send your next question or message. I'm here to help! 😊`;
      // }
      //      // Update contact properties
      // const updatedContact = await this.contactService.updateContact(contact.id, {
      //   last_message_received: new Date(),
      //   total_messages: { increment: 1 },
      //   next_smart_follow_up: null,
      //   last_immediate_followup_sent: null,
      //   nr_immediate_followups_sent: 0,
      //   nr_smart_followups_sent: 0,
      //   smart_follow_up_stop_date: null,
      //   objection: null,
      //   // lead_status :null
      // })

      // if (updatedContact.total_messages >= MAX_MESSAGES) {
      //   if (updatedContact.total_messages === MAX_MESSAGES) {
      //     return 'Olá! 😊 Você atingiu o número máximo de mensagens permitidas. Para começar uma nova conversa, é só digitar “reiniciar”.'
      //   }
      //   return null
      // }

      // if (updatedContact.needs_review) {
      //   await this.handleNeedsReview(
      //     updatedContact as Contact,
      //     clinic as Clinic,
      //   )
      //   return null
      // }

      // Handle OpenAI thread processing
      let threadId = contact.thread_id;
      if (!threadId) {
        const thread = await this.openAIService.createThread();
        threadId = thread.id;
        await Promise.all([
          this.contactService.updateContact(contact.id, {
            thread_id: threadId,
          }),
          // this.notifyNewConversation(
          //   contact as Contact,
          //   clinic as Clinic,
          // ),
        ]);
      }

      const run = await this.openAIService.runThread(
        clinic.openai_assistant_id,
        threadId,
        text,
        this.openAiToolsService.getContactTools(contact as Contact),
      );

      if (!run) {
        await this.handleNeedsReview(contact as Contact, clinic as Clinic);
        return null;
      }

      const message = await this.openAIService.listMessages(threadId);
      return message.content;
    } catch (error) {
      this.logger.error(`Error processing message: ${error.message}`, {
        input: { contact, text },
        err: error,
      });
      throw error;
    }
  }

  private async handleNeedsReview(contact: Contact, clinic: Clinic): Promise<void> {
    await this.openAiToolsService.getContactTools(contact).set_needs_review('true');
  }
}
