import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/auth.guard';

const START_TIME = Date.now();

@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      version: process.env.npm_package_version ?? '0.1.0',
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
