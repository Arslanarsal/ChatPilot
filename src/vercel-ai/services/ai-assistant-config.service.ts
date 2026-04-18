import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { Contact } from 'src/utils/constants/types'
import {
  GEMINI_MODELS,
  GeminiModelKey,
} from 'src/common/logging/getModel'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { LanguageModel } from 'ai'
import { AiToolsService } from './ai-tools.service'
import {
  BUILTIN_TOOL_INSTRUCTIONS,
  buildAssetsPrompt,
} from '../constants/builtin-prompt'

const DEFAULT_MODEL: GeminiModelKey = 'gemini-2.5-flash'

type AssistantConfig = {
  systemPrompt: string
  model: LanguageModel
  tools: any
  temperature: number
  metadata: {
    provider: string
    model: string
  }
}

@Injectable()
export class AiAssistantConfigService {
  private readonly logger = new Logger(AiAssistantConfigService.name)

  constructor(
    private readonly prismaService: PrismaService,
    private readonly aiToolsService: AiToolsService,
  ) {
    this.logger.log('AiConfigService initialized')
  }

  async getAssistantConfig(contact: Contact): Promise<AssistantConfig | null> {
    const company = contact?.companies

    if (!company?.assistant_id) {
      this.logger.error('No assistant_id found for company', {
        companyId: company?.id,
      })
      return null
    }

    try {
      const [assistant, assets] = await Promise.all([
        this.prismaService.assistant_instructions.findFirst({
          where: { id: company.assistant_id },
        }),
        this.prismaService.company_assets.findMany({
          where: { company_id: company.id },
          select: {
            file_url: true,
            file_type: true,
            file_name: true,
            description: true,
          },
        }),
      ])

      if (!assistant) {
        this.logger.error('Assistant instructions not found', {
          assistantId: company.assistant_id,
        })
        return null
      }

      const modelConfig = this.getModel(assistant.model ?? DEFAULT_MODEL)
      const tools = this.aiToolsService.getContactTools(contact, [])

      // Assemble full prompt: built-in tool instructions + company custom prompt + asset references
      const companyPrompt =
        assistant.system_prompt ?? 'You are a helpful AI assistant.'
      const assetsPrompt = buildAssetsPrompt(assets)
      const fullSystemPrompt = `${BUILTIN_TOOL_INSTRUCTIONS}\n\n## Your Role & Instructions\n\n${companyPrompt}${assetsPrompt}`

      return {
        systemPrompt: fullSystemPrompt,
        model: modelConfig.model,
        tools,
        temperature: assistant.temperature ?? 0.1,
        metadata: modelConfig.metadata,
      }
    } catch (error) {
      this.logger.error('Error getting assistant config', {
        context: 'getAssistantConfig',
        companyId: company.id,
        error: error.message,
      })
      return null
    }
  }

  private getModel(modelName: string): {
    model: LanguageModel
    metadata: { provider: string; model: string }
  } {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    })

    const resolvedName = GEMINI_MODELS.includes(modelName as GeminiModelKey)
      ? (modelName as GeminiModelKey)
      : DEFAULT_MODEL

    return {
      model: google(resolvedName),
      metadata: {
        provider: 'google',
        model: resolvedName,
      },
    }
  }
}
