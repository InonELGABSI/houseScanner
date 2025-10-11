import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe<TInput>
  implements PipeTransform<unknown, TInput>
{
  constructor(private readonly schema: ZodSchema<TInput>) {}

  transform(value: unknown): TInput {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }

    throw new BadRequestException({
      message: result.error.issues.map(
        (issue) => `${issue.path.join('.')} ${issue.message}`,
      ),
      error: 'ValidationError',
    });
  }
}
