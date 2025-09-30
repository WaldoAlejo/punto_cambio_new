// server/utils/logger.ts
class Logger {
    formatMessage(level, message, metadata) {
        return {
            level,
            message,
            timestamp: new Date().toISOString(),
            metadata,
        };
    }
    write(entry) {
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
    info(message, metadata) {
        this.write(this.formatMessage("info", message, metadata));
    }
    warn(message, metadata) {
        this.write(this.formatMessage("warn", message, metadata));
    }
    error(message, metadata) {
        this.write(this.formatMessage("error", message, metadata));
    }
    debug(message, metadata) {
        this.write(this.formatMessage("debug", message, metadata));
    }
}
const logger = new Logger();
export default logger;
