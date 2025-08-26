import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { companies, follow_up_config, smart_follow_up_config } from '@prisma/client';
import { Job } from 'bullmq';
import * as fs from 'fs';
import { DateTime } from 'luxon';
import { PrismaService } from 'src/prisma/prisma.service';
import { BackgroundQueue, FollowUpJob } from 'src/utils/constant/background.constants';
import { ContectService } from 'src/contect/contect.service';
import { AUTHOR_TYPE, Contact, LlmStack } from 'src/utils/constant/types';
import { OpenAiService } from 'src/open-ai/services/open-ai.service';
import { OpenAiToolsService } from 'src/open-ai/services/open-ai-tools.service';
import { AiGoogleService } from 'src/vercel-ai/services/ai-google.service';

@Processor(BackgroundQueue.FOLLOW_UPS, { concurrency: 1 })
export class FollowUpProcessor extends WorkerHost {
  private readonly logger = new Logger(FollowUpProcessor.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly contactService: ContectService,
    private readonly openAIService: OpenAiService,
    private readonly openAiTools: OpenAiToolsService,
    private readonly AiService: AiGoogleService,
  ) {
    super();
  }
  async process(job: Job, token?: string): Promise<any> {
    switch (job.name) {
      case FollowUpJob.SEND_FOLLOW_UPS: {
        return await this.sendFollowUpsToContacts(job);
      }
      case FollowUpJob.SCHEDULE_SMART_FOLLOW_UPS: {
        return await this.scheduleSmartFollowUps();
      }
    }
    return null;
  }

  //  <======Below Code is for the FollowUpProcessor======>
  // 1
  private async sendFollowUpsToContacts(job: Job) {
    const followUps = await this.sendFollowUps();
    const timestamp = DateTime.now().toFormat('yyyy-MM-dd HH:mm');
    this.logger.log('Getting Logs :: ', followUps);
    if (followUps.length > 0) {
      fs.appendFileSync(
        './task_results.log',
        followUps
          .map((entry) => `${timestamp} - ${JSON.stringify(this.serializeData(entry))}\n`)
          .join(''),
      );
    }
    this.logger.log(`FollowUpConfigProcessor :: Sent ${followUps.length} reminders`);
    return followUps;
  }

  // 2
  async sendFollowUps(): Promise<any[]> {
    const log: any[] = [];
    try {
      const followUps: any[] = await this.getFollowUps();

      if (!followUps || followUps.length === 0) {
        this.logger.log('FollowUpConfigProcessor :: No follow ups');
        return log;
      }

      for (const followUp of followUps) {
        try {
          const contact = await this.contactService.getContactById(followUp.id);

          if (!contact) {
            this.logger.warn(
              `FollowUpConfigProcessor :: Contact with ID ${followUp.id} not found.`,
            );
            continue;
          }
          const clinic = contact.companies;
          if (
            contact.nr_immediate_followups_sent === 0 &&
            (!contact.is_bot_activated || !contact.is_replies_activated)
          ) {
            // undo messages query  when gemini-fixed
            const messages = await this.prisma.messages.findMany({
              take: 2,
              where: {
                contact_id: contact.id,
                processed: false,
              },
              orderBy: {
                sent_at: 'asc',
              },
            });
            if (messages.length > 0) {
              const booking = await this.contactService.detectBookingStatusChange(contact);
              if (booking.status === 'booked') {
                this.logger.log(
                  `FollowUpConfigProcessor :: Skipping contact ${contact.name} booking status :${booking.status}`,
                );
                continue;
              }
            }
          }
          if (!contact.is_bot_activated || !clinic?.is_bot_activated) {
            this.logger.log(
              `FollowUpConfigProcessor :: Skipping contact ${contact.id} (Bot status ${contact.is_bot_activated} Clinic-Bot Status : ${clinic?.is_bot_activated})`,
            );
            continue;
          }
          this.logger.log(
            `FollowUpConfigProcessor :: Sending follow-up for ${contact.id}`,
            contact.name,
            contact.id,
          );
          let content: string = '';
          if (clinic.llm_stack === LlmStack.OPENAI_ASSISTANT) {
            if (!contact.thread_id) {
              this.logger.warn(
                `FollowUpConfigProcessor :: Skipping ${contact.name}: Missing thread_id.`,
              );
              continue;
            }

            const run = await this.openAIService.runThread(
              clinic?.openai_assistant_id as any,
              contact.thread_id,
              followUp.prompt,
              this.openAiTools.getContactTools(contact as any),
            );

            if (!run) {
              this.logger.error(
                `FollowUpConfigProcessor :: Run failed for ${contact.name} (ID: ${contact.id})`,
              );
              continue;
            }

            const message = await this.openAIService.listMessages(contact.thread_id);
            content = message?.content || '';
          } else if (clinic.llm_stack === LlmStack.AI_SDK) {
            // const [chatHistory, assistant] = await Promise.all([
            //   this.contactService.getAiChatHistory(followUp.id),
            //   this.prisma.assistant_instructions.findFirst({
            //     where: { id: clinic.assistant_id as number },
            //   }),
            // ]);
            // if (!assistant?.prompt) {
            //   this.logger.log(
            //     `FollowUpConfigProcessor :: Skipping contact ${contact.name}  company.assistant ${assistant}`,
            //     assistant,
            //   );
            //   continue;
            // }
            // content = await this.AiService.processPrompts(
            //   contact,
            //   chatHistory,
            //   assistant?.prompt as string,
            //   followUp.prompt,
            // );
          } else {
            this.logger.log(
              `FollowUpConfigProcessor :: Skipping contact ${contact.name}  company.llm_stack ${clinic?.llm_stack}`,
            );
            continue;
          }

          log.push({
            contact: {
              contactId: contact.id,
              companyId: contact.company_id,
              name: contact.name,
              phone: contact.phone,
              thread_id: contact.thread_id,
              last_message_received: contact.last_message_received,
              nr_immediate_followups_sent: contact.nr_immediate_followups_sent + 1,
              last_immediate_followup_sent: contact.last_immediate_followup_sent,
              new_reminder_sent: new Date(),
              follow_up_message: content,
              prompt: followUp.prompt,
            },
          });

          await this.contactService.sendMessage(contact as any, content);

          // Update contact fields
          contact.nr_immediate_followups_sent += 1;
          contact.last_immediate_followup_sent = new Date();

          await this.contactService.updateContact(contact.id, {
            is_bot_activated: contact.is_bot_activated,
            thread_id: contact.thread_id,
            last_message_received: contact.last_message_received,
            nr_immediate_followups_sent: contact.nr_immediate_followups_sent,
            last_immediate_followup_sent: contact.last_immediate_followup_sent,
          });
        } catch (error) {
          this.logger.error(
            `FollowUpConfigProcessor :: Error processing follow-up for ID ${followUp.id}:`,
            error,
          );
          continue;
        }
      }
    } catch (error) {
      this.logger.error('FollowUpConfigProcessor :: Critical error in sendFollowUps:', error);
    }

    return log;
  }

  // 3
  async getFollowUps() {
    const activeFollowUpTz = await this.getTimezonesInRange(9, 20);
    const companies = await this.prisma.companies.findMany({
      where: {
        is_bot_activated: true,
        timezone: {
          in: activeFollowUpTz,
        },
      },
      include: {
        follow_up_configs: {
          where: { is_active: true },
          orderBy: { delay: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    });

    const companiesWithFollowUps = companies.filter(
      (company) => company.follow_up_configs.length > 0,
    );

    const companiesFollowUpQueries = companiesWithFollowUps.map((company) =>
      this.getCompanyFollowQuery(company),
    );

    const followUps: any = [];
    for (const followUpQuery of companiesFollowUpQueries) {
      const result: any[] = await this.prisma.$queryRawUnsafe(followUpQuery);
      followUps.push(...result);
    }
    const companiesWithOutFollowUps = companies.filter(
      (company) => company.follow_up_configs.length == 0,
    );

    if (companiesWithOutFollowUps.length > 0) {
      const companyWithOutFollowUpQuery = this.getDefaultFollowUpQuery(companiesWithOutFollowUps);

      const defaultFollowUpContacts: any = await this.prisma.$queryRawUnsafe(
        companyWithOutFollowUpQuery,
      );

      followUps.push(...defaultFollowUpContacts);
    }

    return followUps;
  }

  // 4
  async getTimezonesInRange(startingHour: number, endingHour: number): Promise<string[]> {
    const timeZones = await this.getDistinctCompanyTimezones();

    return timeZones.reduce<string[]>((activeTimezones, timezoneInfo) => {
      const currentTimeInTimezone = DateTime.now().setZone(timezoneInfo.timezone);
      const currentHour = currentTimeInTimezone.hour;

      if (currentHour >= startingHour && currentHour <= endingHour) {
        activeTimezones.push(timezoneInfo.timezone);
      }

      return activeTimezones;
    }, []);
  }

  // 5
  async getDistinctCompanyTimezones(): Promise<{ timezone: string }[]> {
    const query = `SELECT DISTINCT timezone FROM public.companies
WHERE timezone IS NOT NULL
ORDER BY timezone ASC;`;

    return await this.prisma.$queryRawUnsafe(query);
  }

  // 3.1
  getCompanyFollowQuery(company: companies & { follow_up_configs: follow_up_config[] }) {
    const followUps: follow_up_config[] = company.follow_up_configs.filter(
      (f: { is_active: any }) => f.is_active,
    );

    const delayCases = followUps
      .map((config, index) => {
        const interval = this.formatMinutesToInterval(config.delay);
        return `WHEN contacts.nr_immediate_followups_sent = ${index} THEN Greatest(contacts.last_message_received, contacts.last_immediate_followup_sent) < (NOW() - '${interval}'::INTERVAL)`;
      })
      .join('\n');

    const promptCases = followUps
      .map((config, index) => {
        const escapedPrompt = config.prompt.replace(/'/g, "''");
        return `WHEN contacts.nr_immediate_followups_sent = ${index} THEN '${escapedPrompt}'`;
      })
      .join('\n');

    const query = `
      SELECT 
        contacts.id,
        contacts.name,
        contacts.thread_id,
        contacts.company_id,
        contacts.phone,
        contacts.nr_immediate_followups_sent,
        GREATEST(contacts.last_message_received, contacts.last_immediate_followup_sent) AS last_interaction,
        CASE
          ${promptCases}
          ELSE NULL
        END AS prompt
      FROM contacts
      WHERE
        CASE
          ${delayCases}
          ELSE FALSE
        END
        AND GREATEST(contacts.last_message_received, contacts.last_immediate_followup_sent) > (NOW() - '24:00:00'::INTERVAL)

        AND contacts.schedule_event IS NULL
        AND contacts.is_willing_to_schedule IS NOT FALSE
 
        AND contacts.needs_review IS FALSE
        AND contacts.company_id = ${company.id}
        AND contacts.no_scheduling_reason IS NULL
         AND (contacts.lead_status_id NOT IN (6, 7, 8) OR contacts.lead_status_id IS NULL)
        ;
    `;

    return query;
  }

  // 3.1.1
  formatMinutesToInterval(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    const pad = (num: number) => num.toString().padStart(2, '0');

    return `${pad(hours)}:${pad(remainingMinutes)}:00`;
  }

  getDefaultFollowUpQuery(
    companies: (companies & { follow_up_configs: follow_up_config[] })[],
  ): string {
    const query = `SELECT contacts.id,
       contacts.NAME,
       contacts.thread_id,
       contacts.company_id,
       contacts.phone,
       contacts.nr_immediate_followups_sent,
       Greatest(contacts.last_message_received, contacts.last_immediate_followup_sent) AS last_interaction,
              '[System Instruction] You are a clinic attendant. The user has not responded for a while. Based on their last interaction, generate a friendly, short message in a call-to-action format, necessarily asking a question that reinforces the last call-to-action you sent. Make sure the message is short, in a call-to-action question format, and based on the recent context. Use the name of the lead only if you have this information saved in name. Otherwise, do not use vocatives. Be direct and do not share your thought process with the lead.' AS prompt
FROM   contacts
WHERE
       CASE
              WHEN contacts.nr_immediate_followups_sent = 0 THEN Greatest(contacts.last_message_received, contacts.last_immediate_followup_sent) < (Now() - '00:00:01'::interval)
              WHEN contacts.nr_immediate_followups_sent = 1 THEN greatest(contacts.last_message_received, contacts.last_immediate_followup_sent) < (now() - '00:00:20'::interval)
              ELSE false
       END
AND    greatest(contacts.last_message_received, contacts.last_immediate_followup_sent) > (now() - '24:00:00'::interval)

AND    contacts.schedule_event IS NULL
AND    contacts.is_willing_to_schedule IS NOT false

AND    contacts.needs_review IS false

  AND contacts.no_scheduling_reason IS NULL
  AND (contacts.lead_status_id NOT IN (6, 7, 8) OR contacts.lead_status_id IS NULL)
 AND contacts.company_id in (${companies
   .filter(({ follow_up_configs }) => follow_up_configs.length === 0)
   .map((company) => company.id)
   .join(',')})
	;`;

    return query;
  }

  private serializeData(data: any): any {
    if (Array.isArray(data)) return data.map(this.serializeData);
    if (data instanceof Date || DateTime.isDateTime(data)) {
      return DateTime.fromJSDate(data).toFormat('yyyy-MM-dd HH:mm');
    }
    if (typeof data === 'object' && data !== null)
      return Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, this.serializeData(value)]),
      );

    return data;
  }

  // <======scheduleSmartFollowUps======>
  async scheduleSmartFollowUps() {
    const log: any[] = [];
    try {
      // Get companies with follow-up configs
      const companies = await this.prisma.companies.findMany({
        where: {
          is_bot_activated: true,
          is_smart_followups_activated: true,
        },
        include: {
          follow_up_configs: {
            where: { is_active: true },
            orderBy: { delay: 'desc' },
          },
          smart_follow_up_configs: {
            where: { is_active: true },
          },
        },
        orderBy: {
          id: 'asc',
        },
      });
      const filteredCompanies = companies.filter((c) => c.smart_follow_up_configs.length);
      this.logger.log('companies with active smart follow-ups', filteredCompanies);
      for (const company of filteredCompanies) {
        const noOfImmediateFupsSent =
          company.follow_up_configs.length == 0 ? 2 : company.follow_up_configs.length;

        this.logger.log('noOfImmediateFupsSent', noOfImmediateFupsSent);

        const contacts = await this.prisma.contacts.findMany({
          where: {
            company_id: company.id,
            is_bot_activated: true,
            OR: [
              { lead_status_id: null },
              { lead_status_id: { in: company.smart_follow_up_configs[0].target_lead_status_ids } },
            ],
            next_smart_follow_up: null,
            thread_id: { not: null },
            nr_immediate_followups_sent: { gte: noOfImmediateFupsSent },
            nr_smart_followups_sent: 0,
            smart_follow_up_stop_date: null,
          },
          include: {
            companies: {
              include: {
                whatsapp_connector_server: true,
              },
            },
          },
        });

        this.logger.log(
          `Found ${contacts.length} contacts for smart follow-ups for company ${company.id}`,
        );
        // to test
        for (const contact of contacts) {
          try {
            // Generate the prompt with chat history and relevant context
            const schedulingPrompt = await this.generateSmartFollowUpSchedulingPrompt(
              contact as Contact,
              company.smart_follow_up_configs[0],
            );

            const aiHistory = await this.contactService.getAiChatHistory(contact.id, false);
            const content = await this.AiService.processPromptsUsingOpenAI(
              contact as Contact,
              aiHistory,
              schedulingPrompt,
              schedulingPrompt,
            );
            let parsedContent;
            try {
              function extractJsonByBraces(rawString) {
                const firstBrace = rawString.indexOf('{');
                const lastBrace = rawString.lastIndexOf('}');
                if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
                  throw new Error('Braces not found properly.');
                }
                const jsonString = rawString.slice(firstBrace, lastBrace + 1);
                return JSON.parse(jsonString);
              }

              const parsedJson = extractJsonByBraces(content);
              parsedContent = parsedJson['output-format']['follow-up'].map((followUp) => ({
                ...followUp,
                scheduled_at: DateTime.fromISO(followUp.scheduled_at).plus({ hours: 3 }).toJSDate(),
              }));
              this.logger.log('Parsed content:', parsedContent);
            } catch (error) {
              this.logger.error(`Failed to parse content as JSON: ${error.message}`, contact);
              continue;
            }

            // Parse the next follow-up date from the AI response
            const nextFollowUpDate = parsedContent[0]['scheduled_at'];
            const contactStopDate = parsedContent[parsedContent.length - 1]['scheduled_at'];

            if (nextFollowUpDate && contactStopDate) {
              const followUps = await this.prisma.smart_follow_ups.createMany({
                data: parsedContent,
              });
              this.logger.log('created smart followUps ', followUps);
              await this.contactService.updateContact(contact.id, {
                next_smart_follow_up: nextFollowUpDate,
                smart_follow_up_stop_date: contactStopDate,
              });

              log.push({
                company_name: company.name,
                contact_id: contact.id,
                company_id: contact.company_id,
                smart_follow_ups_starts_at: nextFollowUpDate,
                smart_follow_ups_ends_at: contactStopDate,
                smart_follow_ups: parsedContent,
              });
            } else {
              this.logger.error(`Failed to parse next follow-up date for contact ${contact.id}`);
            }
          } catch (error) {
            this.logger.error(
              `Error scheduling smart follow-up for contact ${contact.id}: ${error.message}`,
            );
            continue;
          }
        }
      }

      this.logger.log(`Scheduled smart follow-ups`, log);
      return log;
    } catch (error) {
      this.logger.error(`Error in scheduleSmartFollowUps: ${error.message}`);
      return log;
    }
  }

  private async generateSmartFollowUpSchedulingPrompt(
    contact: Contact,
    smartFollowUpsConfig: smart_follow_up_config,
  ): Promise<string> {
    // Get the chat history
    const defaultInstructions = ` - The follow-ups must be **evenly distributed** from now until the stop date, starting with **shorter gaps** (1-3 days), and **increasing gradually** (e.g., 4-5 days, 6-8 days, etc.).
 - Vary the scheduled time for each follow-up to avoid repetition. Do not send all messages at the same hour (e.g., not all at 14:00).
 - Follow-up times must fall between working hours:
   - **Monday to Friday**: 8:00 AM - 7:00 PM
   - **Saturday**: 8:00 AM - 2:00 PM
   - **No messages on Sunday**

   - Vary the **minutes** of each scheduled follow-up time to make them feel human.
   - Avoid all follow-ups being scheduled at exactly the top of the hour (e.g., "14:00").
   - Instead, use **random-looking but realistic minutes**, such as 07, 13, 24, 33, 48, etc.
   - Example: schedule a message at "14:17", then another at "10:41", and another at "16:33".
   - These variations must still respect allowed time ranges and be converted correctly to **UTC** in the output.

 - Choose **different time slots** for each message, randomized within high-engagement ranges:
   - Recommended slots: **10:00-11:00**, **12:00-13:00**, **15:00-16:00**, or **17:00-18:00** 
   - Example: First follow-up at 10:35 AM local time, next at 12:27 PM, next at 4:17 PM, etc.
 - **Output times must be in UTC.
 - Optimize for higher engagement times: 10-11 AM, 12-1 PM, or 4-5 PM.`;
    const messages = await this.prisma.messages.findMany({
      where: {
        contact_id: contact.id,
      },
      orderBy: {
        sent_at: 'asc',
      },
    });

    // Format the chat history
    const chatHistory = messages
      .map((msg) => {
        const role = msg.author_type === AUTHOR_TYPE.HUMAN ? 'client' : 'company';
        const timestamp = msg.sent_at
          ? DateTime.fromJSDate(msg.sent_at).toISO()
          : DateTime.now().toISO();
        return `<${role}>${timestamp}: ${msg.message}</${role}>`;
      })
      .join('\n');

    // Calculate stop date (60 days from last message from user)
    const stopDate = contact.last_message_received
      ? DateTime.fromJSDate(contact.last_message_received)
          .plus({ days: smartFollowUpsConfig.follow_up_duration_days })
          .toJSDate()
      : DateTime.now().plus({ days: smartFollowUpsConfig.follow_up_duration_days }).toJSDate();

    return `you are a marketing expert working for ${contact.companies.name} and you are trying to close a client. the client previously interacted with you.

below you will find the contact details and conversation history. Your job is it to look at the conversation history and decide when to send follow ups, craft the messages and give a short reasoning.

<instructions>
 - Schedule exactly **${smartFollowUpsConfig.follow_up_count}** follow-up messages.
      ${smartFollowUpsConfig.prompt ?? defaultInstructions}
 - Final follow-up must be scheduled on: ${DateTime.fromJSDate(stopDate).toFormat('yyyy-MM-dd')}.
</instructions>


expected output format as JSON String:
{
	"output-format": {
		"follow-up": [
			{
        "contact_id": ${contact.id},// must be this contact_id for all objects
				"scheduled_at": "2025-05-21T12:00:00Z",
				"message": "message",
				"reasoning": "good to reengage during lunch time"
			},
			{
        "contact_id": ${contact.id},
				"scheduled_at": "2025-05-25T12:00:00Z",
				"message": "message 2",
				"reasoning": "reasoning 2"
			},
      ....
		]
	}
}

<important-context>
current time: ${DateTime.now().toISO()}
name: ${contact.name || contact.whatsapp_profile_name || 'customer'}
client/contact_id : ${contact.id}
objections: ${contact.no_scheduling_reason || 'no specific objection mentioned'}
date to stop contacting: ${DateTime.fromJSDate(stopDate).toISO()}
remaining follow ups to be sent until stop date: ${smartFollowUpsConfig.follow_up_count}
</important-context>

<chat history>
${chatHistory}
</chat history>`;
  }
}
