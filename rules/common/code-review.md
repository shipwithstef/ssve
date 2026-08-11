---
description: Structured code review — severity taxonomy, mandatory triggers, 80% coverage minimum
scope: project
stack: universal
source: blended:ecc
source_sha: 125d5e619905d97b519a887d5bc7332dcc448a52
---

# Code Review Standards

## Severity Taxonomy

Every review finding must carry a severity label and an action:

| Severity | Action | Meaning |
|---|---|---|
| CRITICAL | BLOCK — must fix before merge | Security vulnerability or data loss risk |
| HIGH | WARN — should fix before merge | Bug or significant quality issue |
| MEDIUM | INFO — consider fixing | Maintainability concern |
| LOW | NOTE — optional | Style or minor suggestion |

**Outcome framework:**
- **Approve**: no CRITICAL or HIGH findings
- **Warning**: only HIGH findings remain (merge with caution)
- **Block**: any CRITICAL finding present

## Mandatory Review Triggers

Always conduct a code review after:
- Writing or modifying code (self-review before declaring done)
- Security-sensitive changes (auth, payments, user data, file system)
- Architectural changes

For security-sensitive code: use `/review-security` skill.  
For pre-merge review: use `/review-gate` skill.  
For implementation correctness audit: use `/audit-implementation` skill.

## Review Checklist

Before marking code complete:
- [ ] Code is readable and well-named
- [ ] Functions are focused (<50 lines)
- [ ] Files are cohesive (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Errors are handled explicitly
- [ ] No hardcoded secrets or credentials
- [ ] No debug/console.log statements in production code
- [ ] Tests exist for new functionality
- [ ] Test coverage ≥ 80%

## Common Issues to Catch

**Security:** hardcoded credentials, SQL injection (string concatenation in queries),
XSS (unescaped user input), path traversal, missing CSRF protection, auth bypasses.

**Code quality:** functions >50 lines (split), files >800 lines (extract modules),
nesting >4 levels (use early returns), missing error handling, mutation patterns,
missing tests.

**Performance:** N+1 queries, missing pagination, unbounded queries, missing caching.
