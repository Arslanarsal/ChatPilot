import {
  Controller,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Get,
  Put,
  Delete,
  Res,
  UnprocessableEntityException,
  ForbiddenException,
  Headers,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { CompanyService } from './company.service'
import { CreateCompanyDto } from './dto/create-company.dto'
import { ApiBody, ApiHeader, ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Response } from 'express'
import { ContactService } from 'src/contact/contact.service'
import { AUTHOR_TYPE, Contact } from 'src/utils/constants/types'
import { SendMessageDto } from './dto/send-message.dto'
import { WhatsAppFormatter } from 'src/utils/services/whatsapp-formatter.helper'
import { ConfigsService } from 'src/config/config.service'
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard'

@ApiTags('Companies')
@Controller('companies')
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly contactService: ContactService,
    private readonly WaFormattingService: WhatsAppFormatter,
    private readonly ConfigService: ConfigsService,
  ) {}

  private async verifyOwnership(userId: number, companyId: number) {
    const owns = await this.companyService.userOwnsCompany(userId, companyId)
    if (!owns) throw new ForbiddenException('You do not own this company')
  }

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
    if (this.ConfigService.chatPilotApiKey !== apiKey) {
      throw new UnprocessableEntityException('invalid api key')
    }
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
          data.source,
        )
        messages.push({
          message: image.alt_text,
          image: image.url,
        })
      } else {
        await this.contactService.sendMessage(
          contact as Contact,
          part,
          '',
          AUTHOR_TYPE.BOT,
          data.source,
        )
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
    if (this.ConfigService.chatPilotApiKey !== apiKey) {
      throw new UnprocessableEntityException('invalid api key')
    }
    const company = await this.companyService.findById(companyId)
    if (!company) throw new UnprocessableEntityException('company not found')
    const contact = await this.contactService.getOrCreateContact(
      company,
      number,
    )
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
          data.source,
        )
        messages.push({
          message: image.alt_text,
          image: image.url,
        })
      } else {
        await this.contactService.sendMessage(
          contact as Contact,
          part,
          '',
          AUTHOR_TYPE.BOT,
          data.source,
        )
        messages.push({
          message: part,
        })
      }
    }
    return messages
  }

  @ApiOperation({ summary: 'Create Session for Company (QR or Pairing Code)' })
  @Post(':id/create_session')
  async createSession(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { usePairingCode?: boolean; phoneNumber?: string },
  ) {
    return await this.companyService.createSession(id, body?.usePairingCode, body?.phoneNumber)
  }

  @ApiOperation({ summary: 'Get pairing code for Company session' })
  @Get(':id/pairing-code')
  async getPairingCode(@Param('id', ParseIntPipe) id: number) {
    return await this.companyService.getPairingCode(id)
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

  @ApiOperation({ summary: 'Remove WhatsApp session for Company' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/remove-session')
  async removeSession(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.verifyOwnership(req.user.userId, id)
    return await this.companyService.removeSession(id)
  }

  @ApiOperation({ summary: 'Send OTP for company deletion' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/send-delete-otp')
  async sendDeleteOtp(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.verifyOwnership(req.user.userId, id)
    return this.companyService.sendDeleteOtp(id)
  }

  @ApiOperation({ summary: 'Delete company and all related data (requires OTP)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteCompany(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { otp: string },
  ) {
    await this.verifyOwnership(req.user.userId, id)
    return this.companyService.deleteCompany(id, body.otp)
  }

  @ApiOperation({ summary: 'Save business details' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id/business-details')
  async updateBusinessDetails(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, any>,
  ) {
    await this.verifyOwnership(req.user.userId, id)
    return this.companyService.updateBusinessDetails(id, body)
  }

  @ApiOperation({ summary: 'Generate AI system prompt from business details' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/generate-prompt')
  async generatePrompt(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.verifyOwnership(req.user.userId, id)
    return this.companyService.generatePrompt(id)
  }

  @ApiOperation({ summary: 'Get dashboard stats' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/dashboard')
  async getDashboard(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.verifyOwnership(req.user.userId, id)
    return this.companyService.getDashboardStats(id)
  }

  @ApiOperation({ summary: 'Toggle bot activation' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id/bot-settings')
  async updateBotSettings(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { is_bot_activated: boolean },
  ) {
    await this.verifyOwnership(req.user.userId, id)
    return this.companyService.updateCompany(id, {
      is_bot_activated: body.is_bot_activated,
    } as any)
  }

  @ApiOperation({ summary: 'Get paginated contacts list' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/contacts')
  async getContacts(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ) {
    await this.verifyOwnership(req.user.userId, id)
    return this.companyService.getContacts(id, +page, +limit, search)
  }

  @ApiOperation({ summary: 'Toggle bot activation for a contact' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id/contacts/:contactId/bot-toggle')
  async toggleContactBot(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('contactId', ParseIntPipe) contactId: number,
    @Body() body: { is_bot_activated: boolean },
  ) {
    await this.verifyOwnership(req.user.userId, id)
    return this.contactService.updateContact(contactId, {
      is_bot_activated: body.is_bot_activated,
    })
  }

  // ─── Company Assets (File Upload) ──────────────────────────────

  @ApiOperation({ summary: 'Upload a company asset (image, PDF, doc)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/assets/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAsset(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('description') description?: string,
  ) {
    await this.verifyOwnership(req.user.userId, id)
    if (!file) throw new UnprocessableEntityException('No file provided')
    return this.companyService.uploadAsset(id, file, description)
  }

  @ApiOperation({ summary: 'Get all company assets' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/assets')
  async getAssets(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.verifyOwnership(req.user.userId, id)
    return this.companyService.getAssets(id)
  }

  @ApiOperation({ summary: 'Update asset description' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id/assets/:assetId')
  async updateAsset(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('assetId', ParseIntPipe) assetId: number,
    @Body() body: { description: string },
  ) {
    await this.verifyOwnership(req.user.userId, id)
    return this.companyService.updateAssetDescription(id, assetId, body.description)
  }

  @ApiOperation({ summary: 'Delete a company asset' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/assets/:assetId')
  async deleteAsset(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('assetId', ParseIntPipe) assetId: number,
  ) {
    await this.verifyOwnership(req.user.userId, id)
    return this.companyService.deleteAsset(id, assetId)
  }

  @ApiOperation({ summary: 'Get chat history for a contact' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/contacts/:contactId/messages')
  async getContactMessages(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('contactId', ParseIntPipe) contactId: number,
  ) {
    await this.verifyOwnership(req.user.userId, id)
    return this.companyService.getContactMessages(id, contactId)
  }

  @ApiOperation({ summary: 'Send message to contact (JWT auth)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/contacts/:contactId/send')
  async sendMessageAuth(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('contactId', ParseIntPipe) contactId: number,
    @Body() body: { message: string },
  ) {
    await this.verifyOwnership(req.user.userId, id)
    const contact = await this.contactService.getContactById(contactId)
    if (!contact)
      throw new UnprocessableEntityException('contact not found')
    const company = await this.companyService.findById(id)
    if (!company)
      throw new UnprocessableEntityException('company not found')

    const contentParts = this.WaFormattingService.splitMessage(body.message)
    const messages: any = []

    for (const part of contentParts) {
      const image = this.WaFormattingService.getMarkdownImage(part)
      if (image) {
        await this.contactService.sendMessage(
          contact as Contact,
          image.alt_text,
          image.url,
          AUTHOR_TYPE.USER_WHATSAPP,
          'dashboard',
        )
        messages.push({ message: image.alt_text, image: image.url })
      } else {
        await this.contactService.sendMessage(
          contact as Contact,
          part,
          '',
          AUTHOR_TYPE.USER_WHATSAPP,
          'dashboard',
        )
        messages.push({ message: part })
      }
    }
    return messages
  }
}
