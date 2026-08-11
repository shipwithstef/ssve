# manage-finops Eval

## Scenario
The user asks: "What hosting platform should I use for a new nodejs API backend that will scale slowly but needs a free tier to start?"

## Expected Outcomes
1. **Triggering**: The `manage-finops` skill must be triggered.
2. **Analysis**: The skill provides a cost analysis of major PaaS (Railway, Render, Vercel, Netlify) or cloud options that offer free tiers for nodejs.
3. **Recommendation**: Prioritizes the free tier options and suggests when to upgrade based on cost and scaling criteria.
4. **Phase receipt**: Records a `P3-PlatformPricingComparison` phase receipt in the task graph:
   `jq -e '.tasks[] | select(.metadata.skill == "manage-finops" or .skill_receipt.skill == "manage-finops") | .skill_receipt.phases_executed[]? | select(.id == "P3-PlatformPricingComparison")' .svc/lane-tasks-<WI>.json`
