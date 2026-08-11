# Deep Dive: Agent Flows (Flow Skills) in Kimi CLI

## Mechanism: Flow State Machines
Agent Flows (or "Flow Skills") in Kimi Code CLI are a specialized extension mechanism that allows users to define complex, multi-turn reasoning tasks as formal state machines. Instead of relying on open-ended LLM loops, these flows constrain the agent to a directed graph.

### 1. Definition and Syntax
Flows are defined as a standard Agent Skill but marked with `type: flow` in the frontmatter of a `SKILL.md` file. The core logic is defined using a native **Mermaid** or **D2** flowchart code block.
- **Nodes (States):** Each node represents a discrete step (e.g., `Research`, `Plan`, `Execute`). The text of the node acts as the prompt or instruction for that specific state.
- **Edges (Transitions):** Connections between nodes define the valid paths an agent can take.

### 2. Execution & The `FlowRunner`
When a flow is triggered (e.g., via `/flow:<name>`):
1.  The `FlowRunner` parses the diagram, identifying the `BEGIN` node.
2.  The agent receives the prompt for the current node.
3.  **Decision Nodes:** If a node has multiple outgoing edges (branches), it becomes a decision point. The agent is instructed to output its selected path using a specific XML tag format: `<choice>{edge_label}</choice>`.
4.  **State Transition:** The `FlowRunner` parses the *last* `<choice>` tag from the assistant's response, validates it against the diagram's allowed edges, and transitions to the next node.
5.  **Error Recovery:** If the agent outputs an invalid or missing choice, the system automatically intercepts the response and prompts the agent to retry with the correct format (looping up to a `max_moves` limit, defaulting to 1000 to prevent infinite loops).

### 3. Mermaid vs. D2 Support
Kimi natively supports both formats, parsing them dynamically:
*   **Mermaid:** Uses standard `flowchart TD` syntax (`A -->|Yes| B`).
*   **D2:** Supported for complex, aesthetically customized diagrams (`A -> B: Yes`).

## Analysis & Use Cases
By implementing Flow Skills, Kimi transitions from a "chat assistant" to a governed process engine. This provides several massive architectural advantages:
- **Predictability & Guardrails:** The agent is forced into a governed process. It cannot randomly execute code before the `Plan` node is explicitly approved.
- **Human-in-the-Loop (HITL):** Specific nodes can be defined as human approval gates. The state machine pauses, waits for user input, and then resumes based on the user's choice.
- **Error Handling (Cyclic Graphs):** Unlike linear chains, Directed Cyclic Graphs (DCGs) allow the flow to loop back. For example, a `Validate` node can loop back to an `Execute` node if tests fail, without needing the user to manually re-prompt the agent.
- **Ralph Mode:** Kimi's native "Ralph Mode" is essentially a hardcoded Agent Flow: a recursive `Execute -> Decide -> Continue/Stop` loop that refines work autonomously.

## L4 Pointers
- Source: Kimi Code CLI documentation and GitHub repository.
- Framework integration points: SVC's "progressive narrowing pipeline" (Research -> Strategy -> Execution) is functionally a macro-level implementation of this exact state machine concept.