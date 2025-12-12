import { z } from 'zod';

export const ChatRequestSchema = z.object({
    messages: z.array(
        z.object({
            role: z.enum(['user', 'assistant', 'system']),
            content: z.string().min(1, "Message content cannot be empty")
        })
    ).min(1, "Messages array cannot be empty"),
    assessmentContext: z.string().optional().nullable()
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
