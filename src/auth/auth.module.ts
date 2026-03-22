import { Module, forwardRef } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './strategies/jwt.strategy'
import { PrismaModule } from 'src/prisma/prisma.module'
import { ConfigsModule } from 'src/config'
import { CompanyModule } from 'src/company/company.module'

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({}),
    ConfigsModule,
    forwardRef(() => CompanyModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}
