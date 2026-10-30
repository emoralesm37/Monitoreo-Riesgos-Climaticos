import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    const timestamp = new Date().toISOString();

    try {
      await this.dataSource.query('SELECT 1');

      return {
        status: 'healthy',
        service: 'auth-service',
        database: 'up',
        timestamp,
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'unhealthy',
        service: 'auth-service',
        database: 'down',
        timestamp,
      });
    }
  }
}