import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { whatsapp_connector_server } from '@prisma/client';
import axios from 'axios';
import * as QRCode from 'qrcode';
//   import { ConfigsService } from 'src/config'
import { Clinic, Contact } from '../constant/types';
//   import * as QRCode from 'qrcode'
//   import { WBPresence } from '../constants/background.constants'

@Injectable()
export class WhatsBaileyService {
  private readonly logger = new Logger(WhatsBaileyService.name);
  constructor() {}

  async getSessionStatus(clinic: Clinic): Promise<{
    success: boolean;
    state?: string;
    message?: string;
    error?: string;
  }> {
    try {
      if (clinic.id === null) {
        this.logger.error('company Whatsapp Server id is not defined', {
          companyId: clinic.id,
          phone: clinic.phone,
          whatsapp_session: clinic.id,
          whatsapp_connector_server_url: clinic.whatsapp_connector_server?.url,
          type: clinic.whatsapp_connector_server?.type,
          error: 'company whatsapp_session is not defined',
        });
        return { success: false, message: 'company  Whatsapp Server id  is not defined' };
      }
      const url = `${clinic?.whatsapp_connector_server?.url}/api/v1/whatsapp/sessions/${clinic.id}/status`;
      this.logger.log('URL:', url);
      const response = await axios.get(url);

      if (response.status !== 200) {
        this.logger.error('error while fetching wapi session status', {
          companyId: clinic.id,
          phone: clinic.phone,
          whatsapp_session: clinic.id,
          whatsapp_connector_server_url: clinic.whatsapp_connector_server?.url,
          error: `Error starting session: ${response?.status} res.data: ${JSON.stringify(response?.data)} `,
        });
        return {
          success: false,
          error: 'error during WhatsBailey status api call',
        };
      }
      this.logger.log('Responce Success::  ', response.data.status.status);
      return {
        success: response.data.status.status,
        state: response.data.status.status,
        message: response.data.status?.message
          ? response.data.status?.message
          : `Session ${response.data.status.status}`,
      };
    } catch (e) {
      this.logger.error('error while fetching WhatsBailey session status', {
        companyId: clinic.id,
        phone: clinic.phone,
        whatsapp_session: clinic.id,
        whatsapp_connector_server_url: clinic.whatsapp_connector_server?.url,
        error: e?.message || 'Unknown error',
      });
      return { success: false, message: 'error during WhatsBailey status api call' };
    }
  }

  async startSession(
    clinic: Clinic,
    sever: whatsapp_connector_server,
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    const url = `${sever?.url}/api/v1/whatsapp/connect`;

    const response = await axios.post(url, { id: `${clinic.id}` });

    if (response.status !== 201) {
      const errorMessage = `Error starting session: ${response.status} ${response.data}`;
      this.logger.error(errorMessage);
      return response.data;
    }

    this.logger.log('Session started successfully:', response.data);
    return response.data;
  }

  async getSessionQrCode(
    res,
    clinic: Clinic,
  ): Promise<{
    success: boolean;
    qr?: string;
    error?: string;
  }> {
    const url = `${clinic?.whatsapp_connector_server?.url}/api/v1/whatsapp/sessions/qrcode/${clinic.id}`;
    const response = await axios.get(url);

    if (response.status !== 200 || !response.data.success) {
      this.logger.error(`Error starting session: ${response.status} ${response.data}`);
      res.setHeader('Content-Type', 'application/json');
      return res.send({
        statusCode: 201,
        data: response.data,
        error: null,
      });
    }
    if (!response.data.qr) {
      return res.send({
        statusCode: 201,
        data: response.data,
        message: response.data.message,
        error: null,
      });
    }

    try {
      const qrCodeImage = await QRCode.toBuffer(response.data.qr);

      res.setHeader('Content-Type', 'image/png');

      return res.send(qrCodeImage);
    } catch (error) {
      throw new HttpException('Failed to generate QR code', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getClientProfilePicture(contact: Contact): Promise<{
    success: boolean;
    result?: string;
    error?: string;
  }> {
    const clinic: Clinic = contact.companies;
    const sever: whatsapp_connector_server | null = clinic.whatsapp_connector_server;
    const url = `${sever?.url}/api/v1/whatsapp/${clinic.id}/get-profile-pic-url`;

    const body = {
      number: `${contact.phone}`,
    };
    this.logger.log('WhatsBailey URL:', url);
    const response = await axios.post(url, body);

    if (response.status !== 201) {
      const errorMessage = `Error getting profile picture: ${response.status} ${response.data}`;
      this.logger.error(errorMessage);
      return response.data;
    }

    this.logger.log('Profile picture fetched successfully:', response.data);
    return response.data;
  }

  async sendMessage(
    clinic: Clinic,
    phone: number,
    message: string,
    imageUrl?: string,
    isVoiceMode: boolean = false,
  ): Promise<boolean> {
    const typingPayload: any = { phone, companies: clinic };
    // this.mockTypingState(typingPayload, isVoiceMode)
    const url = `${clinic.whatsapp_connector_server?.url}/api/v1/whatsapp/${clinic.id}/send-message`;

    const config = {
      headers: { 'Content-Type': 'application/json' },
      timeout: 50000, // Timeout in milliseconds
    };

    const requestData: any = imageUrl
      ? {
          number: `${phone}`,
          text: message,
          url: imageUrl,
          type: 'media',
          isVoiceMode,
        }
      : {
          number: `${phone}`,
          text: message,
          type: 'text',
        };

    this.logger.log('URL:', url);
    this.logger.log('Sending Bailey message:', requestData);

    try {
      const response = await axios.post(url, requestData, config);
      // this.clearTypingState(typingPayload)
      if (response.status !== 201) {
        const errorMessage = `Error sending message: ${response.status} ${JSON.stringify(response.data)} `;

        this.logger.error(errorMessage);
        return false;
      }

      return true;
    } catch (error) {
      let errorMessage = 'Unknown error occurred';

      if (error.response) {
        errorMessage = `HTTP Error ${error.response.status}: ${JSON.stringify(error.response.data)}`;
      } else if (error.request) {
        errorMessage = `Request failed: ${error.message}`;
      } else {
        errorMessage = `Error: ${error.message}`;
      }

      //   this.sentryService.instance().captureException(new Error(errorMessage));
      this.logger.error('Error sending WhatsApp message:', errorMessage);
      return false;
    }
  }
}
