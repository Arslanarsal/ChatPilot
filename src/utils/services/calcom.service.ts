import { Injectable, Logger } from '@nestjs/common'
import axios, { AxiosRequestConfig } from 'axios'
import { companies } from '@prisma/client'
import { Contact } from '../constants/types'

@Injectable()
export class CalComService {
  private readonly logger = new Logger(CalComService.name)
  private readonly baseUrl = 'https://api.cal.com/v2'

  async getAvailableAppointments(
    company: companies,
    startDate: string,
    endDate: string,
  ): Promise<Record<string, any> | string> {
    const url = `${this.baseUrl}/slots/available`

    const params = {
      duration: company.cal_booking_length?.toString(),
      startTime: startDate,
      endTime: endDate,
      eventTypeId: company.cal_event_type_id?.toString(),
      eventTypeSlug: company.cal_event_slug,
    }

    const headers = {
      Authorization: `Bearer ${company.cal_api_key}`,
      'Content-Type': 'application/json',
      'cal-api-version': '2024-08-13',
    }

    const config: AxiosRequestConfig = { headers, params }

    try {
      const response = await axios.get(url, config)
      return response.data
    } catch (error: any) {
      this.logger.error('Failed to fetch available slots', error?.message)
      return 'Failed to fetch available slots'
    }
  }

  async bookAppointment(
    company: companies,
    date: string,
    name: string,
    email: string,
    phone: number,
  ): Promise<{
    success: boolean
    error: string | null
    date: string | null
    provider: string
    data: any
  }> {
    const url = `${this.baseUrl}/bookings`

    const headers = {
      Authorization: `Bearer ${company.cal_api_key}`,
      'Content-Type': 'application/json',
      'cal-api-version': '2024-08-13',
    }

    const payload = {
      start: date,
      eventTypeId: company.cal_event_type_id,
      attendee: {
        name,
        email,
        timeZone: 'America/Sao_Paulo',
        language: 'pt',
      },
      bookingFieldsResponses: {
        phone: `+${phone}`,
      },
    }

    try {
      const response = await axios.post(url, payload, { headers })
      return response.status === 201
        ? {
            success: true,
            error: null,
            date: response.data.data.start,
            provider: 'cal.com',
            data: response.data,
          }
        : {
            success: false,
            error: response.data.error,
            date: null,
            provider: 'cal.com',
            data: response.data,
          }
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'booking failed to unknown reason try again',
        date: null,
        provider: 'cal.com',
        data: null,
      }
    }
  }

  async cancelAppointment(
    company: companies,
    contact: Contact,
  ): Promise<{
    success: boolean
    error: string | null
    provider: string
    data: any
  }> {
    const url = `${this.baseUrl}/bookings/${contact.crm_appointment_id}/cancel`

    const headers = {
      Authorization: `Bearer ${company.cal_api_key}`,
      'Content-Type': 'application/json',
      'cal-api-version': '2024-08-13',
    }

    try {
      const response = await axios.post(
        url,
        {
          cancellationReason: 'User requested cancellation',
          cancelSubsequentBookings: false,
        },
        { headers },
      )
      return response.status === 200
        ? {
            success: true,
            error: null,
            provider: 'cal.com',
            data: response.data,
          }
        : {
            success: false,
            error: response.data.error,
            provider: 'cal.com',
            data: response.data,
          }
    } catch (error: any) {
      return {
        success: false,
        error:
          error?.message ||
          'cancel appointment failed to unknown reason try again',
        provider: 'cal.com',
        data: null,
      }
    }
  }
}
