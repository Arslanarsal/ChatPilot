import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common'
import { WhatsappConnectorService } from './whatsapp-connector.service'
import { CreateWhatsappConnectorDto } from './dto/create-whatsapp-connector.dto'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

@ApiTags('WhatsApp Connector')
@Controller('whatsapp-connector')
export class WhatsappConnectorController {
  constructor(
    private readonly whatsappConnectorService: WhatsappConnectorService,
  ) {}

  @ApiOperation({ summary: 'add wapi server in whatsapp connector list' })
  @Post()
  async create(@Body() createWhatsappConnectorDto: CreateWhatsappConnectorDto) {
    return await this.whatsappConnectorService.create(
      createWhatsappConnectorDto,
    )
  }

  @Get()
  async findAll() {
    return await this.whatsappConnectorService.findAll()
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.whatsappConnectorService.findOne(id)
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateConnectorDto: Partial<CreateWhatsappConnectorDto>,
  ) {
    return await this.whatsappConnectorService.updateConnectorUrl(
      id,
      updateConnectorDto,
    )
  }
}
