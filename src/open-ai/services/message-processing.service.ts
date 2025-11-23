// message-processing.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { contacts, companies, messages } from '@prisma/client'
import { OpenAIService } from './open-ai.service'
import { DatesHelper } from '../../utils/services/dates.service'
import { ContactService } from 'src/contact/contact.service'
import { OpenAiToolsService } from './open-ai-tools.service'
import { Clinic, Contact } from 'src/utils/constants/types'

const MAX_MESSAGES = 50

@Injectable()
export class MessageProcessingService {
  private readonly logger = new Logger(MessageProcessingService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAIService: OpenAIService,
    private readonly datesHelper: DatesHelper,
    private readonly contactService: ContactService,
    private readonly openAiToolsService: OpenAiToolsService,
  ) {}

  async processClientMessage(
    contact: Contact,
    text: string,
    clinicId: number,
  ): Promise<string | null> {
    try {
      const clinic = contact.companies as companies

      // Handle special commands
      if (text === '/reset') {
        await this.contactService.updateContact(contact.id, {
          thread_id: null,
        })
        return 'Thread cleared. Please start the conversation again'
      }

      if (text.toLowerCase() === 'reiniciar') {
        await this.contactService.reiniciar(contact.id)
        return 'Perfeito! 🚀 Você reiniciou a conversa com sucesso. Agora pode começar de novo e enviar sua próxima pergunta ou mensagem. Estou aqui para ajudar! 😊'
        // return `Perfect! 🚀 You have successfully restarted the conversation. Now you can start again and send your next question or message. I'm here to help! 😊`;
      }
           // Update contact properties
      const updatedContact = await this.contactService.updateContact(contact.id, {
        last_message_received: new Date(),
        total_messages: { increment: 1 },
        next_smart_follow_up: null,
        last_reminder_sent: null,
        nr_reminders_sent: 0,
        smart_reminders_sent: 0,
        contact_stop_date: null,
        objection: null,
        // lead_status :null
      })


 
      if (updatedContact.total_messages >= MAX_MESSAGES) {
        if (updatedContact.total_messages === MAX_MESSAGES) {
          return 'Olá! 😊 Você atingiu o número máximo de mensagens permitidas. Para começar uma nova conversa, é só digitar “reiniciar”.'
        }
        return null
      }

      if (updatedContact.needs_review) {
        await this.handleNeedsReview(
          updatedContact as Contact,
          clinic as Clinic,
        )
        return null
      }

      // Handle OpenAI thread processing
      let threadId = updatedContact.thread_id
      if (!threadId) {
        const thread = await this.openAIService.createThread()
        threadId = thread.id
        await Promise.all([
          this.contactService.updateContact(contact.id, {
            thread_id: threadId,
          }),
          this.notifyNewConversation(
            updatedContact as Contact,
            clinic as Clinic,
          ),
        ])
      }

      const run = await this.openAIService.runThread(
        clinic.openai_assistant_id,
        threadId,
        text,
        this.openAiToolsService.getContactTools(contact as Contact),
      )

      if (!run) {
        await this.handleNeedsReview(
          updatedContact as Contact,
          clinic as Clinic,
        )
        return null
        // return '🛠️ Olá! Nosso sistema está passando por uma manutenção. Voltaremos em breve! 🚀 Obrigado pela compreensão! 😊'
      }

      const message = await this.openAIService.listMessages(threadId)
      return message.content
    } catch (error) {
      this.logger.error(`Error processing message: ${error.message}`)
      throw error
    }
  }

  private async handleNeedsReview(
    contact: Contact,
    clinic: Clinic,
  ): Promise<void> {
    await this.openAiToolsService
      .getContactTools(contact)
      .set_needs_review('true')
  }

  private async notifyNewConversation(
    contact: Contact,
    clinic: Clinic,
  ): Promise<void> {
    const message = `_Nova conversa:_ https://ramp-ui.yaneq.com/${clinic.id}?phone=${contact.phone}`
    await Promise.all([
      this.contactService.sendMessageToDevs(contact, message),
      this.contactService.sendMessageToClinic(
        contact,
        `Novo atendimento iniciado: ${contact.phone}`,
      ),
    ])
    this.logger.log(`New conversation: ${message}`)
  }
}
