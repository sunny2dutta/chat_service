import { UncertaintyService } from '../UncertaintyService';
import { HttpClient } from '../../utils/HttpClient';
import { ChatMessage } from '../ChatService';

jest.mock('../../utils/HttpClient');

describe('UncertaintyService', () => {
    let service: UncertaintyService;

    beforeEach(() => {
        service = new UncertaintyService();
        jest.clearAllMocks();
    });

    it('should return a valid uncertainty score', async () => {
        const mockResponse = {
            ok: true,
            json: jest.fn().mockResolvedValue({
                choices: [{
                    message: {
                        content: "The uncertainty score is 25"
                    }
                }]
            })
        };

        (HttpClient.post as jest.Mock).mockResolvedValue(mockResponse);

        const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];
        const score = await service.calculateUncertainty(messages);

        expect(score).toBe(25);
        expect(HttpClient.post).toHaveBeenCalledTimes(1);
    });

    it('should handle <think> tags and return score', async () => {
        const mockResponse = {
            ok: true,
            json: jest.fn().mockResolvedValue({
                choices: [{
                    message: {
                        content: "<think>Some thinking...</think> 42"
                    }
                }]
            })
        };

        (HttpClient.post as jest.Mock).mockResolvedValue(mockResponse);

        const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];
        const score = await service.calculateUncertainty(messages);

        expect(score).toBe(42);
    });

    it('should return 100 on API error', async () => {
        (HttpClient.post as jest.Mock).mockRejectedValue(new Error('API Error'));

        const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];
        const score = await service.calculateUncertainty(messages);

        expect(score).toBe(100);
    });
});
