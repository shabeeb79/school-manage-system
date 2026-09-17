import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import compression from 'compression';
import { AppModule } from './app.module';

function corsOrigins(): boolean | string[] | ((origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void) {
  const fromEnv = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const defaults = [
    'https://school-manage-system.contactzylust.workers.dev',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  const allowed = new Set([...defaults, ...fromEnv]);

  return (origin, callback) => {
    // Non-browser / same-origin tools (curl, server-to-server) send no Origin.
    if (!origin || allowed.has(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(compression());
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    maxAge: '7d',
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    },
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const port = Number(process.env.PORT) || 3000;
  // Render (and most hosts) require binding on all interfaces, not localhost.
  await app.listen(port, '0.0.0.0');
  console.log(`API running on http://0.0.0.0:${port}/api`);
}

bootstrap().catch((err) => {
  console.error('Failed to start API', err);
  process.exit(1);
});
