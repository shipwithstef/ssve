# Claude Legal Skills

Anthropic officially released a major expansion of Claude Legal Skills on May 12, 2026. This release positions Claude as a specialized agent for legal professionals, focusing on methodologies encoded in `SKILL.md` format (YAML playbooks with explicit citations and standard positions).

## Core Capabilities

- **Contract Review (`/review-contract`)**: Evaluates contracts against an organization's playbook (Limitation of Liability, Indemnification, IP Ownership, Data Protection), classifies deviations (GREEN/YELLOW/RED), and generates redlines and negotiation priorities.
- **NDA Triage (`/triage-nda`)**: Rapidly triages incoming NDAs, evaluating standard carveouts, non-solicitation prohibitions, residuals clauses, and term duration.
- **Compliance Checks (`/compliance-check`)**: Reviews proposed business actions against privacy regulations (GDPR, CCPA/CPRA, LGPD), includes a DPA review checklist, and manages Data Subject Request timelines.
- **Legal Briefing (`/brief`, `meeting-briefing`)**: Generates Daily Briefs, Topic Briefs, Incident Briefs, and structured meeting preparations using context from connected sources.
- **Signature Routing (`/signature-request`)**: Verifies legal entity names and routes documents for e-signature.
- **Vendor Checks (`/vendor-check`)**: Scans connected systems to compile a status report on existing vendor agreements (MSA, NDA, DPA, SOW) and upcoming expirations.
- **Automated Response (`/legal-response`)**: Automates replies for common legal inquiries, using Stringent "Escalation Triggers" (like potential criminal liability or media attention) to halt automation.
- **Risk Assessment (`/legal-risk-assessment`)**: Evaluates risks on a 5x5 Severity/Likelihood matrix and outputs a Risk Score mapped to status classifications.

## Connectivity

Features over 20+ MCP connectors bridging to Calendar, Chat (Slack, Teams), Cloud Storage (Box, Egnyte), CLM (Ironclad, Agiloft), CRM (Salesforce), Email, E-signature (DocuSign), and legal specific platforms like Thomson Reuters (Westlaw), Lexis+, and Free Law Project.

## Disclaimers

These skills "assist with legal workflows but do not provide legal advice." AI-generated analysis requires review by licensed attorneys before reliance.
