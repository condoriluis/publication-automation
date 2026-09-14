import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CheckResult {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded';
  checks: { database: CheckResult };
  timestamp: string;
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health(): Promise<HealthResponse> {
    return this.checkAll();
  }

  @Get('ready')
  async ready(): Promise<HealthResponse> {
    const result = await this.checkAll();
    if (result.status !== 'ok') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }

  private async checkAll(): Promise<HealthResponse> {
    const database = await this.checkDatabase();
    const status = database.status === 'up' ? 'ok' : 'degraded';
    return { status, checks: { database }, timestamp: new Date().toISOString() };
  }

  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err) {
      return { status: 'down', latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }
}