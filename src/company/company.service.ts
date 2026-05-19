import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { CreateCompanyDto } from './dto/create-company.dto'
import { companies } from '@prisma/client'
import { Company } from 'src/utils/constants/types'
import { WhatsBaileyService } from 'src/utils/services/whats-bailey.service'
import { SupabaseStorageService } from 'src/utils/services/supabase-storage.service'
import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { decryptMessagesInPlace } from 'src/common/crypto/message-crypto'

const OTP_TTL_MS = 60 * 1000

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WhatsBaileyService))
    private readonly whatsBaileyService: WhatsBaileyService,
    private readonly supabaseStorage: SupabaseStorageService,
  ) {}

  async findByPhone(targetPhone: number) {
    return await this.prisma.companies.findFirst({
      where: { phone: Number(targetPhone) },
    })
  }

  async findBySessionId(sessionId: string) {
    return await this.prisma.companies.findFirst({
      where: { session_id: sessionId },
    })
  }

  async findById(id: number): Promise<Company | null> {
    return (await this.prisma.companies.findFirst({
      where: { id: Number(id) },
    })) as Company
  }

  async createCompany(createCompanyDto: CreateCompanyDto) {
    return await this.prisma.companies.create({
      data: {
        ...createCompanyDto,
      },
    })
  }

  async createSession(companyId: number, usePairingCode?: boolean, phoneNumber?: string) {
    const company = await this.findById(companyId)
    if (!company) throw new UnprocessableEntityException('company not found')

    if (usePairingCode && !phoneNumber) {
      throw new UnprocessableEntityException('Phone number is required when using pairing code')
    }

    // If session already exists, check if truly active
    if (company.session_id) {
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

    const session = await this.whatsBaileyService.startSession(company, usePairingCode, phoneNumber)
    this.logger.log(`${session.success}`, 'company service')
    if (!session.success) {
      throw new UnprocessableEntityException(session.message)
    }

    await this.updateCompany(company.id, {
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
    })) as Company
  }
  async getSessionQrCode(res, companyId: number) {
    const company = await this.findById(companyId)
    if (!company) throw new UnprocessableEntityException('company not found')
    if (!company.session_id) {
      res.setHeader('Content-Type', 'application/json')
      return res.send({ statusCode: 200, data: null, message: 'No active session. Please create a session first.' })
    }
    return await this.whatsBaileyService.getSessionQrCode(res, company)
  }
  async getSessionStatus(companyId: number) {
    const company = await this.findById(companyId)
    if (!company) throw new UnprocessableEntityException('company not found')
    if (!company.session_id) {
      return { success: false, state: 'DISCONNECTED', message: 'No active session' }
    }
    return await this.whatsBaileyService.getSessionStatus(company)
  }

  async syncAllSessionStatus() {
    const companies = await this.prisma.companies.findMany({
      where: {
        session_id: { not: null },
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
    }))
  }

  async removeSession(companyId: number) {
    const company = await this.findById(companyId)
    if (!company) throw new UnprocessableEntityException('company not found')
    if (!company.session_id) {
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

    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    })

    const { text: generatedPrompt } = await generateText({
      model: google('gemini-2.5-flash'),
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
    filters?: {
      needs_review?: string
      bot_activated?: string
      has_appointment?: string
      active_within?: string
    },
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

    if (filters?.needs_review === 'true') {
      where.needs_review = true
    }

    if (filters?.bot_activated === 'true') {
      where.is_bot_activated = true
    } else if (filters?.bot_activated === 'false') {
      where.is_bot_activated = false
    }

    if (filters?.has_appointment === 'true') {
      where.crm_appointment_id = { not: null }
    }

    if (filters?.active_within === '24h') {
      where.last_message_received = {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      }
    } else if (filters?.active_within === '7d') {
      where.last_message_received = {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      }
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

    return { contact, messages: decryptMessagesInPlace(messages) }
  }

  async sendDeleteOtp(companyId: number) {
    const company = await this.findById(companyId)
    if (!company) throw new UnprocessableEntityException('Company not found')

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + OTP_TTL_MS)

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
        `Your ChatPilot delete verification code is: *${otp}*\n\nThis code expires in 1 minute. Do not share it with anyone.`,
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

    if (company.session_id) {
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

  // ─── Company Assets (File Upload) ──────────────────────────────

  async uploadAsset(
    companyId: number,
    file: { originalname: string; buffer: Buffer; mimetype: string },
    description?: string,
  ) {
    const fileUrl = await this.supabaseStorage.uploadCompanyAsset(
      companyId,
      file.originalname,
      file.buffer,
      file.mimetype,
    )

    if (!fileUrl) {
      throw new UnprocessableEntityException('Failed to upload file')
    }

    const fileType = this.getFileType(file.mimetype, file.originalname)

    const asset = await this.prisma.company_assets.create({
      data: {
        company_id: companyId,
        file_url: fileUrl,
        file_type: fileType,
        file_name: file.originalname,
        description: description || null,
      },
    })

    return asset
  }

  async getAssets(companyId: number) {
    return this.prisma.company_assets.findMany({
      where: { company_id: companyId },
      orderBy: { created_at: 'desc' },
    })
  }

  async deleteAsset(companyId: number, assetId: number) {
    const asset = await this.prisma.company_assets.findFirst({
      where: { id: assetId, company_id: companyId },
    })

    if (!asset) {
      throw new UnprocessableEntityException('Asset not found')
    }

    // Delete from Supabase storage
    await this.supabaseStorage.deleteCompanyAsset(asset.file_url)

    // Delete from DB
    await this.prisma.company_assets.delete({
      where: { id: assetId },
    })

    return { success: true }
  }

  async updateAssetDescription(companyId: number, assetId: number, description: string) {
    const asset = await this.prisma.company_assets.findFirst({
      where: { id: assetId, company_id: companyId },
    })

    if (!asset) {
      throw new UnprocessableEntityException('Asset not found')
    }

    return this.prisma.company_assets.update({
      where: { id: assetId },
      data: { description },
    })
  }

  private getFileType(mimetype: string, filename: string): string {
    if (mimetype.startsWith('image/')) return 'image'
    if (mimetype.startsWith('video/')) return 'video'
    if (mimetype === 'application/pdf') return 'pdf'
    if (mimetype.includes('word') || mimetype.includes('document')) return 'doc'
    if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return 'xls'
    if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return 'ppt'

    // Fallback to extension
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image'
    if (['mp4', 'mov', '3gp'].includes(ext)) return 'video'
    if (ext === 'pdf') return 'pdf'
    if (['doc', 'docx'].includes(ext)) return 'doc'

    return ext || 'file'
  }
}
