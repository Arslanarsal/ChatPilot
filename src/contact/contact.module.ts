import { forwardRef, Module } from '@nestjs/common'
import { ContactService } from './contact.service'
import { OpenAIModule } from 'src/open-ai/open-ai.module'
import { PrismaModule } from 'src/prisma/prisma.module'
import { UtilsModule } from 'src/utils/utils.module'

@Module({
  imports: [
    PrismaModule,
    UtilsModule,
    forwardRef(() => OpenAIModule)
  ],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
