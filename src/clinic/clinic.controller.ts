import { Body, Controller, Get, Param, ParseIntPipe, Post, Res } from '@nestjs/common';
import { ApiBody, ApiOperation } from '@nestjs/swagger';
import { ClinicService } from './clinic.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@Controller('clinic')
export class ClinicController {
  constructor(private readonly clinicService: ClinicService) {}

  @ApiOperation({ summary: 'Create Clinic' })
  @ApiBody({
    type: CreateCompanyDto,
    description: 'The webhook data in JSON format',
  })
  @Post()
  createCompany(@Body() createWebhookDto: CreateCompanyDto) {
    return this.clinicService.createCompany(createWebhookDto);
  }

  @ApiOperation({
    summary: 'Sync/Get Connection Status of companies connected with wapi',
  })
  @Get('sync-connection_status')
  async syncWapiSessionStatus() {
    return await this.clinicService.syncAllWapiSessionStatus();
  }

  @ApiOperation({ summary: 'Create Session for Company' })
  @Post(':id/create_session')
  async createSession(@Param('id', ParseIntPipe) id: number) {
    return await this.clinicService.createSession(id);
  }

  @ApiOperation({ summary: 'Get wapi QrCode for Company ' })
  @Get(':id/get_qr')
  async getQrCode(@Res() res: Response, @Param('id', ParseIntPipe) id: number) {
    return await this.clinicService.getSessionQrCode(res, id);
  }
}
