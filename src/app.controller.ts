import { Controller, Get, Logger } from '@nestjs/common'
import { AppService } from './app.service'
import { PrismaService } from './prisma/prisma.service'

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name)
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}
  @Get()
  async getHello(): Promise<any> {
    return await this.appService.getHello()
  }
  @Get('/debug-sentry')
  getError() {
    throw new Error('My first Sentry error!')
  }

  @Get('/merge-duplicate-contacts')
  async mergeDuplicateContacts() {
    const mergedList: any = []
    const companies = await this.prisma.companies.findMany({
      orderBy: { created_at: 'asc' },
    })

    for (const company of companies) {
      const contacts = await this.prisma.contacts.findMany({
        where: { company_id: company.id },
        orderBy: { created_at: 'desc' },
      })
      const phoneGroups = contacts.reduce((acc, contact) => {
        const phone = contact.phone?.toString()
        if (!phone) return acc

        if (!acc[phone]) {
          acc[phone] = {
            phone: contact.phone,
            contactIds: [contact.id],
          }
        } else {
          acc[phone].contactIds.push(contact.id)
        }
        return acc
      }, {})
      const transformed: any = Object.values(phoneGroups)
      for (const contact of transformed) {
        if (contact.contactIds.length > 1) {
          const keepId = contact.contactIds[0]
          mergedList.push({
            companyId: company.id,
            contactId: keepId,
            phone: contact.phone,
          })
          contact.contactIds.shift()
          this.logger.log(
            `after removing latest from  ${contact.phone} `,
            contact.contactIds,
          )
          await this.prisma.messages.updateMany({
            where: {
              contact_id: { in: contact.contactIds },
            },
            data: {
              contact_id: keepId,
            },
          })
          await this.prisma.contacts.deleteMany({
            where: { id: { in: contact.contactIds } },
          })
        }
      }
    }
    return mergedList
  }
}
