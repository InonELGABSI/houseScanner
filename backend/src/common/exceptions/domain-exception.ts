import { HttpException, HttpStatus } from '@nestjs/common';

export class DomainException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(
      {
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }
}
