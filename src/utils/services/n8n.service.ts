import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

import axios, { AxiosResponse } from 'axios'
import { DateTime } from 'luxon'
import { ConfigsService } from 'src/config'
import { Clinic, Contact } from '../constants/types'

@Injectable()
export class N8NService {
  private readonly baseUrl: string
  private readonly logger = new Logger(N8NService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigsService,
  ) {
    this.baseUrl = this.configService.n8n_url
  }

  async postRequest(endpoint: string, payload: any): Promise<any> {
    const url = `${this.baseUrl}/${endpoint}`
    this.logger.log(`Sending POST request to ${url} with payload:`, payload)
    try {
      const response: AxiosResponse = await axios.post(url, payload, {
        timeout: 60000,
      })
      return response.data
    } catch (error) {
      this.logger.error(`Error in postRequest: ${error.message}`, error.stack)
      throw error
    }
  }

  async getAvailableAppointments(
    clinic: Clinic,
    contact: Contact,
    startDate: string,
    endDate: string,
  ): Promise<any> {
    const params = {
      company_id: clinic.id,
      startTime: startDate,
      endTime: endDate,
      service: [], // Removed: recommended_treatments and treatments_of_interest columns no longer exist
      crm_provider: clinic.crm_provider,
    }

    const response = await this.postRequest(
      'get_available_appointments',
      params,
    )

    const formatTime = time => (time.length === 4 ? `0${time}` : time)
    const slotsBr = {}
    for (const slot of response) {
      const dateForSlot = this.getNextWeekday(slot.DayWeek)
      const timeFrom = DateTime.fromFormat(
        `${dateForSlot} ${formatTime(slot.From)}`,
        'yyyy-MM-dd HH:mm',
        { zone: 'UTC' },
      ).toISO()
      const timeTo = DateTime.fromFormat(
        `${dateForSlot} ${formatTime(slot.To)}`,
        'yyyy-MM-dd HH:mm',
        { zone: 'UTC' },
      ).toISO()

      if (!slotsBr[dateForSlot]) {
        slotsBr[dateForSlot] = []
      }

      slotsBr[dateForSlot].push({ timeFrom: timeFrom, timeTo: timeTo })
    }
    return {
      slotsBr,
      responseSingle: response[0].From.length,
      responseDouble: response[0].To.length,
    }
  }

  private getNextWeekday(targetWeekday: number): string {
    const today = DateTime.utc()
    const daysAhead = (targetWeekday - today.weekday + 7) % 7 || 7
    return today.plus({ days: daysAhead }).toFormat('yyyy-MM-dd')
  }

  async saveContact(
    clinic: Clinic,
    contact: Contact,
    email: string,
    cpf: string,
  ): Promise<any> {
    const payload = {
      name: contact.name,
      phone: contact.phone,
      // pain_points, recommended_treatments, treatments_of_interest columns no longer exist
      email,
      cpf,
      company_id: clinic.id,
    }
    return this.postRequest('save_contact', payload)
  }

  async saveAppointment(
    clinic: Clinic,
    contact: Contact,
    date: string,
  ): Promise<any> {
    const payload = {
      name: contact.name,
      phone: contact.phone,
      date,
      company_id: clinic.id,
      crm_provider: clinic.crm_provider,
      service: [], // Removed: recommended_treatments and treatments_of_interest columns no longer exist
    }
    return this.postRequest('save_appointment', payload)
  }

  async cancelAppointment(clinic: Clinic, contact: Contact): Promise<any> {
    const payload = {
      phone: contact.phone,
      company_id: clinic.id,
      crm_provider: clinic.crm_provider,
    }
    return this.postRequest('cancel_appointment', payload)
  }
}
