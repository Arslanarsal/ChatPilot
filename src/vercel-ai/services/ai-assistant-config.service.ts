import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { Contact } from 'src/utils/constants/types'
import {
  GEMINI_MODELS,
  OPENAI_MODELS,
  GeminiModelKey,
  OpenAIModelKey,
} from 'src/common/logging/getModel'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { LanguageModel } from 'ai'
import { AiToolsService } from './ai-tools.service'

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
      const assistant =
        await this.prismaService.assistant_instructions.findFirst({
          where: { id: company.assistant_id },
        })

      if (!assistant) {
        this.logger.error('Assistant instructions not found', {
          assistantId: company.assistant_id,
        })
        return null
      }

      const modelConfig = this.getModel(assistant.model ?? 'gpt-4o-mini')
      const tools = this.aiToolsService.getContactTools(contact, [])

      return {
        systemPrompt:
          assistant.system_prompt ?? 'You are a helpful AI assistant.',
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
    if (GEMINI_MODELS.includes(modelName as GeminiModelKey)) {
      const model = createGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY,
      })(modelName)
      return {
        model,
        metadata: {
          provider: 'google',
          model: modelName,
        },
      }
    }

    if (OPENAI_MODELS.includes(modelName as OpenAIModelKey)) {
      const model = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      })(modelName)
      return {
        model,
        metadata: {
          provider: 'openai',
          model: modelName,
        },
      }
    }

    // Default to OpenAI gpt-4o-mini
    const model = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })('gpt-4o-mini')
    return {
      model,
      metadata: {
        provider: 'openai',
        model: 'gpt-4o-mini',
      },
    }
  }
}
