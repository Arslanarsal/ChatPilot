import { forwardRef, Module } from '@nestjs/common'
import { ClinicService } from './clinic.service'
import { CompanyController } from './company.controller'
import { ContactModule } from 'src/contact/contact.module'
import { PrismaModule } from 'src/prisma/prisma.module'
import { UtilsModule } from 'src/utils/utils.module'

@Module({
  imports: [
    PrismaModule,
    UtilsModule,
    forwardRef(() => ContactModule)
  ],
  controllers: [CompanyController],
  providers: [ClinicService],
  exports: [ClinicService],
})
export class ClinicModule {}
