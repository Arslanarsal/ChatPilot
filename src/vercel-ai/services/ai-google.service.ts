import { Injectable, Logger } from '@nestjs/common';
import { AiChatMessage, Contact } from 'src/utils/constant/types';
import { AiToolsService } from './ai-tools.service';
import { createOpenAI, OpenAIProvider } from '@ai-sdk/openai';
import { generateText } from 'ai';

@Injectable()
export class AiGoogleService {
  private readonly logger = new Logger(AiGoogleService.name);

  constructor(private readonly aiToolsService: AiToolsService) {}

  async processPromptsUsingOpenAI(
    contact: Contact,
    chatHistory: AiChatMessage[],
    systemPrompt: string,
    prompt: string,
  ): Promise<string | any> {
    const tools = this.aiToolsService.getContactTools(contact);

    // Validate inputs
    if (!contact) {
      throw new Error('Contact is required');
    }

    if (!systemPrompt) {
      throw new Error('System prompt is required');
    }

    try {
      const openAi = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      this.logger.log('Processing message with Open AI service');
      this.logger.log('Chat history length:', chatHistory.length);

      const { text, steps } = await generateText({
        model: openAi('gpt-4o-mini'),
        system: systemPrompt,
        tools,
        // messages: chatHistory as any,
        prompt: `${prompt}   here is user chatHistory : ${JSON.stringify(chatHistory, null, 2)}`,
        maxRetries: 3,
      });

      this.logger.log('Successfully generated text response');
      return text;
    } catch (error) {
      this.logger.error('Error in processMessage:', {
        error: error.message,
        stack: error.stack,
        contactId: contact?.id,
        chatHistoryLength: chatHistory?.length,
      });

      // Return a meaningful error response instead of undefined
      throw new Error(`Failed to process message with Open AI: ${error.message}`);
    }
  }
}
