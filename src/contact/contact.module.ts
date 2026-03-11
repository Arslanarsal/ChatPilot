import { Module, forwardRef } from '@nestjs/common'
import { ContactService } from './contact.service'
import { PrismaModule } from 'src/prisma/prisma.module'
import { UtilsModule } from 'src/utils/utils.module'

@Module({
  imports: [PrismaModule, forwardRef(() => UtilsModule)],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
