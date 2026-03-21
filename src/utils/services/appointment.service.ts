import { Injectable, Logger } from '@nestjs/common'
import { DatesHelper } from './dates.service'
import { companies } from '@prisma/client'
import { CalComService } from './calcom.service'
import { Contact } from '../constants/types'

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name)
  constructor(
    private readonly datesHelper: DatesHelper,

    private readonly CalComService: CalComService,
  ) {}

  async getAvailableAppointments(
    company: companies,
    startDate: string,
    endDate: string,
  ): Promise<Record<string, any> | string> {
    try {
      let response
      if (company.crm_provider === 'cal.com') {
        response = await this.CalComService.getAvailableAppointments(
          company,
          startDate,
          endDate,
        )
      } else {
        this.logger.error(
          `invalid calender provider ${company.crm_provider} or get appointments isn't configured for it yet`,
        )
        return 'Failed to fetch available slots'
      }
      const slots = response?.data?.slots || {}
      const slotsBr = {}
      for (const [date, times] of Object.entries(slots)) {
        slotsBr[date] = (times as any[]).map((time: any) => {
          const localTime = this.datesHelper.convertFromZulu(time.time)
          return { time: localTime }
        })
      }

      return slotsBr
    } catch (error: any) {
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
    provider: string | null
    data: any
  }> {
    try {
      let response
      if (company.crm_provider === 'cal.com') {
        response = await this.CalComService.bookAppointment(
          company,
          this.datesHelper.addHours(date, 3),
          name,
          email,
          phone,
        )
      } else {
        response = {
          success: false,
          error: `Booking failed due to calender provider issue currently supports cal.com only but provide company provider is ${company.crm_provider}`,
          date: null,
          provider: company.crm_provider,
          data: null,
        }
        return response
      }

      return response
    } catch (error: any) {
      const response = {
        success: false,
        error: `Booking failed due to calender provider issue currently supports cal.com only but provide company provider is ${company.crm_provider}`,
        date: null,
        provider: company.crm_provider,
        data: null,
      }
      return response
    }
  }

  async cancelAppointment(
    company: companies,
    contact: Contact,
  ): Promise<{
    success: boolean
    error: string | null
    date: string | null
    provider: string | null
    data: any
  }> {
    try {
      let response
      if (company.crm_provider === 'cal.com') {
        response = await this.CalComService.cancelAppointment(company, contact)
      } else {
        response = {
          success: false,
          error: `Booking failed due to calender provider issue currently supports cal.com only but provide company provider is ${company.crm_provider}`,
          date: null,
          provider: company.crm_provider,
          data: null,
        }
        return response
      }

      return response
    } catch (error: any) {
      const response = {
        success: false,
        error: `Booking failed due to calender provider issue currently supports cal.com only but provide company provider is ${company.crm_provider}`,
        date: null,
        provider: company.crm_provider,
        data: null,
      }
      return response
    }
  }
}
