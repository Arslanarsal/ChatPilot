import {
  Injectable,
  UnauthorizedException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { PrismaService } from 'src/prisma/prisma.service'
import { ConfigsService } from 'src/config/config.service'
import { SignupDto } from './dto/signup.dto'
import { LoginDto } from './dto/login.dto'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { VerifyOtpDto } from './dto/verify-otp.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { CompanyService } from 'src/company/company.service'
import { WhatsBaileyService } from 'src/utils/services/whats-bailey.service'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configsService: ConfigsService,
    @Inject(forwardRef(() => CompanyService))
    private readonly companyService: CompanyService,
    private readonly whatsBaileyService: WhatsBaileyService,
  ) {}

  async signup(dto: SignupDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10)

    const result = await this.prisma.$transaction(async tx => {
      const instructions = await tx.assistant_instructions.create({
        data: {
          system_prompt: 'You are a helpful WhatsApp business assistant.',
        },
      })

      const company = await tx.companies.create({
        data: {
          name: dto.company_name,
          phone: BigInt(dto.phone),
          openai_assistant_id: '',
          assistant_id: instructions.id,
        },
      })

      const user = await tx.users.create({
        data: {
          phone: dto.phone,
          password: hashedPassword,
          company_name: dto.company_name,
          company_id: company.id,
        },
        select: { id: true, phone: true },
      })

      return { user, company }
    })

    return this.generateTokens(result.user.id, result.user.phone)
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.users.findUnique({
      where: { phone: dto.phone },
      select: { id: true, phone: true, password: true },
    })

    if (!user) {
      throw new UnauthorizedException('Phone number or password is incorrect')
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password)
    if (!isPasswordValid) {
      throw new UnauthorizedException('Phone number or password is incorrect')
    }

    return this.generateTokens(user.id, user.phone)
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configsService.jwtRefreshSecret,
      })

      const user = await this.prisma.users.findUnique({
        where: { id: payload.sub },
        select: { id: true, phone: true },
      })

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token')
      }

      return this.generateTokens(user.id, user.phone)
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  async getMe(userId: number) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        company_id: true,
        company_name: true,
        created_at: true,
        updated_at: true,
        company: true,
      },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    return user
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.users.findUnique({
      where: { phone: dto.phone },
      select: { id: true, phone: true },
    })

    if (!user) {
      throw new UnauthorizedException('No account found with this phone number')
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    try {
      await this.prisma.users.update({
        where: { phone: dto.phone },
        data: { otp_code: otp, otp_expires_at: expiresAt },
        select: { id: true },
      })
    } catch (error) {
      this.logger.error('Failed to store OTP in database', error?.message)
      throw new UnauthorizedException(
        'Password reset is temporarily unavailable. Please try again later.',
      )
    }

    // Send OTP via Company 1's WhatsApp
    try {
      const company = await this.companyService.findById(1)
      if (company) {
        await this.whatsBaileyService.sendMessage(
          company,
          Number(dto.phone),
          `Your ChatPilot verification code is: *${otp}*\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
        )
      } else {
        this.logger.error('Company 1 not found for OTP sending')
        throw new Error('OTP service unavailable')
      }
    } catch (error) {
      this.logger.error('Failed to send OTP via WhatsApp', error?.message)
      throw new UnauthorizedException(
        'Failed to send OTP. Please make sure your WhatsApp number is correct.',
      )
    }

    return { success: true, message: 'OTP sent to your WhatsApp' }
  }

  async verifyOtp(dto: VerifyOtpDto) {
    let user: { id: number; phone: string; otp_code: string | null; otp_expires_at: Date | null } | null

    try {
      user = await this.prisma.users.findUnique({
        where: { phone: dto.phone },
        select: { id: true, phone: true, otp_code: true, otp_expires_at: true },
      })
    } catch (error) {
      this.logger.error('Failed to verify OTP - database error', error?.message)
      throw new UnauthorizedException(
        'OTP verification is temporarily unavailable. Please try again later.',
      )
    }

    if (!user) {
      throw new UnauthorizedException('No account found with this phone number')
    }

    if (
      !user.otp_code ||
      !user.otp_expires_at ||
      user.otp_code !== dto.otp ||
      user.otp_expires_at < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired OTP')
    }

    return { success: true, message: 'OTP verified' }
  }

  async resetPassword(dto: ResetPasswordDto) {
    let user: { id: number; phone: string; otp_code: string | null; otp_expires_at: Date | null } | null

    try {
      user = await this.prisma.users.findUnique({
        where: { phone: dto.phone },
        select: { id: true, phone: true, otp_code: true, otp_expires_at: true },
      })
    } catch (error) {
      this.logger.error('Failed to reset password - database error', error?.message)
      throw new UnauthorizedException(
        'Password reset is temporarily unavailable. Please try again later.',
      )
    }

    if (!user) {
      throw new UnauthorizedException('No account found with this phone number')
    }

    if (
      !user.otp_code ||
      !user.otp_expires_at ||
      user.otp_code !== dto.otp ||
      user.otp_expires_at < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired OTP')
    }

    const hashedPassword = await bcrypt.hash(dto.new_password, 10)

    try {
      await this.prisma.users.update({
        where: { phone: dto.phone },
        data: {
          password: hashedPassword,
          otp_code: null,
          otp_expires_at: null,
        },
        select: { id: true },
      })
    } catch (error) {
      this.logger.error('Failed to update password in database', error?.message)
      throw new UnauthorizedException(
        'Password reset is temporarily unavailable. Please try again later.',
      )
    }

    return { success: true, message: 'Password reset successfully' }
  }

  private generateTokens(userId: number, phone: string) {
    const payload = { sub: userId, phone }

    const access_token = this.jwtService.sign(payload, {
      secret: this.configsService.jwtSecret,
      expiresIn: '15m',
    })

    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configsService.jwtRefreshSecret,
      expiresIn: '7d',
    })

    return { access_token, refresh_token }
  }
}
