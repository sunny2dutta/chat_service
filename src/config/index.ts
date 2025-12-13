import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const configSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('3001').transform(Number),
    FIREWORKS_API_KEY: z.string().min(1, "Fireworks API Key is required"),
    FIREWORKS_MODEL: z.string().default('accounts/fireworks/models/qwen3-30b-a3b'),
    FIREWORKS_API_URL: z.string().url().default('https://api.fireworks.ai/inference/v1/chat/completions'),
    ADMIN_KEY: z.string().default('admin123'),
});

const parsedConfig = configSchema.safeParse(process.env);

if (!parsedConfig.success) {
    console.error('❌ Invalid environment variables:', JSON.stringify(parsedConfig.error.format(), null, 4));
    process.exit(1);
}

export const config = parsedConfig.data;
