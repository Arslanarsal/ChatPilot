import { Injectable } from '@nestjs/common';
import { Contact } from 'src/utils/constant/types';

@Injectable()
export class AiToolsService {
  constructor() {}
  getContactTools(contact: Contact) {
    return {};
  }
}
