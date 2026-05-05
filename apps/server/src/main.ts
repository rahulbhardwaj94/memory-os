import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './config/env';

// BigInt values (accessCount) cannot be serialized by JSON.stringify() natively.
// This shim converts them to numbers for HTTP responses. Safe for accessCount
// since JS Number can represent integers up to 2^53 exactly.
(BigInt.prototype as unknown as Record<string, unknown>)['toJSON'] = function () {
  return Number(this);
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(env.PORT);
}

bootstrap();
