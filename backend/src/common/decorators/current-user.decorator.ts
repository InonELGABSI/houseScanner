import { createParamDecorator, ExecutionContext } from '@nestjs/common';

type RequestWithUser = {
  user?: Record<string, unknown>;
};

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const { user } = request;
    if (!user) {
      return undefined;
    }
    if (!data) {
      return user;
    }
    const key = data;
    return user[key];
  },
);
