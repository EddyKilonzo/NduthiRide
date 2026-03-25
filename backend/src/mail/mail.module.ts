import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { MailService } from './mail.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const port = config.getOrThrow<number>('mail.port');
        const secure = config.get<boolean>('mail.secure') ?? false;
        const requireTLS = secure
          ? false
          : (config.get<boolean>('mail.requireTls') ?? true);

        return {
          transport: {
            host: config.getOrThrow<string>('mail.host'),
            port,
            secure,
            requireTLS,
            auth: {
              user: config.getOrThrow<string>('mail.user'),
              pass: config.getOrThrow<string>('mail.pass'),
            },
          },
          defaults: {
            from: `"${config.get<string>('mail.fromName')}" <${config.get<string>('mail.fromAddress')}>`,
          },
          template: {
            // Templates are resolved at runtime relative to the compiled output (dist/)
            // During development with ts-node the __dirname points to src/mail/
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: {},
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
