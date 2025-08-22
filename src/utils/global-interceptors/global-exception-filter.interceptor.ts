import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
//   import { WithSentry } from '@sentry/nestjs'
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  // @WithSentry()
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const message =
      exception instanceof HttpException
        ? Array.isArray((exception.getResponse() as any).message)
          ? (exception.getResponse() as any).message
          : [(exception.getResponse() as any).message]
        : [exception.message.split('\n').pop()];
    const errorResponse = {
      statusCode:
        exception instanceof HttpException
          ? exception.getStatus()
          : exception?.code
            ? HttpStatus.BAD_REQUEST
            : HttpStatus.INTERNAL_SERVER_ERROR,
      error: { message },
    };

    response.status(errorResponse.statusCode).json(errorResponse);
  }
}
