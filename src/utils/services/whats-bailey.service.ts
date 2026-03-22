import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common'
import axios from 'axios'
import { whatsapp_connector_server } from '@prisma/client'
import { ConfigsService } from 'src/config'
import { Company, Contact } from '../constants/types'
import * as QRCode from 'qrcode'
import { CompanyService } from 'src/company/company.service'

@Injectable()
export class WhatsBaileyService {
  private readonly logger = new Logger(WhatsBaileyService.name)
  constructor(
    private readonly config: ConfigsService,
    @Inject(forwardRef(() => CompanyService))
    private readonly companyService: CompanyService,
  ) {}

  async sendMessage(
    company: Company,
    phone: number,
    message: string,
    imageUrl?: string,
    videoUrl?: string,
    isFromLid: boolean = false,
  ): Promise<string | null> {
    const url = `${company.whatsapp_connector_server?.url}/api/v1/whatsapp/${company.session_id}/send-message`

    const config = {
      headers: { 'Content-Type': 'application/json' },
      timeout: 50000,
    }

    const requestData: any = imageUrl
      ? {
          number: `${phone}`,
          text: message,
          url: imageUrl,
          type: 'media',
          isFromLid,
        }
      : {
          number: `${phone}`,
          text: message,
          type: 'text',
          isFromLid,
        }

    this.logger.log('URL:', url)
    this.logger.log('Sending Bailey message:', requestData)

    try {
      const response = await axios.post(url, requestData, config)
      if (response.status !== 201) {
        const errorMessage = `Error sending message: ${response.status} ${JSON.stringify(response.data)} `
        this.logger.error(errorMessage)
        return null
      }

      return response.data?.result?.wb_id ?? null
    } catch (error) {
      let errorMessage = 'Unknown error occurred'

      if (error.response) {
        errorMessage = `HTTP Error ${error.response.status}: ${JSON.stringify(error.response.data)}`
      } else if (error.request) {
        errorMessage = `Request failed: ${error.message}`
      } else {
        errorMessage = `Error: ${error.message}`
      }

      this.logger.error('Error sending WhatsApp message:', errorMessage)
      return null
    }
  }

  async getLid(company: Company, phone: string): Promise<bigint | null> {
    try {
      if (!company.whatsapp_connector_server?.url || !company.session_id) {
        return null
      }
      const url = `${company.whatsapp_connector_server.url}/api/v1/whatsapp/${company.session_id}/is-on-whatsapp-with-lid`
      const response = await axios.post(url, { number: phone }, { timeout: 15000 })
      if (response.status === 201 && response.data?.length > 0) {
        const lid: string | null = response.data[0]?.lid ?? null
        if (lid) {
          const lidNumber = lid.split('@')[0]
          return BigInt(lidNumber)
        }
      }
      return null
    } catch (error) {
      this.logger.warn('Failed to get LID for phone:', phone)
      return null
    }
  }

  async getSessionStatus(company: Company): Promise<{
    success: boolean
    state?: string
    message?: string
    error?: string
  }> {
    try {
      if (!company.session_id) {
        this.logger.error('company session_id is not defined', {
          companyId: company.id,
          phone: company.phone,
          session_id: company.session_id,
          server_url: company.whatsapp_connector_server?.url,
          type: company.whatsapp_connector_server?.type,
          error: 'company session_id is not defined',
        })
        return { success: false, message: 'company session_id is not defined' }
      }
      const url = `${company?.whatsapp_connector_server?.url}/api/v1/whatsapp/sessions/${company.session_id}/status`
      this.logger.log('URL:', url)
      const response = await axios.get(url)

      if (response.status !== 200) {
        this.logger.error('error while fetching bailey session status', {
          companyId: company.id,
          phone: company.phone,
          session_id: company.session_id,
          server_url: company.whatsapp_connector_server?.url,
          error: `Error starting session: ${response?.status} res.data: ${JSON.stringify(response?.data)} `,
        })
        return {
          success: false,
          error: 'error during WhatsBailey status api call',
        }
      }
      return {
        success: response.data.status.status,
        state: response.data.status.status,
        message: response.data.status?.message
          ? response.data.status?.message
          : `Session ${response.data.status.status}`,
      }
    } catch (e) {
      this.logger.error('error while fetching WhatsBailey session status', {
        companyId: company.id,
        phone: company.phone,
        session_id: company.session_id,
        server_url: company.whatsapp_connector_server?.url,
        error: e?.message || 'Unknown error',
      })
      return {
        success: false,
        message: 'error during WhatsBailey status api call',
      }
    }
  }

  async getSessionQrCode(
    res,
    company: Company,
  ): Promise<{
    success: boolean
    qr?: string
    error?: string
  }> {
    const url = `${company?.whatsapp_connector_server?.url}/api/v1/whatsapp/sessions/qrcode/${company.session_id}`

    const response = await axios.get(url)
    if (response.status !== 200 || !response.data.success) {
      this.logger.error(
        `Error starting session: ${response.status} ${response.data}`,
      )
      res.setHeader('Content-Type', 'application/json')
      return res.send({
        statusCode: 201,
        data: response.data,
        error: null,
      })
    }
    if (!response.data.qr) {
      return res.send({
        statusCode: 201,
        data: response.data,
        message: response.data.message,
        error: null,
      })
    }

    try {
      const qrCodeImage = await QRCode.toBuffer(response.data.qr)

      res.setHeader('Content-Type', 'image/png')

      return res.send(qrCodeImage)
    } catch (error) {
      throw new HttpException(
        'Failed to generate QR code',
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }
  async startSession(
    company: Company,
    sever: whatsapp_connector_server,
    usePairingCode?: boolean,
    phoneNumber?: string,
  ): Promise<{
    success: boolean
    message?: string
    pairingCode?: string
    error?: string
  }> {
    const url = `${sever?.url}/api/v1/whatsapp/connect`

    const body: any = { id: `${company.id}` }
    if (usePairingCode) {
      body.usePairingCode = true
      body.phoneNumber = phoneNumber
    }

    const response = await axios.post(url, body)

    if (response.status !== 201) {
      const errorMessage = `Error starting session: ${response.status} ${response.data}`
      this.logger.error(errorMessage)
      return response.data
    }

    this.logger.log('Session started successfully:', response.data)
    return response.data
  }

  async getPairingCode(company: Company): Promise<{
    success: boolean
    pairingCode?: string
    message?: string
  }> {
    try {
      const url = `${company.whatsapp_connector_server?.url}/api/v1/whatsapp/sessions/pairingcode/${company.session_id}`
      const response = await axios.get(url)
      return response.data
    } catch (error) {
      this.logger.error('Error getting pairing code:', error?.message)
      return { success: false, message: 'Error getting pairing code' }
    }
  }

  async mockTypingState(contact: Contact): Promise<{
    success: boolean
    result?: string
    error?: string
  }> {
    const company: Company = contact.companies
    const sever: whatsapp_connector_server | null =
      company.whatsapp_connector_server

    const url = `${sever?.url}/api/v1/whatsapp/chat/mock-typing`

    const contactNumber = contact.phone ? `${contact.phone}` : `${contact.lid}`
    const body = {
      number: contactNumber,
      session: company.session_id,
    }
    const response = await axios.post(url, body)

    if (response.status !== 201) {
      const errorMessage = `Error while setting typing state : ${response.status} ${response.data}`
      this.logger.error(errorMessage)
      return response.data
    }

    return response.data
  }

  async removeSession(company: Company): Promise<{
    success: boolean
    message?: string
    error?: string
  }> {
    try {
      const url = `${company.whatsapp_connector_server?.url}/api/v1/whatsapp/sessions/${company.session_id}/remove`
      this.logger.log('Removing session, URL:', url)
      const response = await axios.get(url)

      if (response.status !== 200) {
        const errorMessage = `Error removing session: ${response.status} ${JSON.stringify(response.data)}`
        this.logger.error(errorMessage)
        return { success: false, message: errorMessage, error: errorMessage }
      }

      return { success: response.data.success, message: response.data.message }
    } catch (error) {
      const errorMessage = `Error removing session: ${error?.message || 'Unknown error'}`
      this.logger.error(errorMessage)
      return { success: false, message: errorMessage, error: errorMessage }
    }
  }

  // Set Typing
  async clearTypingState(contact: Contact): Promise<{
    success: boolean
    result?: string
    error?: string
  }> {
    const company: Company = contact.companies
    const sever: whatsapp_connector_server | null =
      company.whatsapp_connector_server
    const url = `${sever?.url}/api/v1/whatsapp/chat/clear-mock-typing`

    const contactNumber = contact.phone ? `${contact.phone}` : `${contact.lid}`
    const body = {
      number: contactNumber,
      session: company.session_id,
    }

    const response = await axios.post(url, body)

    if (response.status !== 201) {
      const errorMessage = `Error while clearing typing state : ${response.status} ${response.data}`
      this.logger.error(errorMessage)
      return response.data
    }
    return response.data
  }
}
