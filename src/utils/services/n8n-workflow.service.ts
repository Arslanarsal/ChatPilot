import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common'
import axios, { AxiosRequestConfig } from 'axios'
// import * as Sentry from '@sentry/node';

@Injectable()
export class N8nWorkflowService {
  private readonly logger = new Logger(N8nWorkflowService.name)
  constructor() {
    // Initialize Sentry (ensure the DSN is in your .env file)
    // Sentry.init({
    //   dsn: process.env.SENTRY_DSN,
    // });
  }

  async startWorkflow(
    workflowName: string,
    params: Record<string, any>,
  ): Promise<string> {
    const url = `https://ramp-flows.yaneq.com/webhook/${workflowName}`
    const headers = {
      'Content-Type': 'application/json',
    }

    const config: AxiosRequestConfig = {
      headers,
      timeout: 5000,
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }), // Disable SSL verification
    }

    try {
      const response = await axios.post(url, params, config)

      if (response.status !== 200) {
        const errorMessage = `Error when sending message: ${response.status} ${response.data}`
        // Sentry.captureException(new Error(errorMessage));
        this.logger.error(errorMessage)
        return errorMessage
      }

      return response.data
    } catch (error) {
      const errorMessage = `Error when sending message: ${error.message}`
      // Sentry.captureException(error);
      this.logger.error(errorMessage)
      return errorMessage
    }
  }
}
