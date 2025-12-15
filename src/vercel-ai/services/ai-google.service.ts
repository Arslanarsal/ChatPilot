import { Injectable, Logger } from '@nestjs/common'
import { generateText, LanguageModelUsage, stepCountIs } from 'ai'
import { AiChatMessage, Clinic, Contact } from 'src/utils/constants/types'
import { DatesHelper } from 'src/utils/services/dates.service'
import { AiToolsService } from './ai-tools.service'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai';
import { ModelKey, ProviderKey } from 'src/common/logging/getModel'
import { AiAssistantConfigService } from './ai-assistant-config.service'


@Injectable()
export class AiGoogleService {
  private readonly logger = new Logger(AiGoogleService.name)

  constructor(
    private readonly aiToolsService: AiToolsService,
    private readonly datesHelper: DatesHelper,
    private readonly aiAssistantConfigService: AiAssistantConfigService,
  ) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required')
    }
  }

  /**
   * Used to Process a user message and return a response
  */
  async processMessage(
    contact: Contact,
    chatHistory: AiChatMessage[]
  ): Promise<{ text: string, usage: LanguageModelUsage, model: ModelKey, provider: ProviderKey }> {
    const company = contact.companies as Clinic
    const assistant = await this.aiAssistantConfigService.getAssistantConfig(contact)


    try {
      if (!assistant) {
        throw new Error('Assistant not found')
      }

      this.logger.log('ai-sdk start Processing message', { context: "processMessage", parameters: { contactId: contact.id, contactPhone: contact.phone, companyId: contact.companies.id, companyPhone: contact.companies.phone, chatHistoryLength: chatHistory, assistantId: company.assistant_id, assistantModel: assistant.model } })

      const nowInCompanyTimezone = this.datesHelper.localNow()
      const systemPrompt = `
        ${assistant.systemPrompt}
      [System message: This message was sent on ${this.datesHelper.localWeekdayName()} ${nowInCompanyTimezone}
      If you need to know the names of the upcoming days, use these values:
      ${this.datesHelper.getDateAliases()}]
      `
      const { text, usage, providerMetadata, response } = await generateText({
        model: assistant.model,
        system: systemPrompt,
        tools: assistant.tools,
        temperature: assistant.temperature || 0.1,
        messages: chatHistory as any,
        stopWhen: stepCountIs(5),
      })
      this.logger.log('ai-sdk generated text response', { context: "processMessage", parameters: { contactId: contact.id, contactPhone: contact.phone, companyId: contact.companies.id, companyPhone: contact.companies.phone, chatHistoryLength: chatHistory, assistantId: company.assistant_id, assistantModel: assistant.metadata.model, }, result: text })
      return { text, usage, provider: assistant.metadata.provider as ProviderKey, model: assistant?.metadata.model as ModelKey }
    } catch (error) {
      this.logger.error(`ai-sdk processing message failed`, { context: "processMessage", parameters: { contactId: contact.id, contactPhone: contact.phone, companyId: contact.companies.id, companyPhone: contact.companies.phone, text: chatHistory, assistantId: company.assistant_id, assistantModel: assistant?.metadata.model, }, err: error })

      // Return a meaningful error response instead of undefined
      throw new Error(`Failed to process message with ai-sdk`)
    }
  }


  /***
   * used to generate follow up and reminders
   */
  async processPrompts(
    contact: Contact,
    systemPrompt: string,
    prompt: string
  ): Promise<{ text: string, usage: LanguageModelUsage, model: ModelKey, provider: ProviderKey }> {
    const tools = this.aiToolsService.getContactTools(contact)

    // Validate inputs
    if (!contact) {
      throw new Error('Contact is required')
    }

    if (!systemPrompt) {
      throw new Error('System prompt is required')
    }
    try {
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY,
      })


      const { text, usage, providerMetadata, response } = await generateText({
        model: google('gemini-2.5-flash'),
        system: systemPrompt,
        tools,
        // messages: chatHistory as any,
        prompt: prompt,
        stopWhen: stepCountIs(5)
      })

      this.logger.log('Successfully generated text response', {
        context: 'processPrompt', parameters: {
          provider: 'google',
          model: 'gemini-2.0-flash',
          contactId: contact?.id,
          contactPhone: contact?.phone,
          companyId: contact?.companies?.id,
          companyPhone: contact?.companies?.phone,
          prompt: prompt,
          systemPrompt: systemPrompt,
        },
        result: text
      })
      return { text, usage, provider: Object.keys(providerMetadata as any)[0] as ProviderKey, model: 'gemini-2.5-flash' as ModelKey }
    } catch (error) {
      this.logger.error('process prompt failed', {

        context: 'processPrompt',
        parameters: {
          provider: 'google',
          model: 'gemini-2.0-flash',
          contactId: contact?.id,
          contactPhone: contact?.phone,
          companyId: contact?.companies?.id,
          companyPhone: contact?.companies?.phone,
          prompt: prompt,
          systemPrompt: systemPrompt,
        },
        error: error,
      })

      // Return a meaningful error response instead of undefined
      throw new Error(`Failed to process message with Google AI: ${error.message}`)
    }
  }

  async processPromptsUsingOpenAI(
    contact: Contact,
    systemPrompt: string,
    prompt: string,
  ): Promise<{ text: string, usage: LanguageModelUsage, model: ModelKey, provider: ProviderKey }> {
    const tools = this.aiToolsService.getContactTools(contact)

    // Validate inputs
    if (!contact) {
      throw new Error('Contact is required')
    }

    if (!systemPrompt) {
      throw new Error('System prompt is required')
    }
    const modelName: ModelKey = 'gpt-5-mini'
    try {
      const openAi = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      })


      this.logger.log("prompt", { context: 'processPrompt', parameters: { prompt, contactId: contact?.id, contactPhone: contact?.phone, companyId: contact?.companies?.id, companyPhone: contact?.companies?.phone } })
      const { text, usage, providerMetadata, response } = await generateText({
        model: openAi(modelName),
        system: systemPrompt,
        tools,
        // messages: chatHistory as any,
        prompt: prompt,
        temperature: 0.3,
        stopWhen: stepCountIs(5)
      })

      this.logger.log('Successfully generated text response', {
        context: 'processPrompt', parameters: {
          provider: 'openAI',
          model: modelName,
          contactId: contact?.id,
          contactPhone: contact?.phone,
          companyId: contact?.companies?.id,
          companyPhone: contact?.companies?.phone,
          prompt: prompt,
          systemPrompt: systemPrompt,
        }, result: text
      })
      return { text, usage, provider: Object.keys(providerMetadata as any)[0] as ProviderKey, model: modelName as ModelKey }
    } catch (error) {
      this.logger.error('process prompt failed', {

        context: 'processPrompt',
        parameters: {
          provider: 'openAI',
          model: modelName,
          contactId: contact?.id,
          contactPhone: contact?.phone,
          companyId: contact?.companies?.id,
          companyPhone: contact?.companies?.phone,
          prompt: prompt,
          systemPrompt: systemPrompt,
        },
        error: error,
      })

      // Return a meaningful error response instead of undefined
      throw new Error(`Failed to process message with Open AI: ${error.message}`)
    }
  }
}
