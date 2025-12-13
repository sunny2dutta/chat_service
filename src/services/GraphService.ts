import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { DecisionService, DecisionResult } from "./DecisionService";
import { ChatMessage, ServiceResponse } from "./ChatService";

import logger from '../utils/logger';

// Define the state using Annotation
const GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
        default: () => [],
    }),
    decision: Annotation<DecisionResult | undefined>({
        reducer: (x, y) => y,
        default: () => undefined,
    }),
    finalResponse: Annotation<ServiceResponse | undefined>({
        reducer: (x, y) => y,
        default: () => undefined,
    })
});

export class GraphService {
    private decisionService: DecisionService;
    private app: any;

    constructor(decisionService?: DecisionService) {
        this.decisionService = decisionService || new DecisionService();
        this.app = this.buildGraph();
    }

    private buildGraph() {
        // Define the graph
        const workflow = new StateGraph(GraphState)
            .addNode("agent", this.agentNode.bind(this))
            .addNode("doctor_tool", this.doctorToolNode.bind(this))
            .addNode("lab_tool", this.labToolNode.bind(this))
            .addNode("advice_tool", this.adviceToolNode.bind(this))
            .addEdge(START, "agent")
            .addConditionalEdges(
                "agent",
                (state) => {
                    const action = state.decision?.action;
                    if (action === 'CONSULT_DOCTOR') {
                        return "doctor_tool";
                    } else if (action === 'GET_LAB_TEST') {
                        return "lab_tool";
                    } else if (action === 'PROVIDE_ADVICE') {
                        return "advice_tool";
                    } else {
                        return END;
                    }
                },
                {
                    doctor_tool: "doctor_tool",
                    lab_tool: "lab_tool",
                    advice_tool: "advice_tool",
                    [END]: END
                }
            )
            .addEdge("doctor_tool", END)
            .addEdge("lab_tool", END)
            .addEdge("advice_tool", END);

        return workflow.compile();
    }

    private async agentNode(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
        // Convert BaseMessages back to ChatMessages for the DecisionService
        const chatMessages: ChatMessage[] = state.messages.map(m => ({
            role: m instanceof HumanMessage ? 'user' : 'assistant',
            content: m.content as string
        }));

        const decision = await this.decisionService.evaluateConversation(chatMessages);

        // Log the decision and uncertainty score
        logger.info('Decision made', {
            action: decision.action,
            uncertainty: decision.uncertainty_score,
            reasoning: decision.reasoning
        });

        return { decision };
    }

    private async doctorToolNode(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
        const suggestion = state.decision?.suggestion || "Doctor";
        const reasoning = state.decision?.reasoning ? ` ${state.decision.reasoning}` : "";
        const encodedQuery = encodeURIComponent(suggestion + " near me");
        const googleLink = `https://www.google.com/search?q=${encodedQuery}`;

        const response: ServiceResponse = {
            message: `Based on your symptoms, I strongly recommend consulting a **${suggestion}**.${reasoning}`,
            action: {
                type: 'CONSULT_DOCTOR',
                value: suggestion,
                url: googleLink
            }
        };

        return { finalResponse: response };
    }

    private async labToolNode(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
        const suggestion = state.decision?.suggestion || "Lab Test";
        const reasoning = state.decision?.reasoning ? ` ${state.decision.reasoning}` : "";
        const encodedQuery = encodeURIComponent(suggestion + " near me");
        const googleLink = `https://www.google.com/search?q=${encodedQuery}`;

        const response: ServiceResponse = {
            message: `Based on your symptoms, getting a **${suggestion}** would be very helpful.${reasoning}`,
            action: {
                type: 'GET_LAB_TEST',
                value: suggestion,
                url: googleLink
            }
        };

        return { finalResponse: response };
    }

    private async adviceToolNode(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
        const suggestion = state.decision?.suggestion || "Healthy lifestyle changes";
        const reasoning = state.decision?.reasoning ? ` ${state.decision.reasoning}` : "";

        const response: ServiceResponse = {
            message: `Based on what you've told me, here is some advice: **${suggestion}**.${reasoning}`,
            // No action needed for advice, just the message
        };

        return { finalResponse: response };
    }

    public async run(messages: ChatMessage[]): Promise<ServiceResponse | null> {
        // Convert ChatMessages to BaseMessages
        const baseMessages = messages.map(m =>
            m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
        );

        const result = await this.app.invoke({ messages: baseMessages });

        return result.finalResponse || null;
    }
}
