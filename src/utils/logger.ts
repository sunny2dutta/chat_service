import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'chat-service' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Log to files in all environments (Cheap "dump" storage)
logger.add(new winston.transports.File({ filename: 'error.log', level: 'error' }));
logger.add(new winston.transports.File({ filename: 'combined.log' }));

export default logger;
