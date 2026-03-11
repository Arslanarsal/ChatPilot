import { forwardRef, Module } from '@nestjs/common'
import { CompanyService } from './company.service'
import { CompanyController } from './company.controller'
import { ContactModule } from 'src/contact/contact.module'
import { PrismaModule } from 'src/prisma/prisma.module'
import { UtilsModule } from 'src/utils/utils.module'

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UtilsModule),
    forwardRef(() => ContactModule),
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
