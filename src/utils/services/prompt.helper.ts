import { Injectable, Logger } from '@nestjs/common';
import { DatesHelper } from './dates.service';
import { Clinic } from '../constant/types';

@Injectable()
export class PromptHelper {
  private readonly logger = new Logger(PromptHelper.name);

  constructor(private readonly datesHelper: DatesHelper) {}

  detect_booking_status_change_prompt(clinic: Clinic): string {
    const prompt = `You are a helpful analyzer of chat messages. Your job is to determine if a meeting has been "booked", "cancelled", or if there is "no_event", by reviewing the chat history.

Instructions:
- Analyze the chat history below.
- Determine the meeting status:
  • "booked"
  • "cancelled"
  • "no_event"
- If booked, extract the date in ISO 8601 format (e.g., 2026-04-02T12:31:32Z).
- You MUST ALWAYS call the tool **update_schedule_event** with the determined status and date.
- You MUST ALSO respond in your message content with the **exact same JSON object** that you use in the tool call. This message must be a valid JSON string (no markdown, no explanation, just plain JSON).
- You must do this even if the chat is vague, empty, or unrelated — ALWAYS call the tool and return JSON.
- Current date: ${new Date().toISOString()}
- upComing dates: ${this.datesHelper.getDateAliases(clinic.timezone || 'America/Sao_Paulo').join(', ')}

Respond using ONLY one of these valid formats:
  
    For booked:
    {
      "status": "booked",
      "date": "2026-04-02T12:31:32Z"
    }
    
    For cancelled:
    {
      "status": "cancelled",
      "date": null
    }
    
    For no event:
    {
      "status": "no_event",
      "date": null
    }
    
`;

    return prompt;
  }
}
