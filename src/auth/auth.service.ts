import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { PrismaService } from 'src/prisma/prisma.service'
import { ConfigsService } from 'src/config/config.service'
import { SignupDto } from './dto/signup.dto'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configsService: ConfigsService,
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
      })

      return { user, company }
    })

    return this.generateTokens(result.user.id, result.user.phone)
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.users.findUnique({
      where: { phone: dto.phone },
    })

    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password)
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials')
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
      include: { company: true },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    const { password: _, ...result } = user
    return result
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
