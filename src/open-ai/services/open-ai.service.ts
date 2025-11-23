// openai.service.ts
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common'
import { ConfigsService } from 'src/config'
import OpenAI from 'openai'
// import { SentryService } from '@ntegral/nestjs-sentry';
import { DatesHelper } from '../../utils/services/dates.service'
import { ContactService } from 'src/contact/contact.service'

@Injectable()
export class OpenAIService {
  private readonly client: OpenAI
  private readonly logger = new Logger(OpenAIService.name)

  constructor(
    private readonly config: ConfigsService,
    // private readonly sentryService: SentryService,
    private readonly datesHelper: DatesHelper,
    @Inject(forwardRef(() => ContactService))
    private readonly contactService: ContactService,
  ) {
    this.client = new OpenAI({
      apiKey: this.config.openAiApiKey,
    })
  }

  async createThread(): Promise<OpenAI.Beta.Threads.Thread> {
    return this.client.beta.threads.create()
  }

  async runThread(
    assistantId: string,
    threadId: string,
    text: string,
    tools: Record<string, Function>,
  ): Promise<OpenAI.Beta.Threads.Run | null> {
    const dateAugmentedText = `
${text}

[mensagem do systema: Esta mensagem foi enviada ${this.datesHelper.localWeekdayName()} ${this.datesHelper.localNow()}
se precisa saber os nomes dos dias prossimos, utiliza estos valores:
${this.datesHelper.getDateAliases().join(', ')}]
`
    this.logger.debug(dateAugmentedText)

    try {
      let run = await this.createRun(assistantId, threadId, dateAugmentedText)
      this.logger.log(`👉 Run Created: ${run.id}`)

      while (run.status !== 'completed') {
        if (run.status === 'failed' || run.status === 'cancelled'|| run.status === 'expired') {
          this.logger.error(`Run failed with status ${run.status}`, run)
          return null
        }

        if (run.status === 'requires_action' && run.required_action) {
          const toolOutputs = await this.processToolCalls(
            run.required_action.submit_tool_outputs.tool_calls,
            tools,
          )
          run = await this.submitToolOutputs(threadId, run.id, toolOutputs)
        }

        this.logger.debug(`🏃 Run Status: ${run.status}`)
        run = await this.client.beta.threads.runs.retrieve(threadId, run.id)
      }

      this.logger.log(`🏁 Run Completed! ${threadId} ${run.id} ${assistantId}`)
      if (run.usage) {
        this.logger.log(`TOKENS: ${run.usage.prompt_tokens}`)
      }

      return run
    } catch (error) {
      this.handleRunError(error, threadId)
      return null
    }
  }

  private async createRun(
    assistantId: string,
    threadId: string,
    message: string,
  ): Promise<OpenAI.Beta.Threads.Run> {
    try {
      const run = await this.client.beta.threads.runs.createAndPoll(threadId, {
        assistant_id: assistantId,
        additional_messages: [
          {
            role: 'user',
            content: message,
          },
        ],
      })
      return run
    } catch (error) {
      if (error.message.includes('already has an active run')) {
        this.logger.warn('Already has existing run, canceling and retrying...')
        await this.cancelActiveRuns(threadId)
        return this.createRun(assistantId, threadId, message)
      }
      throw error
    }
  }

  private async cancelActiveRuns(threadId: string): Promise<void> {
    const runs = await this.client.beta.threads.runs.list(threadId)
    for (const run of runs.data) {
      if (!['completed', 'failed', 'cancelled'].includes(run.status)) {
        await this.client.beta.threads.runs.cancel(threadId, run.id)
      }
    }
  }

  async processToolCalls(
    toolCalls: any[],
    tools: Record<string, Function>,
  ): Promise<OpenAI.Beta.Threads.Runs.RunSubmitToolOutputsParams.ToolOutput[]> {
    const toolOutputs: any = []

    for (const toolCall of toolCalls) {
      try {
        this.logger.debug('toolcalls : ', toolCalls)

        const params = JSON.parse(toolCall.function.arguments)
        this.logger.debug(
          `TOOL CALL: ${toolCall.function.name}(${JSON.stringify(params)})`,
        )

        const toolFunc = tools[toolCall.function.name]
        if (!toolFunc) {
          this.logger.log(`Function ${toolCall.function.name} not found`)
          throw new Error(`Function ${toolCall.function.name} not found`)
        }

        const toolResponse = await toolFunc(...Object.values(params))
        this.logger.debug(`RESPONSE: ${toolResponse}`)

        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: toolResponse,
        })
      } catch (error) {
        this.logger.error(
          `ProcessToolCalls =>${toolCall.function.name} params : ${toolCall.function.arguments} Tool error : ${error.message}`,
        )
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: `Error: ${error.message}`,
        })
      }
    }
    return toolOutputs
  }

  private async submitToolOutputs(
    threadId: string,
    runId: string,
    toolOutputs: any[],
  ): Promise<OpenAI.Beta.Threads.Run> {
    return this.client.beta.threads.runs.submitToolOutputs(threadId, runId, {
      tool_outputs: toolOutputs,
    })
  }

  private handleRunError(error: any, threadId: string): void {
    this.logger.error(`Error during thread run: ${error.message}`)
    if (
      error.run?.status &&
      ['active', 'requires_action'].includes(error.run.status)
    ) {
      this.client.beta.threads.runs.cancel(threadId, error.run.id)
      this.logger.warn(`Run ${error.run.id} cancelled due to error`)
    }
    // this.sentryService.instance().captureException(error);
  }

  async listMessages(
    threadId: string,
  ): Promise<{ type: string; content: string }> {
    const messages = await this.client.beta.threads.messages.list(threadId)
    const latestMessage = messages.data[0]
    const content = latestMessage.content[0]

    this.logger.log(
      `💬 Response: ${content.type === 'text' ? content.text.value : 'No text available'}`,
    )

    return {
      type: content.type,
      content: content.type === 'text' ? content.text.value : 'No content',
    }
  }
}
