import { Injectable, Logger } from '@nestjs/common';
import { Contact } from 'src/utils/constant/types';

@Injectable()
export class OpenAiToolsService {
  private readonly logger = new Logger(OpenAiToolsService.name);

  constructor() {}

  getContactTools(contact: Contact) {
    return {
      set_needs_review: async (value: string, reason?: string) => {
        try {
          const needsReview = Boolean(value);
          const message = reason
            ? `Este cliente precisa de ajuda +${contact.phone}: ${reason}`
            : `Um usuário apresentou uma dúvida e a conversa precisa de revisão humana. A IA permanecerá inativa até que a questão seja resolvida. Nº do usuário: +${contact.phone}`;

          await Promise.all([
            // this.contactService.updateContact(contact.id, {
            //   needs_review: needsReview,
            //   is_bot_activated: !needsReview,
            // }),
            // this.contactService.sendMessageToClinic(contact, message),
          ]);
          return 'success';
        } catch (e) {
          this.logger.log(`error in set_needs_review ${e.message}`);
          return 'failed to perform action';
        }
      },
    };
  }
}
