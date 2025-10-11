import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export class SwaggerSetup {
  static init(app: INestApplication) {
    const configService = app.get(ConfigService);
    const isProduction = configService.get<string>('NODE_ENV') === 'production';
    if (isProduction) {
      return;
    }

    const globalPrefix = configService.get<string>('app.globalPrefix') ?? 'api';
    const docsPath = `${globalPrefix}/docs`;

    const config = new DocumentBuilder()
      .setTitle('House Scanner API')
      .setDescription('API documentation for the House Scanner platform')
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(docsPath, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }
}
