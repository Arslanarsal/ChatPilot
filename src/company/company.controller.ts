import {
  Controller,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Get,
  Res,
  UnprocessableEntityException,
  Headers,
  Query,
} from '@nestjs/common'
import { CompanyService } from './company.service'
import { CreateCompanyDto } from './dto/create-company.dto'
import { ApiBody, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Response } from 'express'
import { ContactService } from 'src/contact/contact.service'
import {
  AUTHOR_TYPE,
  Contact,
} from 'src/utils/constants/types'
import { SendMessageDto } from './dto/send-message.dto'
import { WhatsAppFormatter } from 'src/utils/services/whatsapp-formatter.helper'
import { ConfigsService } from 'src/config/config.service'

@ApiTags('Companies')
@Controller('companies')
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly contactService: ContactService,
    private readonly WaFormattingService: WhatsAppFormatter,
    private readonly ConfigService: ConfigsService,
  ) { }

  @ApiOperation({ summary: 'Create Company' })
  @ApiBody({
    type: CreateCompanyDto,
    description: 'The webhook data in JSON format',
  })
  @Post()
  createCompany(@Body() createWebhookDto: CreateCompanyDto) {
    return this.companyService.createCompany(createWebhookDto)
  }
  @ApiOperation({
    summary: 'Sync/Get Connection Status of all WhatsApp connected companies',
  })
  @Get('sync-connection_status')
  async syncWapiSessionStatus() {
    return await this.companyService.syncAllSessionStatus()
  }
  @ApiOperation({ summary: 'Send Message from Company to contact' })
  @ApiHeader({
    name: 'chatPilot-api-key',
    description: 'API Key for authentication',
    required: true,
  })
  @Post(':companyId/contacts/:contactId/send-message')
  async sendMessage(
    @Headers('chatPilot-api-key') apiKey: string,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('contactId', ParseIntPipe) contactId: number,
    @Query() data: SendMessageDto,
  ) {
    if (this.ConfigService.chatPilotApiKey !== apiKey)
      throw new UnprocessableEntityException('invalid api key')
    const contact = await this.contactService.getContactById(contactId)
    if (!contact) throw new UnprocessableEntityException('contact not found')
    const company = await this.companyService.findById(companyId)
    if (!company) throw new UnprocessableEntityException('company not found')
    const contentParts = this.WaFormattingService.splitMessage(data.message)
    const messages: any = []

    for (let i = 0; i < contentParts.length; i++) {
      const part = contentParts[i]
      const image = this.WaFormattingService.getMarkdownImage(part)

      if (image) {
        await this.contactService.sendMessage(
          contact as Contact,
          image.alt_text,
          image.url,
          AUTHOR_TYPE.BOT,
          data.source
        )
        messages.push({
          message: image.alt_text,
          image: image.url,
        })
      } else {
        await this.contactService.sendMessage(contact as Contact, part, '', AUTHOR_TYPE.BOT, data.source)
        messages.push({
          message: part,
        })
      }
    }
    return messages
  }

  @Post(':companyId/phone/:number/sendMessageByPhone')
  async sendMessageToPhone(
    @Headers('chatPilot-api-key') apiKey: string,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('number', ParseIntPipe) number: number,
    @Query() data: SendMessageDto,
  ) {
    if (this.ConfigService.chatPilotApiKey !== apiKey)
      throw new UnprocessableEntityException('invalid api key')
    const company = await this.companyService.findById(companyId)
    if (!company) throw new UnprocessableEntityException('company not found')
    const contact = await this.contactService.getOrCreateContact(company, number)
    if (!contact) throw new UnprocessableEntityException('contact not found')

    const contentParts = this.WaFormattingService.splitMessage(data.message)
    const messages: any = []

    for (let i = 0; i < contentParts.length; i++) {
      const part = contentParts[i]
      const image = this.WaFormattingService.getMarkdownImage(part)

      if (image) {
        await this.contactService.sendMessage(
          contact as Contact,
          image.alt_text,
          image.url,
          AUTHOR_TYPE.BOT,
          data.source
        )
        messages.push({
          message: image.alt_text,
          image: image.url,
        })
      } else {
        await this.contactService.sendMessage(contact as Contact, part, '', AUTHOR_TYPE.BOT, data.source)
        messages.push({
          message: part,
        })
      }
    }
    return messages
  }


  @ApiOperation({ summary: 'Create Session for Company' })
  @Post(':id/create_session')
  async createSession(@Param('id', ParseIntPipe) id: number) {
    return await this.companyService.createSession(id)
  }

  @ApiOperation({ summary: 'Get  wapi Session status for Company ' })
  @Get(':id/connection_status')
  async getSessionStatus(@Param('id', ParseIntPipe) id: number) {
    return await this.companyService.getSessionStatus(id)
  }
  @ApiOperation({ summary: 'Get wapi QrCode for Company ' })
  @Get(':id/get_qr')
  async getQrCode(@Res() res: Response, @Param('id', ParseIntPipe) id: number) {
    return await this.companyService.getSessionQrCode(res, id)
  }
}
