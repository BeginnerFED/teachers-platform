import { pino } from 'pino'
import { env } from '../env'

/**
 * Structured JSON in production so a log aggregator can read it; human-readable in
 * development. Child loggers carry the request id and caller through a whole request,
 * which is the difference between debugging an incident and guessing at one.
 */
export const logger = pino({
  level: env.LOG_LEVEL,

  // Access tokens must never reach a log file, however the request is shaped.
  redact: {
    paths: ['authorization', 'req.headers.authorization', '*.token', '*.access_token'],
    censor: '[redacted]',
  },

  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
})

export type Logger = typeof logger
