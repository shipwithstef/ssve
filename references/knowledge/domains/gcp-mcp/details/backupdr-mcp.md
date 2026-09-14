# Area: Backup & Disaster Recovery (`@google-cloud/backupdr-mcp`)

This package exposes Google Cloud's Backup and DR services to AI agents.

## Mechanism
- **Discovery & Vaults:** Agents can locate protectable resources (VMs, Disks, Cloud SQL) using `find_protectable_resources`, and manage backup storage locations using `list_backup_vaults`.
- **Plan Management:** Agents can create or modify `backup_plans` (schedules, retention rules) and link them to resources via `create_backup_plan_association`.
- **Restoration Operations:** Includes tools like `restore_backup` (for Compute instances) and `csql_restore` (for databases), alongside long-running operation polling (`get_backupdr_operation`, `get_csql_operation`).

## Analysis
- **Infrastructure as Conversation:** This allows agents to quickly audit if critical resources are protected by a backup plan, and even initiate a restore procedure during an incident response workflow autonomously.

## L4 Pointers
- `github.com/googleapis/gcloud-mcp/tree/main/packages/backupdr-mcp`