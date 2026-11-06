import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AuditEventPayload {
  service: string;
  action: string;
  user_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  result: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class AuditClientService {
  private readonly logger = new Logger(AuditClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async registerEvent(event: AuditEventPayload): Promise<void> {
    const url = this.configService.get<string>('AUDIT_SERVICE_URL');
    const serviceKey = this.configService.get<string>('AUDIT_SERVICE_KEY');

    if (!url || !serviceKey) {
      this.logger.warn('Audit Service no está configurado.');
      return;
    }

    try {
      const response = await fetch(
        `${url.replace(/\/$/, '')}/api/audit/events`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Key': serviceKey,
          },
          body: JSON.stringify(event),
          signal: AbortSignal.timeout(2000),
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Audit Service respondió HTTP ${response.status}`,
        );
      }
    } catch {
      this.logger.warn(
        'No fue posible registrar el evento en Audit Service.',
      );
    }
  }
}
