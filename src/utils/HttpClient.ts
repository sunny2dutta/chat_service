import logger from './logger';

interface RequestOptions extends RequestInit {
    retries?: number;
    backoff?: number;
    timeout?: number;
}

export class HttpClient {
    static async request(url: string, options: RequestOptions = {}): Promise<Response> {
        const { retries = 3, backoff = 1000, timeout = 10000, ...fetchOptions } = options;

        for (let i = 0; i <= retries; i++) {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(url, {
                    ...fetchOptions,
                    signal: controller.signal
                });

                clearTimeout(id);

                if (response.ok) {
                    return response;
                }

                // Don't retry on 4xx errors (except 429)
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    throw new Error(`HTTP Error: ${response.status}`);
                }

                throw new Error(`HTTP Error: ${response.status}`);

            } catch (error: any) {
                clearTimeout(id);

                const isLastAttempt = i === retries;
                if (isLastAttempt) {
                    logger.error(`Request failed after ${retries + 1} attempts: ${error.message}`);
                    throw error;
                }

                const delay = backoff * Math.pow(2, i);
                logger.warn(`Request failed (attempt ${i + 1}/${retries + 1}). Retrying in ${delay}ms... Error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw new Error('Unreachable code');
    }

    static async post(url: string, body: any, headers: Record<string, string> = {}, options: RequestOptions = {}): Promise<Response> {
        return this.request(url, {
            ...options,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: JSON.stringify(body)
        });
    }
}
