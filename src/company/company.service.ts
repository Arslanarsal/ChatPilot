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

  async createSession(companyId: number) {
    const company = await this.findById(companyId)
    if (!company) throw new UnprocessableEntityException('company not found')

    if (
      company.whatsapp_connector_server?.type ===
        WhatsAppConnectorType.WHATS_BAILEY &&
      company.session_id !== null
    ) {
      const sessionStatus =
        await this.whatsBaileyService.getSessionStatus(company)
      if (sessionStatus.success) {
        throw new UnprocessableEntityException(sessionStatus.message)
      }
    }

    const server = await this.getAvailableServer()
    if (!server) throw new UnprocessableEntityException('no server available')

    const session = await this.whatsBaileyService.startSession(company, server)
    this.logger.log(`${session.success}`, 'company service')
    if (!session.success) {
      throw new UnprocessableEntityException(session.message)
    }

    await this.updateCompany(company.id, {
      whatsapp_connector_server_id: server.id,
      session_id: companyId.toString(),
    })
    return {
      success: true,
      message: 'Session initiated successfully',
    }
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
}
