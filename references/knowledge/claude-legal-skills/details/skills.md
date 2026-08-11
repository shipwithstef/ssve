# Claude Legal Skills - Skill Definitions

## 1. Mechanism

The repository provides 9 core skill definitions designed for the Claude and Cowork platforms, utilizing `.md` and `.yaml` formats to encode legal playbooks, logic, and escalation triggers.

- **`review-contract`**: Assesses contracts clause-by-clause against the organization's playbook. Includes standard rules for mapping clauses (Limitation of Liability, Indemnification, IP, Data Protection) and generating redlines.
- **`triage-nda`**: Uses automated evaluation criteria (standard carveouts, non-solicitation, residuals, term duration) to output classification statuses: GREEN (standard approval), YELLOW (counsel review), RED (significant issues).
- **`brief` / `meeting-briefing`**: Creates Topic Briefs, Incident Briefs, and Deal/Board Meeting pre-reads by synthesizing data from context plugins.
- **`compliance-check`**: Scans proposed initiatives against privacy frameworks (GDPR, CCPA/CPRA, LGPD), handles Data Subject Request timelines, and integrates DPA checklists.
- **`vendor-check`**: Connects via MCP to CLM, CRM, and communication platforms to compile vendor risk reports and highlight agreement expiration/coverage.
- **`signature-request`**: Pre-signature checklist verification (entity names, exhibits) combined with e-signature routing API commands.
- **`legal-response`**: Evaluates inquiries and drafts automated responses. If escalation triggers (potential criminal liability, media attention) fire, it aborts the generation process.
- **`legal-risk-assessment`**: Uses a 5x5 framework mapping Severity against Likelihood, outputting a 1-25 Risk Score.

## 2. Analysis

The shift to "Methodology-as-Code" via the `SKILL.md` format represents a significant departure from standard prompting. Rather than general legal assistance, these tools act as narrow expert agents. The inclusion of hard "Escalation Triggers" (halting on high risk) indicates a design specifically structured around corporate risk calibration, making it suitable for in-house teams.

## 3. L4 Pointers
- `legal-response` triggers
- `triage-nda` status criteria
- `legal-risk-assessment` 5x5 framework