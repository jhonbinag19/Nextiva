const winston = require('winston');

const safeStringify = (value) => {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (key, val) => {
      if (val instanceof Error) {
        return { message: val.message, stack: val.stack };
      }
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    },
    2
  );
};

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'nextiva-api' },
  transports: [
    // Write logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ level, message, timestamp, ...meta }) => {
            return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? safeStringify(meta) : ''}`;
          }
        )
      )
    })
  ]
});

// Note: File transports are removed for serverless environments like Vercel
// In a serverless environment, use a logging service instead
// For example, you could integrate with Vercel's built-in logging
// or a third-party service like Logtail, Papertrail, etc.

module.exports = logger;
