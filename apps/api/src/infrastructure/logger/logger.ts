import winston from 'winston';
import { config } from '@/config';

export const logger = winston.createLogger({
  level: config.isDev ? 'debug' : 'info',

  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),

    config.isDev
      ? winston.format.colorize()
      : winston.format.json(),       // JSON in prod for Datadog / Loki / Grafana

    winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
      if (config.isDev) {
        const extras = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp}  [${requestId ?? '---'}]  ${level}: ${message}  ${extras}`;
      }
      return JSON.stringify({ timestamp, level, message, requestId, ...meta });
    }),
  ),

  transports: [
    new winston.transports.Console(),
    // add File or HTTP transport here for production
  ],
});