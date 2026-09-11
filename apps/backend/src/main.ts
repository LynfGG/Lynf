import 'reflect-metadata';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { EnvironmentValidationError, validateEnvironment } from './config/environment';

/**
 * The version lives in the root package.json only — it is what each release tags — so
 * the API documentation reads it from there. `dist/main.js` sits three levels below.
 */
function readVersion() {
    const manifest = JSON.parse(
        readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf8'),
    ) as { version: string };

    return manifest.version;
}

async function bootstrap() {
    // Validated before Nest starts. Failing inside dependency injection would bury the
    // one useful line under a framework stack trace — and a missing Riot key is the
    // first thing anyone hits on a fresh clone.
    const environment = validateEnvironment(process.env);

    const application = await NestFactory.create(AppModule);

    application.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            forbidUnknownValues: true,
        }),
    );

    application.enableCors({ origin: environment.CORS_ORIGIN });
    application.enableShutdownHooks();

    const documentation = new DocumentBuilder()
        .setTitle('Lynf API')
        .setDescription('League of Legends statistics.')
        .setVersion(readVersion())
        .build();

    SwaggerModule.setup(
        'docs',
        application,
        SwaggerModule.createDocument(application, documentation),
    );

    await application.listen(environment.PORT);

    new Logger('Bootstrap').log(
        `Listening on http://localhost:${environment.PORT} — API documentation at /docs`,
    );
}

bootstrap().catch((error: unknown) => {
    if (error instanceof EnvironmentValidationError) {
        process.stderr.write(`\n${error.message}\n\n`);
        process.exit(1);
    }

    process.stderr.write(`\nFailed to start: ${String(error)}\n\n`);
    process.exit(1);
});
