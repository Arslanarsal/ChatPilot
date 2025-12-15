// import { Processor, WorkerHost } from '@nestjs/bullmq'
// import { Logger } from '@nestjs/common'
// import { Job } from 'bullmq'
// import {
//   BackgroundQueue,
//   FollowUpJob,
// } from 'src/utils/constants/background.constants'
// import * as fs from 'fs'
// import { DateTime } from 'luxon'
// import { PrismaService } from 'src/prisma/prisma.service'
// import { ContactService } from 'src/contact/contact.service'
// import { OpenAIService } from 'src/open-ai/services/open-ai.service'
// import { OpenAiToolsService } from 'src/open-ai/services/open-ai-tools.service'
// import { companies, contacts, follow_up_config } from '@prisma/client'
// import { AUTHOR_TYPE, Contact } from 'src/utils/constants/types'

// @Processor(BackgroundQueue.FOLLOW_UPS)
// export class FollowUpProcessor extends WorkerHost {
//   private readonly logger = new Logger(FollowUpProcessor.name)

//   constructor(
//     private prisma: PrismaService,
//     private contactService: ContactService,
//     private openAIService: OpenAIService,
//     private readonly openAiTools: OpenAiToolsService,
//   ) {
//     super()
//   }

//   async process(job: Job): Promise<any> {

//     switch (job.name) {
//       case FollowUpJob.SEND_FOLLOW_UPS: {
//         return await this.sendFollowUpsToContacts(job)
//       }
//       case FollowUpJob.BOOKING_REMINDER_1: {
//         await this.detectBookingStatusChange()
//         return await this.sendBookingReminder(1)
//       }
//       case FollowUpJob.BOOKING_REMINDER_2: {
//         return await this.sendBookingReminder(2)
//       }
//       case FollowUpJob.SCHEDULE_SMART_FOLLOW_UPS: {
//         return await this.scheduleSmartFollowUps()
//       }
//       case FollowUpJob.SEND_SMART_FOLLOW_UPS: {
//         return await this.sendSmartFollowUps()
//       }
//       default:
//         return
//     }
//   }

//   private async sendBookingReminder(bookingReminderNo: number) {
//     const log: any[] = []
//     const bookingReminder = this.bookingReminderConfig(bookingReminderNo)
//     const contacts: Contact[] = (
//       (await this.prisma.$queryRawUnsafe(bookingReminder.query)) as unknown[]
//     ).map(item => this.transformCompanyAndWs(item))
//     for (const contact of contacts) {
//       try {
//         const reminderMessage = bookingReminder.message(contact)
//         if (!contact.is_bot_activated || !contact.companies?.is_bot_activated) {
//           this.logger.log(
//             `FollowUpConfigProcessor :: Skipping contact ${contact.name} (Bot status ${contact.is_bot_activated} Clinic-Bot Status : ${contact.companies?.is_bot_activated})`,
//           )
//           continue
//         }
//         this.logger.log(
//           'FollowUpConfigProcessor :: Sending follow-up for',
//           contact.name,
//         )

//         if (!contact.thread_id) {
//           this.logger.warn(
//             `FollowUpConfigProcessor :: Skipping ${contact.name}: Missing thread_id.`,
//           )
//           continue
//         }

//         const run = await this.openAIService.runThread(
//           contact.companies?.openai_assistant_id as any,
//           contact.thread_id,
//           reminderMessage,
//           this.openAiTools.getContactTools(contact as any),
//         )

//         if (!run) {
//           this.logger.error(
//             `FollowUpConfigProcessor :: Run failed for ${contact.name} (ID: ${contact.id})`,
//           )
//           continue
//         }

//         const message = await this.openAIService.listMessages(contact.thread_id)
//         const content = message?.content || ''

//         log.push({
//           contact: {
//             contactId: contact.id,
//             companyId: contact.company_id,
//             name: contact.name,
//             phone: contact.phone,
//             thread_id: contact.thread_id,
//             last_message_received: contact.last_message_received,
//             nr_reminders_sent: contact.nr_reminders_sent + 1,
//             last_reminder_sent: contact.last_reminder_sent,
//             new_reminder_sent: new Date(),
//             schedule_event: contact.schedule_event,
//             follow_up_message: content,
//           },
//         })

//         await this.contactService.sendMessage(contact as any, content)

//         // Update contact fields
//         // contact.nr_reminders_sent += 1
//         // contact.last_reminder_sent = new Date()

//         // await this.contactService.updateContact(contact.id, {
//         //   is_bot_activated: contact.is_bot_activated,
//         //   thread_id: contact.thread_id,
//         //   last_message_received: contact.last_message_received,
//         //   nr_reminders_sent: contact.nr_reminders_sent,
//         //   last_reminder_sent: contact.last_reminder_sent,
//         // })
//       } catch (error) {
//         this.logger.error(
//           `FollowUpConfigProcessor :: Error processing follow-up for ID ${contact.id}:`,
//           error,
//         )
//         continue
//       }
//     }

//     return log
//   }

//   private async sendFollowUpsToContacts(job: Job) {
//     this.logger.log(
//       `FollowUpConfigProcessor :: Processing job ${job.id}: will send reminders to client `,
//     )
//     const followUps = await this.sendFollowUps()
//     const timestamp = DateTime.now().toFormat('yyyy-MM-dd HH:mm') // Using Luxon for formatting
//     if (followUps.length > 0) {
//       fs.appendFileSync(
//         './task_results.log',
//         followUps
//           .map(
//             entry =>
//               `${timestamp} - ${JSON.stringify(this.serializeData(entry))}\n`,
//           )
//           .join(''),
//       )
//     }
//     this.logger.log(
//       `FollowUpConfigProcessor :: Sent ${followUps.length} reminders`,
//     )
//     return followUps
//   }
//   private async sendFollowUps(): Promise<any[]> {
//     const log: any[] = []
//     try {
//       const followUps: any[] = await this.getFollowUps()

//       if (!followUps || followUps.length === 0) {
//         this.logger.log('FollowUpConfigProcessor :: No follow ups')
//         return log
//       }

//       for (const followUp of followUps) {
//         try {
//           const contact = await this.contactService.getContactById(followUp.id)

//           if (!contact) {
//             this.logger.warn(
//               `FollowUpConfigProcessor :: Contact with ID ${followUp.id} not found.`,
//             )
//             continue
//           }

//           const clinic = contact.companies

//           if (!contact.is_bot_activated || !clinic?.is_bot_activated) {
//             this.logger.log(
//               `FollowUpConfigProcessor :: Skipping contact ${contact.name} (Bot status ${contact.is_bot_activated} Clinic-Bot Status : ${clinic?.is_bot_activated})`,
//             )
//             continue
//           }

//           this.logger.log(
//             'FollowUpConfigProcessor :: Sending follow-up for',
//             contact.name,
//           )

//           if (!contact.thread_id) {
//             this.logger.warn(
//               `FollowUpConfigProcessor :: Skipping ${contact.name}: Missing thread_id.`,
//             )
//             continue
//           }
//           if (contact.nr_reminders_sent === 0) {
//             const messages = await this.prisma.messages.findMany({
//               where: {
//                 contact_id: contact.id,
//                 processed: false,
//               },
//               orderBy: {
//                 sent_at: 'asc',
//               },
//             })

//             if (messages.length > 0) {

//               const schedule_event = await this.contactService.detectBookingStatusChange(contact, messages)
//               if (schedule_event.status === "booked") {
//                 this.logger.log(`FollowUpConfigProcessor :: ContactId : ${contact.id} ${schedule_event.status} ${schedule_event.date} skipping`)
//                 continue
//               }
//             }
//           }
//           const run = await this.openAIService.runThread(
//             clinic?.openai_assistant_id as any,
//             contact.thread_id,
//             followUp.prompt,
//             this.openAiTools.getContactTools(contact as any),
//           )

//           if (!run) {
//             this.logger.error(
//               `FollowUpConfigProcessor :: Run failed for ${contact.name} (ID: ${contact.id})`,
//             )
//             continue
//           }

//           const message = await this.openAIService.listMessages(
//             contact.thread_id,
//           )
//           const content = message?.content || ''

//           log.push({
//             contact: {
//               contactId: contact.id,
//               companyId: contact.company_id,
//               name: contact.name,
//               phone: contact.phone,
//               thread_id: contact.thread_id,
//               last_message_received: contact.last_message_received,
//               nr_reminders_sent: contact.nr_reminders_sent + 1,
//               last_reminder_sent: contact.last_reminder_sent,
//               new_reminder_sent: new Date(),
//               follow_up_message: content,
//               prompt: followUp.prompt,
//             },
//           })

//           await this.contactService.sendMessage(contact as any, content)

//           // Update contact fields
//           contact.nr_reminders_sent += 1
//           contact.last_reminder_sent = new Date()

//           await this.contactService.updateContact(contact.id, {
//             is_bot_activated: contact.is_bot_activated,
//             thread_id: contact.thread_id,
//             last_message_received: contact.last_message_received,
//             nr_reminders_sent: contact.nr_reminders_sent,
//             last_reminder_sent: contact.last_reminder_sent,
//           })
//         } catch (error) {
//           this.logger.error(
//             `FollowUpConfigProcessor :: Error processing follow-up for ID ${followUp.id}:`,
//             error,
//           )
//           continue
//         }
//       }
//     } catch (error) {
//       this.logger.error(
//         'FollowUpConfigProcessor :: Critical error in sendFollowUps:',
//         error,
//       )
//     }

//     return log
//   }

//   private serializeData(data: any): any {
//     if (Array.isArray(data)) return data.map(this.serializeData)
//     if (data instanceof Date || DateTime.isDateTime(data)) {
//       return DateTime.fromJSDate(data).toFormat('yyyy-MM-dd HH:mm')
//     }
//     if (typeof data === 'object' && data !== null)
//       return Object.fromEntries(
//         Object.entries(data).map(([key, value]) => [
//           key,
//           this.serializeData(value),
//         ]),
//       )

//     return data
//   }

//   async getFollowUps() {
//     const companies = await this.prisma.companies.findMany({
//       where: { is_bot_activated: true },
//       include: {
//         follow_up_configs: {
//           where: { is_active: true },
//           orderBy: { delay: 'asc' },
//         },
//       },
//       orderBy: { id: 'asc' },
//     })
//     // filtered companies who configured followups
//     const companiesWithFollowUps = companies.filter(
//       company => company.follow_up_configs.length > 0,
//     )
//     const companiesFollowUpQueries = companiesWithFollowUps.map(company =>
//       this.getCompanyFollowQuery(company),
//     )
//     const followUps: any = []
//     for (const followUpQuery of companiesFollowUpQueries) {
//       const result: any[] = await this.prisma.$queryRawUnsafe(followUpQuery)
//       followUps.push(...result)
//     }
//     const companiesWithOutFollowUps = companies.filter(
//       company => company.follow_up_configs.length == 0,
//     )
//     const companyWithOutFollowUpQuery = this.getDefaultFollowUpQuery(
//       companiesWithOutFollowUps,
//     )
//     const defaultFollowUpContacts: any = await this.prisma.$queryRawUnsafe(
//       companyWithOutFollowUpQuery,
//     )

//     followUps.push(...defaultFollowUpContacts)

//     return followUps
//   }

//   getCompanyFollowQuery(
//     company: companies & { follow_up_configs: follow_up_config[] },
//   ) {
//     const followUps: follow_up_config[] = company.follow_up_configs.filter(
//       (f: { is_active: any }) => f.is_active,
//     )

//     const delayCases = followUps
//       .map((config, index) => {
//         const interval = this.formatMinutesToInterval(config.delay)
//         return `WHEN contacts.nr_reminders_sent = ${index} THEN Greatest(contacts.last_message_received, contacts.last_reminder_sent) < (NOW() - '${interval}'::INTERVAL)`
//       })
//       .join('\n')

//     const promptCases = followUps
//       .map((config, index) => {
//         const escapedPrompt = config.prompt.replace(/'/g, "''")
//         return `WHEN contacts.nr_reminders_sent = ${index} THEN '${escapedPrompt}'`
//       })
//       .join('\n')

//     const query = `
//       SELECT 
//         contacts.id,
//         contacts.name,
//         contacts.thread_id,
//         contacts.company_id,
//         contacts.phone,
//         contacts.nr_reminders_sent,
//         GREATEST(contacts.last_message_received, contacts.last_reminder_sent) AS last_interaction,
//         CASE
//           ${promptCases}
//           ELSE NULL
//         END AS prompt
//       FROM contacts
//       WHERE
//         CASE
//           ${delayCases}
//           ELSE FALSE
//         END
//         AND GREATEST(contacts.last_message_received, contacts.last_reminder_sent) > (NOW() - '24:00:00'::INTERVAL)
//         AND (NOW() AT TIME ZONE 'America/Sao_Paulo'::text)::time > '0${process.env.NODE_ENV === 'local' ? '1' : '9'}:00:00'::time
//         AND (NOW() AT TIME ZONE 'America/Sao_Paulo'::text)::time < '21:00:00'::time
//         AND contacts.schedule_event IS NULL
//         AND contacts.is_willing_to_schedule IS NOT FALSE
//         AND contacts.thread_id IS NOT NULL
//         AND contacts.needs_review IS FALSE
//         AND contacts.company_id = ${company.id}
//         AND contacts.is_bot_activated  = TRUE
//         AND contacts.archived_on IS NULL;
//     `

//     return query
//   }

//   formatMinutesToInterval(minutes: number): string {
//     const hours = Math.floor(minutes / 60)
//     const remainingMinutes = minutes % 60

//     const pad = (num: number) => num.toString().padStart(2, '0')

//     return `${pad(hours)}:${pad(remainingMinutes)}:00`
//   }
//   getDefaultFollowUpQuery(
//     companies: (companies & { follow_up_configs: follow_up_config[] })[],
//   ): string {
//     const query = `SELECT contacts.id,
//        contacts.NAME,
//        contacts.thread_id,
//        contacts.company_id,
//        contacts.phone,
//        contacts.nr_reminders_sent,
//        Greatest(contacts.last_message_received, contacts.last_reminder_sent) AS last_interaction,
//               '[System Instruction] The user has not responded for a while. Based on their last interaction, generate a friendly, short message with a call-to-action format, asking a question that reinforces the last call to action you sent. Make sure the message is short, in a call-to-action question format, and based on recent context.' AS prompt
// FROM   contacts
// WHERE
//        CASE
//               WHEN contacts.nr_reminders_sent = 0 THEN Greatest(contacts.last_message_received, contacts.last_reminder_sent) < (Now() - '00:30:00'::interval)
//               WHEN contacts.nr_reminders_sent = 1 THEN greatest(contacts.last_message_received, contacts.last_reminder_sent) < (now() - '04:00:00'::interval)
//               ELSE false
//        END
// AND    greatest(contacts.last_message_received, contacts.last_reminder_sent) > (now() - '24:00:00'::interval)
// AND    (
//               now() at time zone 'America/Sao_Paulo'::text)::time without time zone > '09:00:00'::time without time zone
// AND    (
//               now() at time zone 'America/Sao_Paulo'::text)::time without time zone < '21:00:00'::time without time zone
// AND    contacts.schedule_event IS NULL
// AND    contacts.is_willing_to_schedule IS NOT false
// AND    contacts.thread_id IS NOT NULL
// AND    contacts.needs_review IS false
// AND    contacts.archived_on IS NULL
//  AND contacts.is_bot_activated  = TRUE
//  AND contacts.company_id in (${companies
//         .filter(({ follow_up_configs }) => follow_up_configs.length === 0)
//         .map(company => company.id)
//         .join(',')})
// 	;`

//     return query
//   }
//   private bookingReminderConfig(bookingReminderNo: number): {
//     message: (contact: Contact) => string
//     query: string
//   } {
//     const bookingReminders = {
//       1: {
//         message: (contact: Contact) => {
//           const rawDate = (contact.schedule_event as any)?.date
//           const date = DateTime.fromISO(rawDate, { zone: 'utc' }).setZone(
//             'America/Sao_Paulo',
//           ) // or your local timezone
//           const formattedDate = date.toFormat('dd/LL') // e.g. 22/04
//           const formattedTime = date.toFormat('HH:mm') // e.g. 09:00

//           return `expected output:
//           Hi ${contact.name}, how are you?

//         Tomorrow ${formattedDate} at ${formattedTime} you have an appointment scheduled here at ${contact.companies.name}.

//         Can I confirm your attendance tomorrow?`
//         },
//         query: `
//         SELECT   c.id,
//         c.created_at,
//         c.updated_at,
//         c.name,
//         c.phone,
//         c.pain_points,
//         c.recommended_treatments,
//         c.treatments_of_interest,
//         c.is_recommendation_good,
//         c.is_willing_to_schedule,
//         c.no_scheduling_reason,
//         c.schedule_event,
//         c.thread_id,
//         c.last_message_received,
//         c.nr_reminders_sent,
//         c.last_reminder_sent,
//         c.appointment_scheduled_on,
//         c.total_messages,
//         c.needs_review,
//         c.custom_data,
//         c.company_id,
//         c.archived_on,
//         c.photo_url,
//         c.is_bot_activated,
//         c.crm_appointment_at,
//         c.crm_appointment_id,
//         c.,
//         c.whatsapp_profile_name,
//         com.id as com_id,
//         com.name as com_name,
//         com.openai_assistant_id as com_openai_assistant_id ,
//         com.cal_event_type_id AS com_cal_event_type_id,
//       com.cal_event_slug AS com_cal_event_slug,
//       com.cal_api_key AS com_cal_api_key,
//       com.cal_booking_length AS com_cal_booking_length,
//       com.phone AS com_phone,
//       com.clinic_notification_phone AS com_clinic_notification_phone,
//       com.updated_at AS com_updated_at,
//       com.is_bot_activated AS com_is_bot_activated,
//       com.wapi_id AS com_wapi_id,
//       com.url_id AS com_url_id,
//       com.whatsapp_connector_server_id AS com_whatsapp_connector_server_id,
//       com.crm_provider AS com_crm_provider,
//       com.wapi_connection_status AS com_wapi_connection_status,
//         ws.id as ws_id,
//         ws.type as ws_type,
//         ws.url  as ws_url
      
//       FROM contacts as c
//         inner join companies as com 
//         on com.id = c.company_id
//         inner join whatsapp_connector_server as ws
//         on ws.id = com.whatsapp_connector_server_id
//       WHERE c.schedule_event IS NOT NULL
//         AND (c.schedule_event::jsonb ? 'date')
//         AND  ((c.schedule_event->>'date')::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date   =(date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 day')::date;`,
//       },
//       2: {
//         message: (contact: Contact) => {
//           const rawDate = (contact.schedule_event as any)?.date
//           const date = DateTime.fromISO(rawDate, { zone: 'utc' }).setZone(
//             'America/Sao_Paulo',
//           ) // or your local timezone
//           const formattedTime = date.toFormat('HH:mm') // e.g. 09:00
//           return `expected output:
//           Bom dia, ${contact.name}! 
          
//           Te aguardamos hoje às ${formattedTime} horas!`
//         },
//         query: `
// SELECT   c.id,
//   c.created_at,
//   c.updated_at,
//   c.name,
//   c.phone,
//   c.pain_points,
//   c.recommended_treatments,
//   c.treatments_of_interest,
//   c.is_recommendation_good,
//   c.is_willing_to_schedule,
//   c.no_scheduling_reason,
//   c.schedule_event,
//   c.thread_id,
//   c.last_message_received,
//   c.nr_reminders_sent,
//   c.last_reminder_sent,
//   c.appointment_scheduled_on,
//   c.total_messages,
//   c.needs_review,
//   c.custom_data,
//   c.company_id,
//   c.archived_on,
//   c.photo_url,
//   c.is_bot_activated,
//   c.crm_appointment_at,
//   c.crm_appointment_id,
//   c.,
//   c.whatsapp_profile_name,
// 	com.id as com_id,
// 	com.name as com_name,
// 	com.openai_assistant_id as com_openai_assistant_id ,
// 	com.cal_event_type_id AS com_cal_event_type_id,
// com.cal_event_slug AS com_cal_event_slug,
// com.cal_api_key AS com_cal_api_key,
// com.cal_booking_length AS com_cal_booking_length,
// com.phone AS com_phone,
// com.clinic_notification_phone AS com_clinic_notification_phone,
// com.updated_at AS com_updated_at,
// com.is_bot_activated AS com_is_bot_activated,
// com.wapi_id AS com_wapi_id,
// com.url_id AS com_url_id,
// com.whatsapp_connector_server_id AS com_whatsapp_connector_server_id,
// com.crm_provider AS com_crm_provider,
// com.wapi_connection_status AS com_wapi_connection_status,
// 	ws.id as ws_id,
// 	ws.type as ws_type,
// 	ws.url  as ws_url

// FROM contacts as c
// 	inner join companies as com 
// 	on com.id = c.company_id
// 	inner join whatsapp_connector_server as ws
// 	on ws.id = com.whatsapp_connector_server_id
// WHERE c.schedule_event IS NOT NULL
//   AND (c.schedule_event::jsonb ? 'date')
//    AND  ((c.schedule_event->>'date')::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date   = (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') )::date
//   AND ((schedule_event->>'date')::timestamptz AT TIME ZONE 'America/Sao_Paulo')::time >= TIME '09:00';`,
//       },
//     }

//     return bookingReminders[`${bookingReminderNo}`]
//   }

//   transformCompanyAndWs(original: any): Contact {
//     const transformed: any = {}
//     const companies: any = {}
//     const whatsappConnectorServer: any = {}

//     for (const [key, value] of Object.entries(original)) {
//       if (key.startsWith('com_')) {
//         const strippedKey = key.replace(/^com_/, '')
//         companies[strippedKey] = value
//       } else if (key.startsWith('ws_')) {
//         const strippedKey = key.replace(/^ws_/, '')
//         whatsappConnectorServer[strippedKey] = value
//       } else {
//         transformed[key] = value
//       }
//     }

//     if (Object.keys(whatsappConnectorServer).length > 0) {
//       companies.whatsapp_connector_server = whatsappConnectorServer
//     }

//     transformed.companies = companies
//     return transformed as Contact
//   }
//   async scheduleSmartFollowUps() {
//     const log: any[] = []
//     try {
//       this.logger.log('Finding contacts for scheduling smart follow-ups')

//       // Get companies with follow-up configs
//       const companies = await this.prisma.companies.findMany({
//         where: {
//           is_bot_activated: true,
//         },
//         include: {
//           follow_up_configs: {
//             where: { is_active: true },
//             orderBy: { delay: 'desc' },
//           },
//         },
//         orderBy: {
//           id: 'asc',
//         },
//       })

//       for (const company of companies) {
//         // log[company.name] = []
//         // Find contacts that need smart follow-up scheduling

//         const noOfRemindersSent =
//           company.follow_up_configs.length == 0
//             ? 2
//             : company.follow_up_configs.length
//         const noOfSmartReminderSent = noOfRemindersSent + 10
//         this.logger.log('noOfRemindersSent', noOfRemindersSent)
//         this.logger.log('noOfSmartReminderSent', noOfSmartReminderSent)
//         const contacts = await this.prisma.contacts.findMany({
//           where: {
//             company_id: company.id,
//             is_bot_activated: true,
//             archived_on: null,
//           next_smart_follow_up: null,
//           thread_id: { not: null },
//           AND: [
//             {
//               OR: [
//                 {
//                   nr_reminders_sent: {
//                     gte: noOfRemindersSent,
//                   },
//                 },
//                 // { smart_reminders_sent: { gte: 0 } }, // i think to remove
//               ],
//             },
//             {
//               smart_reminders_sent: {
//                 lt: noOfSmartReminderSent,
//               },
//             },
//           ],
//         },
//           include: {
//           companies: {
//             include: {
//               whatsapp_connector_server: true,
//             },
//           },
//           // messages: {
//           //   orderBy: { sent_at: 'desc' },
//           //   // take: 20,
//           // },
//         },
//         })

//       this.logger.log(
//         `Found ${contacts.length} contacts for smart follow-ups for company ${company.id}`,
//       )
//       // to test
//       for (const contact of contacts) {
//         try {
//           // Generate the prompt with chat history and relevant context
//           const schedulingPrompt =
//             await this.generateSmartFollowUpSchedulingPrompt(
//               contact as Contact,
//             )
//           // Call OpenAI to schedule the follow-up
//           const run = await this.openAIService.runThread(
//             company.openai_assistant_id,
//             contact.thread_id as string,
//             schedulingPrompt,
//             this.openAiTools.getContactTools(contact as Contact),
//           )

//           if (!run) {
//             this.logger.error(
//               `Failed to run thread for contact ${contact.id}`,
//             )
//             continue
//           }

//           // Get the AI response
//           const message = await this.openAIService.listMessages(
//             contact.thread_id as string,
//           )
//           const content = message?.content || ''

//           let parsedContent
//           try {
//             function extractJsonByBraces(rawString) {
//               const firstBrace = rawString.indexOf('{')
//               const lastBrace = rawString.lastIndexOf('}')

//               if (
//                 firstBrace === -1 ||
//                 lastBrace === -1 ||
//                 lastBrace <= firstBrace
//               ) {
//                 throw new Error('Braces not found properly.')
//               }

//               const jsonString = rawString.slice(firstBrace, lastBrace + 1)
//               return JSON.parse(jsonString)
//             }
//             const parsedJson = extractJsonByBraces(content)
//             parsedContent = parsedJson['output-format']['follow-up'].map(followUp => ({
//               ...followUp,
//               scheduled_at: DateTime.fromISO(followUp.scheduled_at).plus({ hours: 3 }).toJSDate()
//             }))
//             this.logger.log('Parsed content:', parsedContent)
//           } catch (error) {
//             this.logger.error(
//               `Failed to parse content as JSON: ${error.message}`, contact
//             )
//             continue
//           }

//           // Parse the next follow-up date from the AI response
//           const nextFollowUpDate =
//             parsedContent[0]['scheduled_at']
//           const contactStopDate = parsedContent[parsedContent.length - 1]['scheduled_at']

//           if (nextFollowUpDate && contactStopDate) {
//             // Update the contact with the next follow-up date
//             const followUps = await this.prisma.smart_follow_ups.createMany({
//               data: parsedContent,
//             })
//             this.logger.log('created smart followUps ', followUps)
//             await this.contactService.updateContact(contact.id, {
//               next_smart_follow_up: nextFollowUpDate,
//               contact_stop_date: contactStopDate
//             })

//             log.push({
//               company_name: company.name,
//               contact_id: contact.id,
//               company_id: contact.company_id,
//               smart_follow_ups_starts_at: nextFollowUpDate,
//               smart_follow_ups_ends_at: contactStopDate,
//               smart_follow_ups: parsedContent
//             })
//           } else {
//             this.logger.error(
//               `Failed to parse next follow-up date for contact ${contact.id}`,
//             )
//           }
//         } catch (error) {
//           this.logger.error(
//             `Error scheduling smart follow-up for contact ${contact.id}: ${error.message}`,
//           )
//           continue
//         }
//       }

//       // to remove for testing only
//       if (company.follow_up_configs && company.follow_up_configs.length > 0) {
//         company.follow_up_configs = [company.follow_up_configs[0]]
//       }
//       company['contacts'] = contacts
//     }

//       this.logger.log(`Scheduled ${log.length} smart follow-ups`)
//     return log
//   } catch(error) {
//     this.logger.error(`Error in scheduleSmartFollowUps: ${error.message}`)
//     return log
//   }
// }

//   private async sendSmartFollowUps() {
//   const log: any[] = []
//   try {
//     // Find contacts with next_smart_follow_up in the past
//     const contacts = await this.prisma.contacts.findMany({
//       where: {
//         next_smart_follow_up: {
//           lt: new Date(),
//         },
//           : { not: 11 },
//     is_bot_activated: true,
//       thread_id: { not: null },
//   },
//   include: {
//     companies: {
//       include: {
//         whatsapp_connector_server: true,
//             },
//     },
//   },
// })

// this.logger.log(
//   `Found ${contacts.length} contacts with due smart follow-ups`,
// )

// for (const contact of contacts) {
//   try {
//     if (!contact.companies?.is_bot_activated) {
//       this.logger.log(
//         `Skipping contact ${contact.id} - Company bot not activated`,
//       )
//       continue
//     }

//     if (!contact.thread_id) {
//       this.logger.warn(`Contact ${contact.id} has no thread_id, skipping`)
//       continue
//     }

//     const smartFollowUps = await this.prisma.smart_follow_ups.findMany({
//       where: { contact_id: contact.id, is_sent: false },
//       orderBy: { scheduled_at: 'asc' },
//       take: 2,
//     })

//     if (!smartFollowUps || smartFollowUps.length === 0) {
//       this.logger.log(
//         `Contact ${contact.id} has no smart follow-ups, skipping`,
//       )
//       await this.contactService.updateContact(contact.id, {
//         next_smart_follow_up: null,
//       })
//       continue
//     }

//     // Generate reply prompt
//     const replyPrompt = `expected output:
//           ${smartFollowUps[0].message}
//           `

//     // Call OpenAI to generate the follow-up message
//     const run = await this.openAIService.runThread(
//       contact.companies.openai_assistant_id,
//       contact.thread_id,
//       replyPrompt,
//       this.openAiTools.getContactTools(contact as Contact),
//     )

//     if (!run) {
//       this.logger.error(`Failed to run thread for contact ${contact.id}`)
//       continue
//     }

//     // Get the AI response
//     const message = await this.openAIService.listMessages(
//       contact.thread_id,
//     )
//     const content = message?.content || ''

//     // Send the message
//     await this.contactService.sendMessage(
//       contact as Contact,
//       content,
//       undefined,
//       AUTHOR_TYPE.BOT,
//       'smart_follow_up',
//     )

//     // Update the contact
//     const updateDto = smartFollowUps.length > 1 ? { next_smart_follow_up: smartFollowUps[1].scheduled_at, } : { next_smart_follow_up: null,  : 11, objection: 'Unresponsive Contact' }
//     this.logger.log('updateDto', updateDto)
//     await this.contactService.updateContact(contact.id, {
//       ...updateDto,
//       smart_reminders_sent: { increment: 1 },
//       last_reminder_sent: new Date(),
//     })

//     await this.prisma.smart_follow_ups.update({
//       where: { id: smartFollowUps[0].id },
//       data: {
//         is_sent: true,
//       },
//     })

//     // If the contact has reached the max follow-ups, set  to Inactive (999)
//     if (contact.smart_reminders_sent >= 9) {
//       // Assuming 10 total, so after sending the 10th we set inactive
//       await this.contactService.updateContact(contact.id, {
//               : 999, // Inactive
//       })
//     }

//     log.push({
//       contact_id: contact.id,
//       company_id: contact.company_id,
//       message: content,
//       sent_at: new Date(),
//       smart_reminders_sent: contact.smart_reminders_sent + 1,
//     })
//   } catch (error) {
//     this.logger.error(
//       `Error sending smart follow-up for contact ${contact.id}: ${error.message}`,
//     )
//     continue
//   }
// }

// this.logger.log(`Sent ${log.length} smart follow-ups`)
// return log
//     } catch (error) {
//   this.logger.error(`Error in sendSmartFollowUps: ${error.message}`)
//   return log
// }
//   }

//   private async generateSmartFollowUpSchedulingPrompt(
//   contact: Contact,
// ): Promise < string > {
//   // Get the chat history
//   const messages = await this.prisma.messages.findMany({
//     where: {
//       contact_id: contact.id,
//     },
//     orderBy: {
//       sent_at: 'asc',
//     },
//   })

//     // Format the chat history
//     const chatHistory = messages
//     .map(msg => {
//       const role =
//         msg.author_type === AUTHOR_TYPE.HUMAN ? 'client' : 'company'
//       const timestamp = msg.sent_at
//         ? DateTime.fromJSDate(msg.sent_at).toISO()
//         : DateTime.now().toISO()
//       return `<${role}>${timestamp}: ${msg.message}</${role}>`
//     })
//     .join('\n')

//     // Calculate stop date (60 days from last message from user)
//     const stopDate = contact.last_message_received
//     ? DateTime.fromJSDate(contact.last_message_received)
//       .plus({ days: 60 })
//       .toJSDate()
//     : DateTime.now().plus({ days: 60 }).toJSDate()

//     // Format the prompt
//     return `you are a marketing expert working for ${contact.companies.name} and you are trying to close a client. the client previously interacted with you.

// below you will find the contact details and conversation history. Your job is it to look at the conversation history and decide when to send follow ups, craft the messages and give a short reasoning.

// <instructions>
//  - Schedule exactly **${10 - contact.smart_reminders_sent}** follow-up messages.
//  - The follow-ups must be **evenly distributed** from now until the stop date, starting with **shorter gaps** (1–3 days), and **increasing gradually** (e.g., 4–5 days, 6–8 days, etc.).
//  - Vary the scheduled time for each follow-up to avoid repetition. Do not send all messages at the same hour (e.g., not all at 14:00).
//  - Follow-up times must fall between working hours:
//    - **Monday to Friday**: 8:00 AM – 7:00 PM
//    - **Saturday**: 8:00 AM – 2:00 PM
//    - **No messages on Sunday**

//    - Vary the **minutes** of each scheduled follow-up time to make them feel human.
//    - Avoid all follow-ups being scheduled at exactly the top of the hour (e.g., "14:00").
//    - Instead, use **random-looking but realistic minutes**, such as 07, 13, 24, 33, 48, etc.
//    - Example: schedule a message at "14:17", then another at "10:41", and another at "16:33".
//    - These variations must still respect allowed time ranges and be converted correctly to **UTC** in the output.

//  - Choose **different time slots** for each message, randomized within high-engagement ranges:
//    - Recommended slots: **10:00–11:00**, **12:00–13:00**, **15:00–16:00**, or **17:00–18:00** 
//    - Example: First follow-up at 10:35 AM local time, next at 12:27 PM, next at 4:17 PM, etc.
//  - **Output times must be in UTC.
//  - Optimize for higher engagement times: 10–11 AM, 12–1 PM, or 4–5 PM.
//  - Final follow-up must be scheduled on: ${DateTime.fromJSDate(stopDate).toFormat('yyyy-MM-dd')}.
// </instructions>


// expected output format as JSON String:
// {
// 	"output-format": {
// 		"follow-up": [
// 			{
//         "contact_id": ${contact.id},// must be this contact_id for all objects
// 				"scheduled_at": "2025-05-21T12:00:00Z",
// 				"message": "message",
// 				"reasoning": "good to reengage during lunch time"
// 			},
// 			{
//         "contact_id": ${contact.id},
// 				"scheduled_at": "2025-05-25T12:00:00Z",
// 				"message": "message 2",
// 				"reasoning": "reasoning 2"
// 			},
//       ....
// 		]
// 	}
// }

// <important-context>
// current time: ${DateTime.now().toISO()}
// name: ${contact.name || contact.whatsapp_profile_name || 'customer'}
// client/contact_id : ${contact.id}
// objection: ${contact.no_scheduling_reason || 'no specific objection mentioned'}
// date to stop contacting: ${DateTime.fromJSDate(stopDate).toISO()}
// remaining follow ups to be sent until stop date: ${10 - contact.smart_reminders_sent}
// </important-context>

// <chat history>
// ${chatHistory}
// </chat history>`
// }

//   async detectBookingStatusChange()
// {
//   const contacts = await this.prisma.contacts.findMany({
//     where: {
//       last_message_received: {
//         gt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
//       },
//       messages: {
//         some: {
//           processed: true,
//         },
//       },
//     },
//     include: {
//       companies: {
//         include: {
//           whatsapp_connector_server: true
//         }
//       },
//       messages: {
//         where: {
//           processed: false,
//         },
//         orderBy: {
//           sent_at: 'asc'
//         }
//       },
//     },
//   });


//   for (const contact of contacts) {
//     if (contact.messages.length > 0) {
//       this.logger.log(`detectBookingStatusChange :: for contact ${contact.id} has ${contact.messages.length} messages`)
//       await this.contactService.detectBookingStatusChange(contact as any, contact.messages)
//     }

//   }
// }
// }