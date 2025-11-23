import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common'
import axios from 'axios'
// import { SentryService } from '@ntegral/nestjs-sentry';
import { whatsapp_connector_server } from '@prisma/client'
import { ConfigsService } from 'src/config'
import { Clinic, Contact } from '../constants/types'
import * as QRCode from 'qrcode'
import { ClinicService } from 'src/clinic/clinic.service'

@Injectable()
export class WapiService {
  private readonly logger = new Logger(WapiService.name)
  constructor(
    // private readonly sentryService: SentryService,

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
    this.mockTypingState(typingPayload)
    const url = `${clinic.whatsapp_connector_server?.url}/client/sendMessage/${clinic.wapi_id}`
    const chatId = `${phone}@c.us`

    const config = {
      headers: { 'Content-Type': 'application/json' },
      timeout: 50000, // Timeout in milliseconds
    }

    const requestData: any = imageUrl
      ? {
          chatId,
          contentType: 'MessageMediaFromURL',
          content: imageUrl,
          options: {
            caption: message,
          },
        }
      : {
          chatId,
          contentType: 'string',
          content: message,
        }

    this.logger.log('URL:', url)
    this.logger.log('Sending WAPI message:', requestData)

    try {
      const response = await axios.post(url, requestData, config)
      this.clearTypingState(typingPayload)
      if (response.status !== 200) {
        const errorMessage = `Error sending message: ${response.status} ${response.data}`
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

  async startSession(
    clinic: Clinic,
    sever: whatsapp_connector_server,
  ): Promise<{
    success: boolean
    message?: string
    error?: string
  }> {
    const url = `${sever?.url}/session/start/${clinic.id}`

    const response = await axios.get(url)

    if (response.status !== 200) {
      const errorMessage = `Error starting session: ${response.status} ${response.data}`
      this.logger.error(errorMessage)
      return response.data
    }

    this.logger.log('Session started successfully:', response.data)
    return response.data
  }

  async getSessionStatus(clinic: Clinic): Promise<{
    success: boolean
    state?: string
    message?: string
    error?: string
  }> {
    try {
      if (clinic.wapi_id === null) {
        this.logger.error('company wapi_id is not defined', {
          companyId: clinic.id,
          phone: clinic.phone,
          wapi_id: clinic.wapi_id,
          wapi_url: clinic.whatsapp_connector_server?.url,
          error: 'company wapi_id is not defined',
        })
        return { success: false, message: 'company wapi_id is not defined' }
      }
      const url = `${clinic?.whatsapp_connector_server?.url}/session/status/${clinic.wapi_id}`
      const response = await axios.get(url)

      if (response.status !== 200) {
        this.logger.error('error while fetching wapi session status', {
          companyId: clinic.id,
          phone: clinic.phone,
          wapi_id: clinic.wapi_id,
          wapi_url: clinic.whatsapp_connector_server?.url,
          error: `Error starting session: ${response?.status} res.data: ${JSON.stringify(response?.data)} `,
        })
        return response.data
      }
      return response.data
    } catch (e) {
      this.logger.error('error while fetching wapi session status', {
        companyId: clinic.id,
        phone: clinic.phone,
        wapi_id: clinic.wapi_id,
        wapi_url: clinic.whatsapp_connector_server?.url,
        error: e?.message || 'Unknown error',
      })
      return { success: false, message: 'error during wapi status api call' }
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
    const url = `${clinic?.whatsapp_connector_server?.url}/session/qr/${clinic.wapi_id}`
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

  async getClientProfilePicture(contact: Contact): Promise<{
    success: boolean
    result?: string
    error?: string
  }> {
    const clinic: Clinic = contact.companies
    const sever: whatsapp_connector_server | null =
      clinic.whatsapp_connector_server
    const url = `${sever?.url}/contact/getProfilePicUrl/${clinic.wapi_id}`

    const body = {
      contactId: `${contact.phone}@c.us`,
    }

    const response = await axios.post(url, body)

    if (response.status !== 200) {
      const errorMessage = `Error starting session: ${response.status} ${response.data}`
      this.logger.error(errorMessage)
      return response.data
    }

    this.logger.log('Session started successfully:', response.data)
    return response.data
  }

  async downloadMediaMessage(
    clinicPhone: BigInt,
    contactPhone: BigInt,
    messageId: string,
  ): Promise<boolean | any> {
    const clinic = await this.clinicService.findByPhone(Number(clinicPhone))
    const url = `${clinic?.whatsapp_connector_server?.url}/message/downloadMedia/${clinic?.wapi_id}`
    const chatId = `${contactPhone}@c.us`

    const config = {
      headers: { 'Content-Type': 'application/json' },
      timeout: 50000, // Timeout in milliseconds
    }

    const requestData: any = { chatId, messageId }

    try {
      const response = await axios.post(url, requestData, config)

      if (response.status !== 200) {
        const errorMessage = `Error sending message: ${response.status} ${response.data}`
        // this.sentryService.instance().captureException(new Error(errorMessage));
        this.logger.error(errorMessage)
        return response.data
      }
      return response.data
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
      return { success: false }
    }
  }

  // Stop Typing
  async mockTypingState(contact: Contact): Promise<{
    success: boolean
    result?: string
    error?: string
  }> {
    const clinic: Clinic = contact.companies
    const sever: whatsapp_connector_server | null =
      clinic.whatsapp_connector_server

    const url = `${sever?.url}/chat/sendStateTyping/${clinic.wapi_id}`

    const body = {
      chatId: `${contact.phone}@c.us`,
    }
    const response = await axios.post(url, body)

    if (response.status !== 200) {
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
    const url = `${sever?.url}/chat/clearState/${clinic.wapi_id}`

    const body = {
      chatId: `${contact.phone}@c.us`,
    }

    const response = await axios.post(url, body)

    if (response.status !== 200) {
      const errorMessage = `Error while clearing typing state : ${response.status} ${response.data}`
      this.logger.error(errorMessage)
      return response.data
    }
    return response.data
  }
 // mark chat as unRead
  async markUnread(contact: Contact): Promise<{
    success: boolean
    result?: string
    error?: string
  }> {
    const clinic: Clinic = contact.companies
    const sever: whatsapp_connector_server | null =
      clinic.whatsapp_connector_server
    const url = `${sever?.url}/chat/markUnread/${clinic.wapi_id}`

    const body = {
      chatId: `${contact.phone}@c.us`,
    }

    const response = await axios.post(url, body)

    if (response.status !== 200) {
      const errorMessage = `Error while clearing typing state : ${response.status} ${response.data}`
      this.logger.error(errorMessage)
      return response.data
    }
    return response.data
  }

  async isOnWhatsapp(
    clinic: Clinic,
    phone: string,
  ): Promise<{
    success: boolean
    result?: any
    error?: string
    is_on_whatsapp : boolean
  }> {
   
    
    const url = `${clinic.whatsapp_connector_server?.url}/client/getNumberId/${clinic.wapi_id}`

    const config = {
      headers: { 'Content-Type': 'application/json' },
      timeout: 50000, // Timeout in milliseconds
    }

    const requestData: any = { number: phone }

    this.logger.log('URL:', url)
    this.logger.log('Sending WAPI message:', requestData)

    try {
      const response = await axios.post(url, requestData, config)
      if (response.status !== 200) {
        const errorMessage = `Error sending message: ${response.status} ${response.data}`
        // this.sentryService.instance().captureException(new Error(errorMessage));
        this.logger.error(errorMessage)
        return {...response.data ,is_on_whatsapp : false }
      }
      const res = response.data.result ? {...response.data ,is_on_whatsapp : true } : {...response.data ,is_on_whatsapp : false }

      return res
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
      return { success: false, error: errorMessage , result: null,is_on_whatsapp : false  }
    }
  }
}
