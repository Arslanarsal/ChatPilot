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

      if (text === '/reset') {
        await this.contactService.updateContact(contact.id, {
          thread_id: null,
        });
        return 'Thread cleared. Please start the conversation again';
      }

      // Handle OpenAI thread processing
      let threadId = contact.thread_id;
      if (!threadId) {
        const thread = await this.openAIService.createThread();
        threadId = thread.id;
        await Promise.all([
          this.contactService.updateContact(contact.id, {
            thread_id: threadId,
          }),
          this.notifyNewConversation(contact as Contact, clinic as Clinic),
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

  private async notifyNewConversation(contact: Contact, clinic: Clinic): Promise<void> {
    const message = `New conversation started with Phone Number ${contact.phone} in clinic ${clinic.id}`;
    await Promise.all([this.contactService.sendMessageToDevs(contact, message)]);
    this.logger.log(`New conversation: ${message}`);
  }
}
