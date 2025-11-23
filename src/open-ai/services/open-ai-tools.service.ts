import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common'
import { companies, contacts, Prisma } from '@prisma/client'
import { ContactService } from '../../contact/contact.service'
import { N8nWorkflowService } from 'src/utils/services/n8n-workflow.service'
import { AppointmentService } from 'src/utils/services/appointment.service'
import { DatesHelper } from 'src/utils/services/dates.service'
import { Contact, OpenAIScheduleEventPayload } from 'src/utils/constants/types'
import { N8NService } from 'src/utils/services/n8n.service'

@Injectable()
export class OpenAiToolsService {
  private readonly logger = new Logger(OpenAiToolsService.name)
  constructor(
    @Inject(forwardRef(() => ContactService))
    private readonly contactService: ContactService,
    private readonly datesHelperService: DatesHelper,
    private readonly workflowService: N8nWorkflowService,
    private readonly appointmentService: AppointmentService,
    private readonly n8nService: N8NService,
  ) {}

  getContactTools(contact: Contact) {
    const clinic = contact.companies

    return {
      save_name: async (name: string): Promise<string> => {
        return await this.contactService.updateField(contact, 'name', name)
      },

      save_pain_points: async (painPoints: string[]): Promise<string> => {
        return await this.contactService.updateArrayField(
          contact,
          'pain_points',
          painPoints,
        )
      },

      save_recommended_treatments: async (
        recommendedTreatments: string[],
      ): Promise<string> => {
        return await this.contactService.updateArrayField(
          contact,
          'recommended_treatments',
          recommendedTreatments,
        )
      },

      save_treatments_of_interest: async (
        treatmentsOfInterest: string[],
      ): Promise<string> => {
        return await this.contactService.updateArrayField(
          contact,
          'treatments_of_interest',
          treatmentsOfInterest,
        )
      },

      save_is_willing_to_schedule: async (
        isWillingToSchedule: boolean,
      ): Promise<string> => {
        return await this.contactService.updateField(
          contact,
          'is_willing_to_schedule',
          isWillingToSchedule,
        )
      },

      save_no_scheduling_reason: async (
        noSchedulingReason: string,
      ): Promise<string> => {
        return await this.contactService.updateField(
          contact,
          'no_scheduling_reason',
          noSchedulingReason,
        )
      },

      save_is_recommendation_good: async (
        isRecommendationGood: boolean,
      ): Promise<string> => {
        return await this.contactService.updateField(
          contact,
          'is_recommendation_good',
          isRecommendationGood,
        )
      },
      // success 8 i think time zone issue
      get_available_appointments: async (
        startDate: string,
        endDate: string,
      ) => {
        const appointments =
          await this.appointmentService.getAvailableAppointments(
            clinic,
            startDate,
            endDate,
          )
        return JSON.stringify(appointments)
      },
      // success 9 i think time zone issue
      book_appointment: async (date: string) => {
        this.logger.debug('Booking appointment with params clinic :', {
          clinic,
        })
        this.logger.debug('Booking appointment with params date :', {
          date,
        })
        this.logger.debug('Booking appointment with params contact :', {
          contact,
        })
        const bookingResponse = await this.appointmentService.bookAppointment(
          clinic,
          date,
          contact?.name || '',
          'hassan.geekshub@gmail.com',
          Number(contact.phone),
        )
        if (!bookingResponse.success) {
          this.logger.error('booking tool call failed ', bookingResponse)
          return 'failed'
        }
        this.logger.log('booking response', bookingResponse)
        await Promise.all([
          this.contactService.updateContact(contact.id, {
            schedule_event: bookingResponse,
            crm_appointment_id: bookingResponse.data.data.uid,
            crm_appointment_at: bookingResponse.date,
          }),
          this.contactService.sendMessageToClinic(
            contact,
            `_Nova consulta agendada!_
    
Nome do cliente: ${contact.name}
Número: +${contact.phone}
Data e hora do agendamento: ${this.datesHelperService.toHumanDate(date)}
Procedimento de interesse: ${contact.pain_points?.join(', ') || 'Nenhum'}

https://ramp-ui.yaneq.com/${clinic.id}?phone=${contact.phone}`,
          ),
        ])
        return 'success'
      },

      set_needs_review: async (value: string) => {
        try {
          const needsReview = Boolean(value)
          const message = `Um usuário apresentou uma dúvida e a conversa precisa de revisão humana. A IA permanecerá inativa até que a questão seja resolvida. Nº do usuário: +${contact.phone}`
          await Promise.all([
            this.contactService.updateContact(contact.id, {
              needs_review: needsReview,
              is_bot_activated: !needsReview,
            }),
            this.contactService.sendMessageToClinic(contact, message),
          ])
          return 'success'
        } catch (e) {
          this.logger.log(`error in set_needs_review ${e.message}`)
          return 'failed to perform action'
        }
      },
      update_user_data: async (key: string, value: Record<string, any>) => {
        try {
          const data = contact.custom_data || {}
          data[key] = value
          await this.contactService.updateContact(contact.id, {
            custom_data: data,
          })
          return 'success'
        } catch (e) {
          this.logger.log(`error while updated contact custom data`)
          return 'failed'
        }
      },

      // not req for now
      startWorkflow: async (
        workflowName: string,
        params: any,
      ): Promise<string> => {
        return await this.workflowService.startWorkflow(workflowName, params)
      },

      save_contact_n8n: async (email: string, cpf: string) => {
        const result = await this.n8nService.saveContact(
          clinic,
          contact,
          email,
          cpf,
        )
        this.logger.log('save_contact_n8n', result)
        return JSON.stringify(result)
      },
      save_appointments_n8n: async (date: string) => {
        const result = await this.n8nService.saveAppointment(
          clinic,
          contact,
          date,
        )
        this.logger.log('save_contact_n8n', result)
        return JSON.stringify(result)
      },

      cancel_appointments_n8n: async () => {
        const result = await this.n8nService.cancelAppointment(clinic, contact)
        this.logger.log('cancel_appointments_n8n', result)
        return JSON.stringify(result)
      },
      get_available_appointments_n8n: async (
        start_date: string,
        end_date: string,
      ) => {
        const result = await this.n8nService.getAvailableAppointments(
          clinic,
          contact,
          start_date,
          end_date,
        )
        return JSON.stringify(result)
      },
      n8n_webhook: async (endpoint: string, payload: any) => {
        const body = typeof payload === 'string' ? JSON.parse(payload) : payload
        body['contact_id'] = contact.id
        body['clinic_id'] = clinic.id
        body['contact_phone'] = contact.phone
        body['contact_name'] = contact.name
        this.logger.log('open ai tool call', {
          endpoint,
          payload: body,
        })
        const data = await this.n8nService.postRequest(endpoint, body)
        return data === null ? 'null' : JSON.stringify(data)
      },

      save_lead_status: async (lead_status: number) => {
        try {
          await this.contactService.updateContact(contact.id, { lead_status })
          return 'success'
        } catch (e) {
          this.logger.error('error during save_lead_status tool call', {
            error: e.message,
            stack: e.stack,
          })
          return 'failed'
        }
      },
      cancel_appointment: async (reason:string) => {
        try {
          this.logger.log('reason ',reason)
          const appointment = await this.appointmentService.cancelAppointment(
            clinic,
            contact,
          )
          if (!appointment.success) {
            return 'false'
          }
          await this.contactService.updateContact(contact.id, {
            crm_appointment_at: null,
            schedule_event: null,
            crm_appointment_id: null,
          })
          return 'success'
        } catch (e) {
          this.logger.error('error during save_lead_status tool call', {
            error: e.message,
            stack: e.stack,
          })
          return 'failed'
        }
      },
      activate_replies : async ( is_replies_activated :boolean)=>{

        try {
          this.logger.log(`tool call activated replies :: ${contact.id} ${is_replies_activated}`)
          await this.contactService.updateContact(contact.id, { is_replies_activated })
          return 'success'
        } catch (e) {
          this.logger.error('tool call activated replies :: error during tool call', {
            error: e.message,
            stack: e.stack,
          })
          return 'failed'
        }
      },
      update_schedule_event : async ( schedule_event  :OpenAIScheduleEventPayload)=>{

        try {
          this.logger.log(`tool call update_schedule_event :: ${contact.id} ${JSON.stringify(schedule_event )}`)
          const scheduleEvent = {
            "success":true,
            "error":null,
            "date":this.datesHelperService.minusHours(new Date(schedule_event.date as string), 3),
            "provider":clinic.crm_provider,
          data:null
          }
          if(schedule_event.status === 'booked'){
            await this.contactService.updateContact(contact.id, { schedule_event: scheduleEvent })
          }
          else if(schedule_event.status === 'cancelled'){
            await this.contactService.updateContact(contact.id, {   schedule_event:Prisma.DbNull, crm_appointment_at: null, crm_appointment_id: null })
          }

          return 'success'
        } catch (e) {
          this.logger.error('tool call update_schedule_event :: error during update_schedule_event tool call', {
            error: e.message,
            stack: e.stack,
          })
          return 'failed'
        }
      },
      save_location :  async (latitude: number, longitude: number)=>{
        try {
          this.logger.log(`tool call save_location :: ${contact.id} ${latitude},${longitude}`)
          await this.contactService.updateContact(contact.id, { latitude, longitude, schedule_event:{info:'location shared donot send follow ups'} })
          return 'success'
        } catch (e) {
          this.logger.error('tool call save_location :: error during save_location tool call', {
            error: e.message,
            stack: e.stack,
          })
          return 'failed'
        }
      }
    }
  }
}
