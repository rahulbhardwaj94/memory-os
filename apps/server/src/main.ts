import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { env } from './config/env';

// BigInt values (accessCount) cannot be serialized by JSON.stringify() natively.
// This shim converts them to numbers for HTTP responses. Safe for accessCount
// since JS Number can represent integers up to 2^53 exactly.
(BigInt.prototype as unknown as Record<string, unknown>)['toJSON'] = function () {
  return Number(this);
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: env.NODE_ENV === 'production' ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const logger = new Logger('Bootstrap');

  app.enableCors({
    origin: env.NODE_ENV === 'production' ? env.CORS_ORIGIN : true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('memory-os API')
    .setDescription(
      'REST API for the memory-os MCP memory server. ' +
        'Primary interface is MCP (stdio); REST is used by the Web UI and direct integrations.',
    )
    .setVersion('0.1.0')
    .addTag('memories', 'Memory vault operations')
    .addTag('health', 'Health and readiness checks')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'memory-os API docs',
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(env.PORT);
  logger.log(`HTTP server running on http://localhost:${env.PORT}`);
  logger.log(`Swagger docs available at http://localhost:${env.PORT}/api/docs`);
}

bootstrap();
