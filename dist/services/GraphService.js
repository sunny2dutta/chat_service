"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphService = void 0;
const langgraph_1 = require("@langchain/langgraph");
const messages_1 = require("@langchain/core/messages");
const DecisionService_1 = require("./DecisionService");
const logger_1 = __importDefault(require("../utils/logger"));
// Define the state using Annotation
const GraphState = langgraph_1.Annotation.Root({
    messages: (0, langgraph_1.Annotation)({
        reducer: (x, y) => x.concat(y),
        default: () => [],
    }),
    decision: (0, langgraph_1.Annotation)({
        reducer: (x, y) => y,
        default: () => undefined,
    }),
    finalResponse: (0, langgraph_1.Annotation)({
        reducer: (x, y) => y,
        default: () => undefined,
    })
});
class GraphService {
    constructor() {
        this.decisionService = new DecisionService_1.DecisionService();
        this.app = this.buildGraph();
    }
    buildGraph() {
        // Define the graph
        const workflow = new langgraph_1.StateGraph(GraphState)
            .addNode("agent", this.agentNode.bind(this))
            .addNode("doctor_tool", this.doctorToolNode.bind(this))
            .addNode("lab_tool", this.labToolNode.bind(this))
            .addEdge(langgraph_1.START, "agent")
            .addConditionalEdges("agent", (state) => {
            var _a;
            const action = (_a = state.decision) === null || _a === void 0 ? void 0 : _a.action;
            if (action === 'CONSULT_DOCTOR') {
                return "doctor_tool";
            }
            else if (action === 'GET_LAB_TEST') {
                return "lab_tool";
            }
            else {
                return langgraph_1.END;
            }
        }, {
            doctor_tool: "doctor_tool",
            lab_tool: "lab_tool",
            [langgraph_1.END]: langgraph_1.END
        })
            .addEdge("doctor_tool", langgraph_1.END)
            .addEdge("lab_tool", langgraph_1.END);
        return workflow.compile();
    }
    agentNode(state) {
        return __awaiter(this, void 0, void 0, function* () {
            // Convert BaseMessages back to ChatMessages for the DecisionService
            const chatMessages = state.messages.map(m => ({
                role: m instanceof messages_1.HumanMessage ? 'user' : 'assistant',
                content: m.content
            }));
            const decision = yield this.decisionService.evaluateConversation(chatMessages);
            // Log the decision and uncertainty score
            logger_1.default.info('Decision made', {
                action: decision.action,
                uncertainty: decision.uncertainty_score,
                reasoning: decision.reasoning
            });
            return { decision };
        });
    }
    doctorToolNode(state) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const suggestion = ((_a = state.decision) === null || _a === void 0 ? void 0 : _a.suggestion) || "Doctor";
            const reasoning = ((_b = state.decision) === null || _b === void 0 ? void 0 : _b.reasoning) ? ` ${state.decision.reasoning}` : "";
            const encodedQuery = encodeURIComponent(suggestion + " near me");
            const googleLink = `https://www.google.com/search?q=${encodedQuery}`;
            const response = {
                message: `Based on your symptoms, I strongly recommend consulting a **${suggestion}**.${reasoning}`,
                action: {
                    type: 'CONSULT_DOCTOR',
                    value: suggestion,
                    url: googleLink
                }
            };
            return { finalResponse: response };
        });
    }
    labToolNode(state) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const suggestion = ((_a = state.decision) === null || _a === void 0 ? void 0 : _a.suggestion) || "Lab Test";
            const reasoning = ((_b = state.decision) === null || _b === void 0 ? void 0 : _b.reasoning) ? ` ${state.decision.reasoning}` : "";
            const encodedQuery = encodeURIComponent(suggestion + " near me");
            const googleLink = `https://www.google.com/search?q=${encodedQuery}`;
            const response = {
                message: `Based on your symptoms, getting a **${suggestion}** would be very helpful.${reasoning}`,
                action: {
                    type: 'GET_LAB_TEST',
                    value: suggestion,
                    url: googleLink
                }
            };
            return { finalResponse: response };
        });
    }
    run(messages) {
        return __awaiter(this, void 0, void 0, function* () {
            // Convert ChatMessages to BaseMessages
            const baseMessages = messages.map(m => m.role === 'user' ? new messages_1.HumanMessage(m.content) : new messages_1.AIMessage(m.content));
            const result = yield this.app.invoke({ messages: baseMessages });
            return result.finalResponse || null;
        });
    }
}
exports.GraphService = GraphService;
