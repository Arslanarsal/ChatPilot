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
import { Clinic, Contact } from '../constants/types'
import * as QRCode from 'qrcode'
import { ClinicService } from 'src/clinic/clinic.service'


@Injectable()
export class WhatsBaileyService {
  private readonly logger = new Logger(WhatsBaileyService.name)
  constructor(

    private readonly config: ConfigsService,
    @Inject(forwardRef(() => ClinicService))
    private readonly clinicService: ClinicService,
  ) {}

  async sendMessage(
    clinic: Clinic,
    phone: number,
    message: string,
    imageUrl?: string,
    videoUrl?: string,
  ): Promise<boolean> {
    const typingPayload: any = { phone, companies: clinic }
    // this.mockTypingState(typingPayload)
    const url = `${clinic.whatsapp_connector_server?.url}/api/v1/whatsapp/${clinic.wapi_id}/send-message`
    const chatId = `${phone}@c.us`

    const config = {
      headers: { 'Content-Type': 'application/json' },
      timeout: 50000, // Timeout in milliseconds
    }

    const requestData: any = imageUrl
    ? {
      number: `${phone}`,
      text: message,
      url: imageUrl,
      type: 'media'
      }
    : {
      number: `${phone}`,
      text: message,
      type : 'text'
      }

    this.logger.log('URL:', url)
    this.logger.log('Sending Bailey message:', requestData)

    try {
      const response = await axios.post(url, requestData, config)
      // this.clearTypingState(typingPayload)
      if (response.status !== 201) {
        const errorMessage = `Error sending message: ${response.status} ${JSON.stringify(response.data)} `
        // this.sentryService.instance().captureException(new Error(errorMessage));
        this.logger.error(errorMessage)
        return false
      }

      return true
    } catch (error) {
      let errorMessage = 'Unknown error occurred'

      if (error.response) {
        errorMessage = `HTTP Error ${error.response.status}: ${JSON.stringify(error.response.data)}`
      } else if (error.request) {
        errorMessage = `Request failed: ${error.message}`
      } else {
        errorMessage = `Error: ${error.message}`
      }

      //   this.sentryService.instance().captureException(new Error(errorMessage));
      this.logger.error('Error sending WhatsApp message:', errorMessage)
      return false
    }
  }

  async getSessionStatus(clinic: Clinic): Promise<{
    success: boolean
    state?: string
    message?: string
    error?: string
  }> {
    try {
      if (clinic.wapi_id === null) {
        this.logger.error('company Whatsapp Server id is not defined', {
          companyId: clinic.id,
          phone: clinic.phone,
          wapi_id: clinic.wapi_id,
          wapi_url: clinic.whatsapp_connector_server?.url,
          type : clinic.whatsapp_connector_server?.type,
          error: 'company wapi_id is not defined',
        })
        return { success: false, message: 'company  Whatsapp Server id  is not defined' }
      }
      const url = `${clinic?.whatsapp_connector_server?.url}/api/v1/whatsapp/sessions/${clinic.wapi_id}/status`
      this.logger.log('URL:', url)
      const response = await axios.get(url)

      if (response.status !== 200) {
        this.logger.error('error while fetching wapi session status', {
          companyId: clinic.id,
          phone: clinic.phone,
          wapi_id: clinic.wapi_id,
          wapi_url: clinic.whatsapp_connector_server?.url,
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
        message: response.data.status?.message ?response.data.status?.message :`Session ${response.data.status.status}`,
      }
    } catch (e) {
      this.logger.error('error while fetching WhatsBailey session status', {
        companyId: clinic.id,
        phone: clinic.phone,
        wapi_id: clinic.wapi_id,
        wapi_url: clinic.whatsapp_connector_server?.url,
        error: e?.message || 'Unknown error',
      })
      return { success: false, message: 'error during WhatsBailey status api call' }
    }
  }

  async getSessionQrCode(
    res,
    clinic: Clinic,
  ): Promise<{
    success: boolean
    qr?: string
    error?: string
  }> {
    const url = `${clinic?.whatsapp_connector_server?.url}/api/v1/whatsapp/sessions/qrcode/${clinic.wapi_id}`
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
    if(!response.data.qr){
      return res.send({
        statusCode: 201,
        data: response.data,
        message : response.data.message,
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
    clinic: Clinic,
    sever: whatsapp_connector_server,
  ): Promise<{
    success: boolean
    message?: string
    error?: string
  }> {
    const url = `${sever?.url}/api/v1/whatsapp/connect`


    const response = await axios.post(url,{id:`${clinic.id}`})

    if (response.status !== 201) {
      const errorMessage = `Error starting session: ${response.status} ${response.data}`
      this.logger.error(errorMessage)
      return response.data
    }

    this.logger.log('Session started successfully:', response.data)
    return response.data
  }

 
  async mockTypingState(contact: Contact): Promise<{
    success: boolean
    result?: string
    error?: string
  }> {
    const clinic: Clinic = contact.companies
    const sever: whatsapp_connector_server | null =
      clinic.whatsapp_connector_server

    const url = `${sever?.url}/api/v1/whatsapp/chat/mock-typing`

    const body = {
      number: `${contact.phone}`,
      session: clinic.wapi_id,
    }
    const response = await axios.post(url, body)

    if (response.status !== 201) {
      const errorMessage = `Error while setting typing state : ${response.status} ${response.data}`
      this.logger.error(errorMessage)
      return response.data
    }

    return response.data
  }

  // Set Typing
  async clearTypingState(contact: Contact): Promise<{
    success: boolean
    result?: string
    error?: string
  }> {
    const clinic: Clinic = contact.companies
    const sever: whatsapp_connector_server | null =
      clinic.whatsapp_connector_server
    const url = `${sever?.url}/api/v1/whatsapp/chat/clear-mock-typing`

    const body = {
      number: `${contact.phone}`,
      session: clinic.wapi_id,
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
