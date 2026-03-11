import { ConflictException, Injectable } from '@nestjs/common'
import { CreateWhatsappConnectorDto } from './dto/create-whatsapp-connector.dto'
import { PrismaService } from 'src/prisma/prisma.service'
import { whatsapp_connector_server } from '@prisma/client'

@Injectable()
export class WhatsappConnectorService {
  constructor(private readonly prismaService: PrismaService) {}
  async create(createWhatsappConnectorDto: CreateWhatsappConnectorDto) {
    const isExist = await this.findByUrl(createWhatsappConnectorDto.url)
    if (isExist) {
      throw new ConflictException('server already exist ')
    }
    const connector = await this.prismaService.whatsapp_connector_server.create(
      {
        data: createWhatsappConnectorDto,
      },
    )
    return { success: true, connector }
  }
  async findByUrl(url: string) {
    return await this.prismaService.whatsapp_connector_server.findFirst({
      where: {
        url: url,
      },
    })
  }
  async findAll() {
    return await this.prismaService.whatsapp_connector_server.findMany({})
  }

  async findOne(id: number) {
    return await this.prismaService.whatsapp_connector_server.findFirst({
      where: { id },
    })
  }

  async updateConnectorUrl(
    serverId: number,
    updateServerDto: Partial<CreateWhatsappConnectorDto>,
  ) {
    const duplicate =
      await this.prismaService.whatsapp_connector_server.findFirst({
        where: {
          id: { not: serverId },
          url: updateServerDto.url,
        },
      })
    if (duplicate) {
      throw new ConflictException('connector with this domain already exist')
    }
    const updatedConnector =
      await this.prismaService.whatsapp_connector_server.update({
        where: {
          id: serverId,
        },
        data: updateServerDto,
      })
    return { success: true, connector: updatedConnector }
  }
}
