import { tool } from 'ai';
import { z } from 'zod';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common'
import { ContactService } from '../../contact/contact.service'
import { DatesHelper } from 'src/utils/services/dates.service'
import { AiSdkToolConfig, AiSdkToolsNames, Contact } from 'src/utils/constants/types'
import { PrismaService } from 'src/prisma/prisma.service'

@Injectable()
export class AiToolsService {
  private readonly logger = new Logger(AiToolsService.name);

  constructor(
    @Inject(forwardRef(() => ContactService))
    private readonly contactService: ContactService,
    private readonly datesHelperService: DatesHelper,
    private readonly prisma: PrismaService,
  ) { }

  getContactTools(contact: Contact, excludeTools: AiSdkToolsNames[] = []) {
    const company = contact.companies;
    const tools: AiSdkToolConfig = {

      save_name: tool({
        description: "Saves or updates the contact's name.",
        inputSchema: z.object({ name: z.string().describe("The name of the contact.") }),
        execute: async ({ name }) => {
          try {
            this.logger.log("tool call started", { context: "save_name", parameters: { name, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone } })
            await this.contactService.updateField(contact, 'name', name);
            this.logger.log("tool call finished", { context: "save_name", parameters: { name, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone }, result: "success" })
            return 'success';
          } catch (error) {
            this.logger.error("tool call failed", { context: "save_name", parameters: { name, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone }, result: "failed", error: error.message });
            return 'failed'
          }
        },
      }),

      // SCHEDULING INTENT
      save_is_willing_to_schedule: tool({
        description: 'Updates whether the contact is willing to schedule an appointment.',
        inputSchema: z.object({ isWillingToSchedule: z.boolean() }),
        execute: async ({ isWillingToSchedule }) => {
          try {
            this.logger.log("tool call started", { context: "save_is_willing_to_schedule", parameters: { isWillingToSchedule, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone } })
            await this.contactService.updateField(contact, 'is_willing_to_schedule', isWillingToSchedule);
            this.logger.log("tool call finished", { context: "save_is_willing_to_schedule", parameters: { isWillingToSchedule, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone }, result: "success" })
            return 'success';
          } catch (error) {
            this.logger.error("tool call failed", { context: "save_is_willing_to_schedule", parameters: { isWillingToSchedule, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone }, result: "failed", error });
            return 'failed'
          }
        },
      }),

      save_no_scheduling_reason: tool({
        description: 'Saves the reason why a contact is not willing to schedule.',
        inputSchema: z.object({ noSchedulingReason: z.string() }),
        execute: async ({ noSchedulingReason }) => {
          try {
            this.logger.log("tool call started", { context: "save_no_scheduling_reason", parameters: { noSchedulingReason, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone } })
            await this.contactService.updateField(contact, 'no_scheduling_reason', noSchedulingReason);
            this.logger.log("tool call finished", { context: "save_no_scheduling_reason", parameters: { noSchedulingReason, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone }, result: "success" })
            return 'success';
          } catch (error) {
            this.logger.error("tool call failed", { context: "save_no_scheduling_reason", parameters: { noSchedulingReason, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone }, result: "failed", error });
            return 'failed'
          }
        },
      }),

      save_is_recommendation_good: tool({
        description: 'Saves whether the AI recommendation was considered good by the contact.',
        inputSchema: z.object({ isRecommendationGood: z.boolean() }),
        execute: async ({ isRecommendationGood }) => {
          try {
            this.logger.log("tool call started", { context: "save_is_recommendation_good", parameters: { isRecommendationGood, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone } })
            await this.contactService.updateField(contact, 'is_recommendation_good', isRecommendationGood);
            this.logger.log("tool call finished", { context: "save_is_recommendation_good", parameters: { isRecommendationGood, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone }, result: "success" })
            return 'success';
          } catch (error) {
            this.logger.error("tool call failed", { context: "save_is_recommendation_good", parameters: { isRecommendationGood, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone }, result: "failed", error });
            return 'failed';
          }
        },
      }),

      // BOT & HUMAN INTERACTION
      set_needs_review: tool({
        description: 'Flags a conversation for human review and can pause the bot.',
        inputSchema: z.object({
          value: z.boolean().describe("True to flag for review, false otherwise."),
          reason: z.string().optional().describe("The reason why review is needed."),
        }),
        execute: async ({ value, reason }) => {
          try {
            this.logger.log("tool call started", { context: "set_needs_review", parameters: { value, reason, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone } })

            const message = reason ? `This client needs assistance +${contact.phone}: ${reason}` : `User question needs human review. Phone: +${contact.phone}`;

            await Promise.all([
              this.contactService.updateContact(contact.id, { needs_review: value, is_bot_activated: !value }),
              this.contactService.sendMessageToCompany(contact, message),
            ]);

            this.logger.log("tool call finished", { context: "set_needs_review", parameters: { value, reason, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone }, result: "success" })

            return 'success';
          } catch (error) {
            this.logger.error("tool call failed", { context: "set_needs_review", parameters: { value, reason, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone }, result: "failed to perform action", error });
            return 'failed to perform action';
          }
        },
      }),

      change_bot_status: tool({
        description: 'Activates or deactivates the bot for the current contact.',
        inputSchema: z.object({ status: z.boolean().describe("True to activate the bot, false to deactivate.") }),
        execute: async ({ status }) => {
          try {
            this.logger.log("tool call started", { context: "change_bot_status", parameters: { status, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone } })

            await this.contactService.updateContact(contact.id, { is_bot_activated: status });

            this.logger.log("tool call finished", { context: "change_bot_status", parameters: { status, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone }, result: "success" })

            return 'success';
          } catch (error) {
            this.logger.error("tool call failed", { context: "change_bot_status", parameters: { status, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone }, result: "failed to perform action", error });
            return 'failed to perform action';
          }
        },
      }),

      notify_company: tool({
        description: 'Sends a specified message to the company.',
        inputSchema: z.object({ message: z.string().describe("The content of the message to send.") }),
        execute: async ({ message }) => {
          try {
            this.logger.log("tool call started", { context: "notify_company", parameters: { message, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone } })

            await this.contactService.sendMessageToCompany(contact, `${message}\n\n${contact.name ? `Client name: ${contact.name}` : ''}\nPhone: +${contact.phone}`);

            this.logger.log("tool call finished", { context: "notify_company", parameters: { message, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone }, result: "success" })

            return 'success';
          } catch (error) {
            this.logger.error("tool call failed", { context: "notify_company", parameters: { message, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone }, result: "failed to perform action", error });
            return 'failed to perform action';
          }
        },
      }),

      activate_replies: tool({
        description: 'Activates or deactivates automatic replies for the contact.',
        inputSchema: z.object({ is_replies_activated: z.boolean().describe('True to activate replies, false to deactivate.') }),
        execute: async ({ is_replies_activated }) => {
          try {
            this.logger.log("tool call started", { context: "activate_replies", parameters: { is_replies_activated, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone } })

            await this.contactService.updateContact(contact.id, { is_replies_activated });

            this.logger.log("tool call finished", { context: "activate_replies", parameters: { is_replies_activated, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone }, result: "success" })

            return 'success';
          } catch (error) {
            this.logger.error("tool call failed", { context: "activate_replies", parameters: { is_replies_activated, contactId: contact.id, contactPhone: contact.phone, companyId: company.id, companyPhone: company.phone }, result: "failed to perform action", error });
            return "failed to perform action";
          }
        },
      }),
    };

    // Filter out excluded tools
    const allTools = { ...tools };
    excludeTools.forEach(toolName => {
      if (toolName in allTools) {
        delete allTools[toolName];
      }
    });

    return allTools;
  }
}
