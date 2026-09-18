import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  // Frontend (Phase 5): plain static HTML/CSS/JS, no build step, served
  // from the same origin as the API — avoids CORS entirely and means
  // there's only one thing to deploy on Railway, not two.
  //
  // process.cwd() rather than __dirname: nest-cli/tsc compiles this file
  // to dist/src/main.js (not dist/main.js — outDir mirrors the src/
  // layout), so __dirname-relative "../public" resolved to dist/public
  // (nonexistent) and silently 404'd every static asset. process.cwd()
  // is stable regardless of that nesting, since npm run start/start:dev
  // always launches from the project root.
  app.useStaticAssets(join(process.cwd(), 'public'));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`HBJ Archive API + web listening on :${port}`);
}
bootstrap();
