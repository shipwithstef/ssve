# Kimi Agent Swarms

Agent Swarm is the high-performance orchestration technology introduced with Kimi K2.5 and expanded in K2.6. It represents Moonshot AI's solution for tasks that are too massive for a single linear agent session.

## 1. Concept: Decomposed Intelligence
Instead of one agent working slowly on a complex task, the **Swarm** decomposes the objective into parallelizable sub-tasks.
- **Orchestrator**: A high-reasoning model (K2.6 Thinking) that analyzes the prompt and spawns sub-agents.
- **Workers**: Specialized sub-agents (up to 300) that execute specific legs of the task in parallel.
- **Synthesizer**: Collects the outputs from the swarm and merges them into a final result.

## 2. Capabilities & Scale
- **Parallel Complexity**: Supports up to **300 parallel agents** executing up to **4,000 coordinated steps**.
- **Coherence**: Uses a shared "State Memory" so that agents in different branches of the swarm don't repeat work or hallucinate conflicting data.
- **Speed**: Tasks that would take a single agent 2 hours (e.g., searching 100 competitors) can be completed by a swarm in less than 10 minutes.

## 3. Key Use Cases

### Technical Audits
- **Whole-Repo Audits**: A swarm can simultaneously audit every file in a 100k+ LoC repository for security vulnerabilities, style drift, and performance bottlenecks.
- **Infrastructure Provisioning**: Coordinating the setup of multi-region cloud resources where each agent handles a different VPC or service layer.

### Massive Content/Data Operations
- **Bulk Media Processing**: Analyzing and tagging thousands of images or videos for specific visual attributes.
- **Legal/Compliance Reviews**: Reviewing a massive batch of contracts against a single policy checklist, with each agent handling 10-20 documents.

## 4. Integration with CLI & Web
- **Discovery**: In the **Kimi Web UI**, swarms are triggered for "Research" or "Large Workspace" tasks automatically.
- **Control**: In the **Kimi CLI**, the `/task` and `/background` systems are the entry points for launching and monitoring swarm-like background workloads locally.
