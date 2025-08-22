import { Controller } from '@nestjs/common';
import { ContectService } from './contect.service';

@Controller('contect')
export class ContectController {
  constructor(private readonly contectService: ContectService) {}
}
