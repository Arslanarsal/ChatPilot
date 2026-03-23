import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { CreateCompanyDto } from './dto/create-company.dto'
import { companies, whatsapp_connector_server } from '@prisma/client'
import { Company } from 'src/utils/constants/types'
import { WhatsAppConnectorType } from 'src/whatsapp-connector/dto/create-whatsapp-connector.dto'
import { WhatsBaileyService } from 'src/utils/services/whats-bailey.service'
import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WhatsBaileyService))
    private readonly whatsBaileyService: WhatsBaileyService,
  ) {}

  async findByPhone(targetPhone: number) {
    return await this.prisma.companies.findFirst({
      where: { phone: Number(targetPhone) },
      include: {
        whatsapp_connector_server: true,
      },
    })
  }

  async findBySessionId(sessionId: string) {
    return await this.prisma.companies.findFirst({
      where: { session_id: sessionId },
      include: {
        whatsapp_connector_server: true,
      },
    })
  }

  async findById(id: number): Promise<Company | null> {
    return (await this.prisma.companies.findFirst({
      where: { id: Number(id) },
      include: {
        whatsapp_connector_server: true,
      },
    })) as Company
  }

  async createCompany(createCompanyDto: CreateCompanyDto) {
    return await this.prisma.companies.create({
      data: {
        ...createCompanyDto,
      },
    })
  }

  async getAvailableServer(): Promise<whatsapp_connector_server | null> {
    // Prefer localhost server, fallback to any available
    // const server = await this.prisma.whatsapp_connector_server.findFirst({
    //   where: {
    //     type: 'whats_bailey',
    //     url: { contains: 'localhost' },
    //   },
    // })
    // if (server) return server

    return this.prisma.whatsapp_connector_server.findFirst({
      where: { type: 'whats_bailey' },
    })
  }

  async createSession(companyId: number, usePairingCode?: boolean, phoneNumber?: string) {
    const company = await this.findById(companyId)
    if (!company) throw new UnprocessableEntityException('company not found')

    if (usePairingCode && !phoneNumber) {
      throw new UnprocessableEntityException('Phone number is required when using pairing code')
    }

    // If session already exists, check if truly active
    if (
      company.whatsapp_connector_server?.type ===
        WhatsAppConnectorType.WHATS_BAILEY &&
      company.session_id
    ) {
      const sessionStatus =
        await this.whatsBaileyService.getSessionStatus(company)
      if (sessionStatus.success) {
        throw new UnprocessableEntityException(sessionStatus.message)
      }
      // Remove stale session so fresh QR is generated
      try {
        await this.whatsBaileyService.removeSession(company)
      } catch { /* ignore */ }
      await this.updateCompany(company.id, {
        session_id: null,
        whatsapp_connection_status: false,
      } as any)
    }

    const server = await this.getAvailableServer()
    if (!server) throw new UnprocessableEntityException('no server available')

    const session = await this.whatsBaileyService.startSession(company, server, usePairingCode, phoneNumber)
    this.logger.log(`${session.success}`, 'company service')
    if (!session.success) {
      throw new UnprocessableEntityException(session.message)
    }

    await this.updateCompany(company.id, {
      whatsapp_connector_server_id: server.id,
      session_id: companyId.toString(),
    })

    const result: any = {
      success: true,
      message: 'Session initiated successfully',
    }
    if (session.pairingCode) {
      result.pairingCode = session.pairingCode
    }
    return result
  }

  async getPairingCode(companyId: number) {
    const company = await this.findById(companyId)
    if (!company) throw new UnprocessableEntityException('company not found')
    if (!company.session_id) {
      throw new UnprocessableEntityException('no active session found')
    }
    return await this.whatsBaileyService.getPairingCode(company)
  }

  async updateCompany(
    companyId: number,
    updateCompanyDto: Partial<companies>,
  ): Promise<Company> {
    return (await this.prisma.companies.update({
      where: { id: companyId },
      data: updateCompanyDto as any,

      include: {
        whatsapp_connector_server: true,
      },
    })) as Company
  }
  async getSessionQrCode(res, companyId: number) {
    const company = await this.findById(companyId)
    if (!company) throw new UnprocessableEntityException('company not found')
    if (
      !company.session_id ||
      company.whatsapp_connector_server?.type !==
        WhatsAppConnectorType.WHATS_BAILEY ||
      !company.whatsapp_connector_server?.url
    ) {
      res.setHeader('Content-Type', 'application/json')
      return res.send({ statusCode: 200, data: null, message: 'No active session. Please create a session first.' })
    }
    return await this.whatsBaileyService.getSessionQrCode(res, company)
  }
  async getSessionStatus(companyId: number) {
    const company = await this.findById(companyId)
    if (!company) throw new UnprocessableEntityException('company not found')
    if (
      !company.session_id ||
      company.whatsapp_connector_server?.type !==
        WhatsAppConnectorType.WHATS_BAILEY ||
      !company.whatsapp_connector_server?.url
    ) {
      return { success: false, state: 'DISCONNECTED', message: 'No active session' }
    }
    return await this.whatsBaileyService.getSessionStatus(company)
  }

  async syncAllSessionStatus() {
    const companies = await this.prisma.companies.findMany({
      where: {
        whatsapp_connector_server: {
          type: WhatsAppConnectorType.WHATS_BAILEY,
        },
      },
      include: {
        whatsapp_connector_server: true,
      },
      orderBy: {
        id: 'asc',
      },
    })

    for (const company of companies) {
      const sessionResult = await this.whatsBaileyService.getSessionStatus(
        company as Company,
      )
      const status = sessionResult.state === 'CONNECTED'

      company.whatsapp_connection_status = (
        await this.updateCompany(company.id, {
          whatsapp_connection_status: status,
        })
      ).whatsapp_connection_status

      this.logger.log(
        `Connection status for companyId:${company.id} session:${company.session_id} status:${company.whatsapp_connection_status}`,
      )
    }
    return companies.map(company => ({
      id: company.id,
      whatsapp_connection_status: company.whatsapp_connection_status,
      session_id: company.session_id,
      phone: company.phone,
      server_url: company.whatsapp_connector_server?.url,
      whatsapp_provider: company.whatsapp_connector_server?.type,
    }))
  }

  async removeSession(companyId: number) {
    const company = await this.findById(companyId)
    if (!company) throw new UnprocessableEntityException('company not found')
    if (
      !company.session_id ||
      company.whatsapp_connector_server?.type !==
        WhatsAppConnectorType.WHATS_BAILEY ||
      !company.whatsapp_connector_server?.url
    ) {
      return { success: true, message: 'No active session to remove' }
    }

    const result = await this.whatsBaileyService.removeSession(company)

    if (result.success) {
      await this.updateCompany(companyId, {
        session_id: null,
        whatsapp_connection_status: false,
      } as any)
    }

    return result
  }

  async userOwnsCompany(userId: number, companyId: number): Promise<boolean> {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, company_id: companyId },
      select: { id: true },
    })
    return !!user
  }

  async updateBusinessDetails(companyId: number, details: Record<string, any>) {
    return await this.prisma.companies.update({
      where: { id: companyId },
      data: { business_details: details },
    })
  }

  async generatePrompt(companyId: number) {
    const company = await this.prisma.companies.findUnique({
      where: { id: companyId },
      include: { assistant_instructions: true },
    })

    if (!company) throw new UnprocessableEntityException('Company not found')

    const details = company.business_details as Record<string, any> | null
    if (!details?.description) {
      throw new UnprocessableEntityException(
        'Please save business details first',
      )
    }

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const { text: generatedPrompt } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: `You are an expert at creating WhatsApp business chatbot system prompts. Based on the following business description, generate a comprehensive system prompt for a WhatsApp AI assistant. The prompt should define the bot's personality, knowledge, and behavior.

Business Description:
${details.description}

Generate ONLY the system prompt text, no explanations.`,
    })

    if (company.assistant_id) {
      await this.prisma.assistant_instructions.update({
        where: { id: company.assistant_id },
        data: { system_prompt: generatedPrompt },
      })
    } else {
      const instructions = await this.prisma.assistant_instructions.create({
        data: { system_prompt: generatedPrompt },
      })
      await this.prisma.companies.update({
        where: { id: companyId },
        data: { assistant_id: instructions.id },
      })
    }

    return { success: true }
  }

  async getDashboardStats(companyId: number) {
    const [contactsCount, messagesCount, botMessagesCount, company] =
      await Promise.all([
        this.prisma.contacts.count({
          where: { company_id: companyId },
        }),
        this.prisma.messages.count({
          where: { contacts: { company_id: companyId } },
        }),
        this.prisma.messages.count({
          where: {
            contacts: { company_id: companyId },
            author_type: 'bot',
          },
        }),
        this.findById(companyId),
      ])

    let connectionStatus = company?.whatsapp_connection_status ?? false
    try {
      if (company?.session_id) {
        const status = await this.whatsBaileyService.getSessionStatus(
          company as Company,
        )
        connectionStatus = status.state === 'CONNECTED'
        if (company.whatsapp_connection_status !== connectionStatus) {
          this.updateCompany(company.id, {
            whatsapp_connection_status: connectionStatus,
          } as any).catch(() => {})
        }
      }
    } catch {
      connectionStatus = company?.whatsapp_connection_status ?? false
    }

    return {
      contacts_count: contactsCount,
      messages_count: messagesCount,
      bot_messages_count: botMessagesCount,
      is_bot_activated: company?.is_bot_activated ?? false,
      whatsapp_connected: connectionStatus,
    }
  }

  async getContacts(
    companyId: number,
    page: number,
    limit: number,
    search?: string,
  ) {
    const skip = (page - 1) * limit
    const where: any = {
      company_id: companyId,
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { whatsapp_profile_name: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [contacts, total] = await Promise.all([
      this.prisma.contacts.findMany({
        where,
        orderBy: { last_message_received: 'desc' },
        skip,
        take: limit,
        include: {
          messages: {
            orderBy: { sent_at: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.contacts.count({ where }),
    ])

    return {
      data: contacts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getContactMessages(companyId: number, contactId: number) {
    const contact = await this.prisma.contacts.findFirst({
      where: { id: contactId, company_id: companyId },
    })
    if (!contact) throw new UnprocessableEntityException('Contact not found')

    const messages = await this.prisma.messages.findMany({
      where: { contact_id: contactId },
      orderBy: { sent_at: 'asc' },
    })

    return { contact, messages }
  }

  async sendDeleteOtp(companyId: number) {
    const company = await this.findById(companyId)
    if (!company) throw new UnprocessableEntityException('Company not found')

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    const user = await this.prisma.users.findFirst({
      where: { company_id: companyId },
    })
    if (!user) throw new UnprocessableEntityException('No user found for this company')

    await this.prisma.users.update({
      where: { id: user.id },
      data: { otp_code: otp, otp_expires_at: expiresAt },
    })

    const otpCompany = await this.findById(1)
    if (otpCompany) {
      await this.whatsBaileyService.sendMessage(
        otpCompany,
        Number(user.phone),
        `Your ChatPilot delete verification code is: *${otp}*\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
      )
    } else {
      throw new UnprocessableEntityException('OTP service unavailable')
    }

    return { success: true, message: 'OTP sent to your WhatsApp' }
  }

  async deleteCompany(companyId: number, otp: string) {
    const company = await this.findById(companyId)
    if (!company) throw new UnprocessableEntityException('Company not found')

    // Verify OTP
    const user = await this.prisma.users.findFirst({
      where: { company_id: companyId },
      select: { id: true, otp_code: true, otp_expires_at: true },
    })
    if (!user) throw new UnprocessableEntityException('No user found for this company')

    if (
      !user.otp_code ||
      !user.otp_expires_at ||
      user.otp_code !== otp ||
      user.otp_expires_at < new Date()
    ) {
      throw new UnprocessableEntityException('Invalid or expired OTP')
    }

    // Clear OTP
    await this.prisma.users.update({
      where: { id: user.id },
      data: { otp_code: null, otp_expires_at: null },
    })

    if (company.session_id && company.whatsapp_connector_server) {
      try {
        await this.whatsBaileyService.removeSession(company)
      } catch (e) {
        this.logger.warn('Failed to remove WhatsApp session during company deletion', e?.message)
      }
    }

    const assistantId = company.assistant_id

    await this.prisma.$transaction(async (tx) => {
      const contacts = await tx.contacts.findMany({
        where: { company_id: companyId },
        select: { id: true },
      })
      const contactIds = contacts.map(c => c.id)

      if (contactIds.length > 0) {
        await tx.messages.deleteMany({
          where: { contact_id: { in: contactIds } },
        })
      }

      await tx.contacts.deleteMany({
        where: { company_id: companyId },
      })

      await tx.companies.delete({
        where: { id: companyId },
      })

      if (assistantId) {
        const otherCompany = await tx.companies.findFirst({
          where: { assistant_id: assistantId },
          select: { id: true },
        })
        if (!otherCompany) {
          await tx.assistant_instructions.delete({
            where: { id: assistantId },
          })
        }
      }
    })

    return { success: true, message: 'Company and all related data deleted successfully' }
  }
}
