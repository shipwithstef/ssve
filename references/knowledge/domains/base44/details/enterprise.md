# Base44 Enterprise

## Mechanism

### Enterprise Features

**Base44 for enterprises - Base44 Support Documentation Navigation Enterprise Base44 for enterprises Documentation Develop**

- Easily streamline member authentication with single sign-on (SSO), and set clear policies across all your workspace apps.
- With straightforward billing and powerful management tools, you stay in control as your team grows.
- Learn more about Base44 enterprise solutions.
- ​ Accessing Base44 enterprise solutions To use Base44 for your enterprise, your organization must request access and receive approval.
- Complete the form below to start the process.

**Managing SSO and visibility for your enterprise apps - Base44 Support Documentation Managing SSO for app access Managing**

- Using SSO for app access means everyone signs into every app with the same company credentials, streamlining security and access.
- With app visibility controls, you decide how new apps are shared, making it easy to maintain privacy and regulatory standards across your organization.
- ​ Managing SSO for app access Enterprise admins can enforce SSO across all apps in a workspace through a single provider.
- This makes it effortless for people to sign in to multiple apps and ensures your security standards are applied everywhere.
- For example, if your company has 10 different apps in a Base44 workspace, enabling SSO for app access means all users log in with their central company credentials, instead of creating new logins for each app.

**Setting up SSO for your enterprise workspace - Base44 Support Documentation SSO for workspaces Setting up SSO FAQs ​ SSO**

- When you enable SSO, your team can sign in using your organization’s identity provider (such as Google or Azure), which streamlines onboarding and reduces security risks from weak or reused passwords.
- When SSO is enabled, anyone with the configured email domain can log in only through SSO.
- After they log in, they are automatically added to the workspace as members with the Viewer role.
- ​ Setting up SSO Connect your workspace to your identity provider by enabling SSO in your workspace settings and following the configuration steps for your provider.
- Before you begin: Find your workspace ID.

### Workspace Security

**Setting up your enterprise workspace domain - Base44 Support Documentation Setting up your workspace domain Verifying yo**

- It also enables domain-based access rules, so you can control who can join your workspace based on their email domain.
- Your workspace domain is verified using a DNS TXT record.
- Once verified, Base44 uses it to enforce access policies and streamline onboarding for your team.
- Only workspace owners and admins can configure the workspace domain.
- ​ Setting up your workspace domain Enter your organization’s domain in your workspace settings to get started.

**Managing workspace secrets - Base44 Support Documentation Creating an API key Managing your API keys Workspace secrets l**

- Use these keys to stream audit logs or pull workspace data into an external system via the Monitoring API.
- Keys are workspace-owned, so they stay active even if the member who created them leaves the workspace.
- Important: Workspace secrets are available on Enterprise plans only.
- Only workspace owners and admins can view and manage secrets.
- For a full list of supported APIs, see the API reference .

**Adding an IP allowlist for your workspace - Base44 Support Documentation Setting up an IP allowlist FAQs IP allowlist le**

- This is useful if your team connects from a known office network or VPN and you want to block access from other locations.
- Requests from IP addresses that are not in the allowlist receive a 403 Forbidden response.
- When IP allowlist is enabled, all apps in the workspace are protected by the allowlist.
- Important: IP allowlist is only available for enterprise workspaces.
- Only workspace owners and admins can view or change IP allowlist settings.

## Analysis

**Pricing & Plans:**
- Enterprise Base44 for enterprises Documentation Developers Getting started Building an app Migrating a project
- Enterprise Base44 enterprise solutions Workspace domain SSO for your workspace SSO and visibility for apps Wor
- enterprise solutions Enterprise solutions features Scalable workspace Workspace domain SSO for workspace acces
- enterprise solutions are built for teams that need secure, scalable workspace management and robust access con
- enterprise solutions
- enterprise solutions To use Base44 for your enterprise, your organization must request access and receive appr
- enterprise workspace
- enterprise solutions? Get in touch with our sales team ​ Enterprise solutions features Base44 enterprise solut

**Limits & Constraints:**
- up to 10 API keys per workspace

**Important Notes:**
- remember separate logins for each app, reducing password fatigue and the risk of unauthorized access
- Important: Only enterprise admins can manage SSO for app access
- Important: When following the guide, replace the redirect URI https://app
- Note that APP_ID is replaced by WORKSPACE_ID , and the path /apps/ is changed to /workspaces/
- Important: Workspace secrets are available on Enterprise plans only
- Important: Copy your key immediately after creating it

## L4 Pointers

From https://docs.base44.com/Enterprise/Base44-for-enterprises:
> "Easily streamline member authentication with single sign-on (SSO), and set clear policies across all your workspace apps."
> "With straightforward billing and powerful management tools, you stay in control as your team grows."
> "Learn more about Base44 enterprise solutions."

From https://docs.base44.com/Enterprise/Enterprise-SSO-and-app-visibility:
> "Using SSO for app access means everyone signs into every app with the same company credentials, streamlining security and access."
> "With app visibility controls, you decide how new apps are shared, making it easy to maintain privacy and regulatory standards across your organization."
> "​ Managing SSO for app access Enterprise admins can enforce SSO across all apps in a workspace through a single provider."

From https://docs.base44.com/Enterprise/SSO-for-enterprise-workspace:
> "When you enable SSO, your team can sign in using your organization’s identity provider (such as Google or Azure), which streamlines onboarding and reduces security risks from weak or reused passwords."
> "When SSO is enabled, anyone with the configured email domain can log in only through SSO."
> "After they log in, they are automatically added to the workspace as members with the Viewer role."

From https://docs.base44.com/Enterprise/Enterprise-workspace-domain:
> "It also enables domain-based access rules, so you can control who can join your workspace based on their email domain."
> "Your workspace domain is verified using a DNS TXT record."
> "Once verified, Base44 uses it to enforce access policies and streamline onboarding for your team."

From https://docs.base44.com/Enterprise/workspace-secrets:
> "Use these keys to stream audit logs or pull workspace data into an external system via the Monitoring API."
> "Keys are workspace-owned, so they stay active even if the member who created them leaves the workspace."
> "Important: Workspace secrets are available on Enterprise plans only."

From https://docs.base44.com/documentation/enterprise/ip-allowlist:
> "This is useful if your team connects from a known office network or VPN and you want to block access from other locations."
> "Requests from IP addresses that are not in the allowlist receive a 403 Forbidden response."
> "When IP allowlist is enabled, all apps in the workspace are protected by the allowlist."

