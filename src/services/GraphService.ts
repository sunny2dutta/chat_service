import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { DecisionService, DecisionResult } from "./DecisionService";
import { ChatMessage } from "./ChatService";

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
    finalResponse: Annotation<string | undefined>({
        reducer: (x, y) => y,
        default: () => undefined,
    })
});

export class GraphService {
    private decisionService: DecisionService;
    private app: any;

    constructor() {
        this.decisionService = new DecisionService();
        this.app = this.buildGraph();
    }

    private buildGraph() {
        // Define the graph
        const workflow = new StateGraph(GraphState)
            .addNode("agent", this.agentNode.bind(this))
            .addNode("doctor_tool", this.doctorToolNode.bind(this))
            .addNode("lab_tool", this.labToolNode.bind(this))
            .addEdge(START, "agent")
            .addConditionalEdges(
                "agent",
                (state) => {
                    const action = state.decision?.action;
                    if (action === 'CONSULT_DOCTOR') {
                        return "doctor_tool";
                    } else if (action === 'GET_LAB_TEST') {
                        return "lab_tool";
                    } else {
                        return END;
                    }
                },
                {
                    doctor_tool: "doctor_tool",
                    lab_tool: "lab_tool",
                    [END]: END
                }
            )
            .addEdge("doctor_tool", END)
            .addEdge("lab_tool", END);

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
        console.log(`[Decision] Action: ${decision.action}, Uncertainty: ${decision.uncertainty_score}/100, Reasoning: ${decision.reasoning}`);

        return { decision };
    }

    private async doctorToolNode(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
        const suggestion = state.decision?.suggestion || "Doctor";
        const encodedQuery = encodeURIComponent(suggestion);
        const lmgtfyLink = `https://lmgtfy.app/?q=${encodedQuery}`;

        const response = `Based on your symptoms, I strongly recommend consulting a ${suggestion}. \n\nHere is a link to help you find one: ${lmgtfyLink}`;

        return { finalResponse: response };
    }

    private async labToolNode(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
        const suggestion = state.decision?.suggestion || "Lab Test";
        const encodedQuery = encodeURIComponent(suggestion);
        const lmgtfyLink = `https://lmgtfy.app/?q=${encodedQuery}`;

        const response = `Based on your symptoms, getting a ${suggestion} would be very helpful. \n\nHere is a link to find this test: ${lmgtfyLink}`;

        return { finalResponse: response };
    }

    public async run(messages: ChatMessage[]): Promise<string | null> {
        // Convert ChatMessages to BaseMessages
        const baseMessages = messages.map(m =>
            m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
        );

        const result = await this.app.invoke({ messages: baseMessages });

        return result.finalResponse || null;
    }
}
