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
    const server = await this.prisma.$queryRaw`
     SELECT s.*
     FROM  public.whatsapp_connector_server as s
     LEFT JOIN companies c ON s.id = c.whatsapp_connector_server_id
     WHERE s.type = 'whats_bailey'
     GROUP BY s.id
     HAVING COUNT(c.id) < 4
     ORDER BY COUNT(c.id) ASC
     LIMIT 1;
    `
    return server ? server[0] : null
  }

  async createSession(companyId: number, usePairingCode?: boolean, phoneNumber?: string) {
    const company = await this.findById(companyId)
    if (!company) throw new UnprocessableEntityException('company not found')

    if (usePairingCode && !phoneNumber) {
      throw new UnprocessableEntityException('Phone number is required when using pairing code')
    }

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
      company.whatsapp_connector_server?.type !==
        WhatsAppConnectorType.WHATS_BAILEY ||
      company.whatsapp_connector_server?.url === null
    ) {
      throw new UnprocessableEntityException(
        `provider isn't WhatsApp Bailey or server url missing`,
      )
    }
    return await this.whatsBaileyService.getSessionQrCode(res, company)
  }
  async getSessionStatus(companyId: number) {
    const company = await this.findById(companyId)
    if (!company) throw new UnprocessableEntityException('company not found')
    if (
      company.whatsapp_connector_server?.type !==
        WhatsAppConnectorType.WHATS_BAILEY ||
      company.whatsapp_connector_server?.url === null
    ) {
      throw new UnprocessableEntityException(
        `provider isn't WhatsApp Bailey or server url missing`,
      )
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
      company.whatsapp_connector_server?.type !==
        WhatsAppConnectorType.WHATS_BAILEY ||
      company.whatsapp_connector_server?.url === null
    ) {
      throw new UnprocessableEntityException(
        `provider isn't WhatsApp Bailey or server url missing`,
      )
    }
    if (!company.session_id) {
      throw new UnprocessableEntityException('no active session found')
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
    if (!details) {
      throw new UnprocessableEntityException(
        'Please save business details first',
      )
    }

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const { text: generatedPrompt } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: `You are an expert at creating WhatsApp business chatbot system prompts. Based on the following business details, generate a comprehensive system prompt for a WhatsApp AI assistant. The prompt should define the bot's personality, knowledge, and behavior.

Business Details:
- Company Name: ${company.name}
- Description: ${details.description || 'N/A'}
- Industry: ${details.industry || 'N/A'}
- Services: ${details.services || 'N/A'}
- Business Hours: ${details.hours || 'N/A'}
- Tone: ${details.tone || 'professional and friendly'}

Generate ONLY the system prompt text, no explanations.`,
    })

    if (company.assistant_id) {
      await this.prisma.assistant_instructions.update({
        where: { id: company.assistant_id },
        data: { system_prompt: generatedPrompt },
      })
    }

    return { prompt: generatedPrompt }
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
}
