import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Supabase transaction pooler (port 6543 / PgBouncer) does not support
 * prepared statements. Without `pgbouncer=true`, login fails with:
 * prepared statement "s0" already exists (42P05).
 */
function prismaDatabaseUrl(raw = process.env.DATABASE_URL) {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('pgbouncer')) {
      url.searchParams.set('pgbouncer', 'true');
    }
    // Allow a small pool so JWT + handler queries are not fully serialized.
    // Keep modest under Supabase transaction pooler.
    if (!url.searchParams.has('connection_limit')) {
      const limit = process.env.PRISMA_CONNECTION_LIMIT || '8';
      url.searchParams.set('connection_limit', limit);
    }
    return url.toString();
  } catch {
    return raw;
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: { url: prismaDatabaseUrl() },
      },
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connected');
    } catch (err) {
      this.logger.error('Database connection failed at startup', err as Error);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
