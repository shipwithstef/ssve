## Common Scenarios

### Scenario 1: Solo Developer MVP Launch
**Recommendation**: Start with free tiers, use Railway/Render for hosting
- Use free tier databases (Supabase, PlanetScale)
- Deploy to Railway or Render (free tier available)
- Use GitHub Actions for CI/CD (free)
- Estimated cost: $0-20/month

### Scenario 2: Mobile App with Expo
**Recommendation**: Start with Expo Free plan, upgrade as needed
- Free plan: 30 builds/month
- Starter plan: $19/month for priority builds
- Use GitHub Actions for free CI/CD alternative
- Estimated cost: $0-19/month initially

### Scenario 3: High-Traffic SaaS Application
**Recommendation**: Use Hetzner or AWS with reserved instances
- Hetzner: Best price/performance for VPS
- AWS: Use reserved instances for predictable workloads
- Consider CDN (Cloudflare free tier)
- Estimated cost: $50-200/month

### Scenario 4: ML/AI Application
**Recommendation**: Use DeepBlue or AWS for GPU instances
- DeepBlue: Competitive GPU pricing
- AWS: Spot instances for cost savings
- Consider serverless for inference
- Estimated cost: $100-500/month


## Cost Optimization Principles

1. **Start with Free Tiers** - Maximize free tier usage before paying
2. **Right-Size Resources** - Match resources to actual needs
3. **Use Reserved Instances** - Commit for predictable workloads
4. **Schedule Resources** - Turn off non-production environments
5. **Monitor Continuously** - Track usage and costs regularly
6. **Automate Optimization** - Use scripts to manage resources
7. **Choose Appropriate Tier** - Don't over-provision resources


## Domain & Email Setup Examples

### Example 1: Free Domain Privacy + Email Forwarding (Namecheap)

**Setup**: sentinelvibe.com registered on Namecheap

**Cost**: **$0/year** (completely free)

**Steps**:
1. Log into Namecheap account → "Domain List"
2. Click "Manage" next to sentinelvibe.com
3. Find "Email Forwarding" tab
4. Click "Add Email Forwarding"
5. Configure:
   - **From**: `support` (creates contact-c1cba5bbb9@example.invalid)
   - **To**: Your personal email (e.g., gmail@example.com)
6. Click "Add Forwarding"
7. Enable "Domain Privacy" service (also **free** on Namecheap)

**Result**:
- ✅ Professional email: `contact-c1cba5bbb9@example.invalid`
- ✅ Private WHOIS (personal phone/address hidden)
- ✅ Emails forward to personal inbox
- ✅ Can reply as contact-c1cba5bbb9@example.invalid via Gmail "Send As"
- ✅ Zero cost

**Key Points**:
- Namecheap includes Domain Privacy **free** on most plans
- Email forwarding limited to **100 forwards** (per domain)
- Perfect for tech support, sales, contact emails
- More professional than personal email for business domain

**When to Scale**:
- Need actual mailbox interface? → Upgrade to Zoho Mail ($2/user/month) or similar
- Multiple team members? → Use forwarding for cost-efficiency
- Want email storage? → Consider professional email service

**ROI**:
- Cost: $0/year
- Benefit: Professional customer contact email
- Impression: ⭐⭐⭐⭐ (Professional for startups)

**Step-by-Step Setup Instructions**:

1. **Log Into Namecheap**:
   - Go to https://www.namecheap.com
   - Click "Sign In"
   - Enter email and password
   - You should see your dashboard

2. **Navigate to Domain Management**:
   - Click "Domain List" (left sidebar or top menu)
   - Find your domain (e.g., sentinelvibe.com)
   - Click "Manage" button next to the domain

3. **Access Email Forwarding**:
   - Look for tabs at the top of domain management panel
   - Find and click "Email Forwarding" tab
   - You'll see "Email Redirect" action
   - Click "Email Redirect" button

4. **Review Forwarding Settings** (Important):
   - Namecheap will show message about DNS nameservers
   - Message says: "You need to use Namecheap BasicDNS nameservers"
   - This is OK if you're already using Namecheap DNS (you are!)
   - Check both checkboxes:
     - ☑️ "I understand that setting up Email Forwarding will affect my existing services..."
     - ☑️ "I want to be notified by email that the emails forwarders have been properly set up."
   - Click "Continue" or "Next"

5. **Fill in Email Forwarder Form**:
   - You'll see form:
     ```
     Forwarder:  [            ] @ [your-domain.com]
     Destination Email: [contact-c786214eff@example.invalid]
     ```
   - **Forwarder field**: Type the email prefix (e.g., `support`)
   - **Domain**: Automatically set to your domain (e.g., sentinelvibe.com)
   - **Destination Email**: Already filled in your personal email
   - **Note**: The `@example.com` shown is just a placeholder - your actual domain will be used

6. **Save the Forwarder**:
   - Click "Save Changes" button (red button)
   - You should see confirmation: `contact-c1cba5bbb9@example.invalid → angelovsan@gmail.com ✅ Active`
   - Namecheap sends confirmation email to your personal address

7. **Test Email Forwarding (Recommended)**:
   - Send test email to contact-c1cba5bbb9@example.invalid from another email account
   - Wait 5-10 minutes
   - Check your personal email inbox
   - If test email arrives → ✅ Forwarding is working

8. **Verify Domain Privacy**:
   - While in domain management panel
   - Look for "Domain Privacy" section or tab
   - Verify it shows "Enabled" or "Protected" ✅
   - If not enabled, click to enable (should be FREE)

**Common Issues & Fixes**:
- **Can't find Email Forwarding tab**: Make sure you clicked "Manage" on domain. Look for "Email Forwarding" or "Email" in tabs.
- **Form won't save**: Check email is valid, prefix is filled in. Try refreshing page.
- **Emails not arriving**: Wait 10-15 minutes (DNS propagation). Check spam folder. Send another test.
- **@example.com showing**: This is just placeholder text showing format. Your actual domain will be used automatically.

**Result**:
- ✅ contact-c1cba5bbb9@example.invalid forwards to your personal email (angelovsan@gmail.com)
- ✅ All support emails arrive in your personal inbox
- ✅ You can reply from Gmail using "Send As" feature (optional)
- ✅ Domain Privacy protects personal info in WHOIS
- ✅ Zero additional cost

