import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { ApiKeyService } from './api-key.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [ApiKeyService, AuthGuard],
  exports: [ApiKeyService, AuthGuard],
})
export class AuthModule {}
