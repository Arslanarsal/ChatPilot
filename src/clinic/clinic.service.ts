import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { companies, whatsapp_connector_server } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { Clinic } from 'src/utils/constant/types';
import { WhatsAppConnectorType } from 'src/whatsapp-connector/dto/create-whatsapp-connector.dto';
import { WhatsBaileyService } from '../utils/services/whats-bailey.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@Injectable()
export class ClinicService {
  private readonly logger = new Logger(ClinicService.name);

  constructor(
    private prisma: PrismaService,
    private whatsBaileyService: WhatsBaileyService,
  ) {}

  // Create Company
  async createCompany(createCompanyDto: CreateCompanyDto) {
    return await this.prisma.companies.create({
      data: {
        ...createCompanyDto,
      },
    });
  }

  async syncAllWapiSessionStatus() {
    const companies = await this.prisma.companies.findMany({
      where: {
        whatsapp_connector_server: {
          type: {
            in: [WhatsAppConnectorType.WHATS_BAILEY],
          },
        },
      },
      include: {
        whatsapp_connector_server: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
    const Companies = companies.filter(
      (company) => company.whatsapp_connector_server?.type === WhatsAppConnectorType.WHATS_BAILEY,
    );
    const res: any = [];
    for (const company of Companies) {
      let status = false;
      if (company.whatsapp_connector_server?.type === WhatsAppConnectorType.WHATS_BAILEY) {
        status =
          (await this.whatsBaileyService.getSessionStatus(company)).state === 'CONNECTED'
            ? true
            : false;
      }
      res.push({
        id: company.id,
        new_status: status,
        old_status: company.wapi_connection_status,
        name: company.name,
        session_id: company.id,
        phone: company.phone,
        server_url: company.whatsapp_connector_server?.url,
        server_id: company.whatsapp_connector_server?.id,
        whatsapp_provider: company.whatsapp_connector_server?.type,
      });
      company.wapi_connection_status = (
        await this.updateClinic(company.id, {
          wapi_connection_status: status,
        })
      ).wapi_connection_status;

      this.logger.log(
        `Current wapi_connection_status for companyId :${company.id} Whatsapp_SessionId : ${company.id} conn_status  ${company.wapi_connection_status} `,
      );
    }
    return res;
  }

  async updateClinic(clinicId: number, updateClinicDto: Partial<companies>): Promise<Clinic> {
    return (await this.prisma.companies.update({
      where: { id: clinicId },
      data: updateClinicDto as any,

      include: {
        whatsapp_connector_server: true,
      },
    })) as Clinic;
  }

  async createSession(companyId: number) {
    const company = await this.findById(companyId);
    if (!company) throw new UnprocessableEntityException('company not found');

    if (
      company.whatsapp_connector_server?.type === WhatsAppConnectorType.WHATS_BAILEY &&
      company.id !== null
    ) {
      if (company.whatsapp_connector_server?.type === WhatsAppConnectorType.WHATS_BAILEY) {
        const sessionStatus = await this.whatsBaileyService.getSessionStatus(company);
        if (sessionStatus.success) throw new UnprocessableEntityException(sessionStatus.message);
      }
    }

    const server = await this.getAvailableWapiServer();

    if (!server) throw new UnprocessableEntityException('no server available');

    if (server.type === WhatsAppConnectorType.WHATS_BAILEY) {
      const session = await this.whatsBaileyService.startSession(company, server);
      this.logger.log(`${session.success}`, 'clininc service');
      if (!session.success) throw new UnprocessableEntityException(session.message);
    }

    await this.updateClinic(company.id, {
      whatsapp_connector_server_id: server.id,
    });
    return {
      success: true,
      message: 'Session initiated successfully',
    };
  }

  async getAvailableWapiServer(): Promise<whatsapp_connector_server | null> {
    const server = await this.prisma.$queryRaw`
         SELECT s.*
         FROM  public.whatsapp_connector_server as s
         LEFT JOIN companies c ON s.id = c.whatsapp_connector_server_id
         WHERE s.type IN ('whats_bailey')
         GROUP BY s.id
         HAVING
            (
              s.type = 'whats_bailey' AND COUNT(c.id) < 4
            )
         ORDER BY COUNT(c.id) ASC
         LIMIT 1;
        `;
    return server ? server[0] : null;
  }

  // async getAvailableWapiServer(): Promise<whatsapp_connector_server | null> {
  //     const server = await this.prisma.$queryRaw`
  //      SELECT s.*
  //      FROM  public.whatsapp_connector_server as s
  //      LEFT JOIN companies c ON s.id = c.whatsapp_connector_server_id
  //      WHERE s.type IN ('wapi', 'whats_bailey')
  //      GROUP BY s.id
  //      HAVING
  //         (
  //           s.type = 'wapi' AND COUNT(c.id) < 2
  //         ) OR (
  //           s.type = 'whats_bailey' AND COUNT(c.id) < 4
  //         )
  //      ORDER BY COUNT(c.id) ASC
  //      LIMIT 1;
  //     `
  //     return server ? server[0] : null
  // }

  async findById(id: number): Promise<Clinic | null> {
    return (await this.prisma.companies.findFirst({
      where: { id: Number(id) },
      include: {
        whatsapp_connector_server: true,
      },
    })) as Clinic;
  }

  async getSessionQrCode(res, companyId: number) {
    const company = await this.findById(companyId);
    if (!company) throw new UnprocessableEntityException('company not found');
    if (
      company.whatsapp_connector_server?.type !== WhatsAppConnectorType.WHATS_BAILEY ||
      company.whatsapp_connector_server?.url == null
    )
      throw new UnprocessableEntityException(`provider isn't wapi/WhatsBailey or wapi url missing`);
    if (company.whatsapp_connector_server?.type === WhatsAppConnectorType.WHATS_BAILEY) {
      return await this.whatsBaileyService.getSessionQrCode(res, company);
    } else {
      throw new UnprocessableEntityException(`provider whatsBailey  url missing`);
    }
  }

  async findByPhone(targetPhone: number) {
    return await this.prisma.companies.findFirst({
      where: { phone: Number(targetPhone) },
      include: {
        whatsapp_connector_server: true,
      },
    });
  }
}
