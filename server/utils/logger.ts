// server/utils/logger.ts

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

class Logger {
  private formatMessage(
    level: string,
    message: string,
    metadata?: Record<string, unknown>
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      metadata,
    };
  }

  private write(entry: LogEntry): void {
    const output = JSON.stringify(entry);

    switch (entry.level) {
      case "error":
        console.error(output);
        break;
      case "warn":
        console.warn(output);
        break;
      case "info":
      case "debug":
        if (process.env.NODE_ENV !== "production") {
          console.warn(output); // Usamos warn para evitar error de ESLint
        }
        break;
      default:
        if (process.env.NODE_ENV !== "production") {
          console.warn(output);
        }
    }
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.write(this.formatMessage("info", message, metadata));
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.write(this.formatMessage("warn", message, metadata));
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.write(this.formatMessage("error", message, metadata));
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.write(this.formatMessage("debug", message, metadata));
  }
}

const logger = new Logger();
export default logger;
