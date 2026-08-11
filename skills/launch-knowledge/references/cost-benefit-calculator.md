# Cost-Benefit Calculators (parameterized, not personalized)

Every recommendation that involves money or time goes through one of these four calculators. Inputs come from the per-builder profile (`~/.svc/founder-profile.md`) and the project capability registry (`.svc/capability-registry.json`). When inputs are missing, surface the parameterized formula and ask the user for the missing input — do NOT silently assume.

## Calculator 1: Self-employment registration net cost (jurisdiction-aware)

**Question:** Should the founder register as self-employed (свободна професия / Einzelunternehmer / sole trader / etc.) or stay personal-name-only?

**Inputs:**
- `J` = jurisdiction (BG, EE, US, UK, DE, NL, IE, ...)
- `E` = current employment status (employed / unemployed / dual)
- `Y_E` = current annual employed income (in local currency)
- `Cap_J` = max insurable income cap for jurisdiction J (e.g., BG 2026: ~4,130 BGN/month → ~49,560 BGN/year, see `references/knowledge/launch/jurisdictions/bg.md`)
- `R_self` = projected annual self-employed revenue

**Formula (BG-specific shape, generalizes):**
- If `E == employed` AND `Y_E >= Cap_J`: net new SS cost ≈ **€0** (cap already saturated by primary employment).
- If `E == employed` AND `Y_E < Cap_J`: net new SS cost ≈ fixed annual contribution at min insurable income (BG ~€1,600/year). Health + pension on the delta to cap.
- If `E == unemployed`: full self-employment SS cost on declared income up to cap.
- VAT trigger: at `R_self >= VAT_threshold_J` (BG: 100,000 BGN/year), VAT registration is mandatory.

**Output line in `launch-vehicle-decision.md`:**
> "Net cost of registering: ~€{X}/year given employment status. Breakeven at ~{Y} BGN annual revenue. See [bg.md](../references/knowledge/launch/jurisdictions/bg.md)."

## Calculator 2: Credit program expected value

**Question:** Is it worth the founder's time to apply to a given credit program?

**Inputs:**
- `V` = nominal credit value ($150K MS Founders Hub; $100K AWS Activate via NVIDIA Inception; etc.)
- `P` = approval probability for THIS founder profile (bootstrapped EU founder for VC-gated programs is ~0%; for Microsoft Founders Hub it's ~70%+)
- `T` = founder hours required to apply (15 min for self-serve; 4 hours for VC-referral programs)
- `H_rate` = founder's effective hourly rate (proxied by next-best-use; default $50/hr for solo bootstrapped)
- `U` = realistic utilization fraction of the credit (Azure $150K is unusable if you don't run on Azure; budget U=0.2 unless platform is already chosen)

**Formula:**
- Expected value = `V * P * U`
- Cost to apply = `T * H_rate`
- ROI = `(V * P * U) / (T * H_rate)`

**Decision rule:** apply if ROI > 50× (50× = "would do this even if half the assumptions are wrong").

**Output line in `credit-stack-plan.md`:**
> "Microsoft Founders Hub — V=$150K, P=0.7, U=0.3 → EV=$31,500. Effort=15min. ROI ≈ 2,520×. **Apply this week.**"

## Calculator 3: Platform migration breakeven

**Question:** Should the founder migrate from current platform (e.g., Base44) to a different stack to consume free credits?

**Inputs:**
- `M_current` = current platform monthly cost (USD)
- `M_target` = target platform monthly cost AFTER credits applied
- `C_credits` = total free credits available on target platform (e.g., MS Founders Hub $150K Azure)
- `D` = monthly burn rate of credits on target ($/month)
- `T_migrate` = engineering weeks required to migrate
- `T_runway` = runway extended by credits = `C_credits / D` months

**Formula:**
- Net monthly savings = `M_current - M_target`
- Migration cost ≈ `T_migrate * 40 * H_rate` (lost product velocity)
- Breakeven months = `migration_cost / (net_monthly_savings + amortized_credit_burn)`

**Decision rule from `proposals/2026-04-26-launch-knowledge-skill.md` and `example-marketplace/docs/analysis/platform-migration-evaluation.md`:** **don't migrate without first $100 MRR** OR a Base44-specific blocker that demonstrably loses a paying customer. Migration today saves zero customers and burns 2+ weeks against the build-no-launch trap.

**Output line in `runway-projection.md`:**
> "Migrating from Base44 → Supabase saves $0/month at current scale (both platforms are free below 100 MAU). Migration effort: 9–13 working days reusing covibefusion patterns. **Do not migrate until first $100 MRR.**"

## Calculator 4: Incorporation breakeven

**Question:** When should the founder incorporate (vs. stay sole trader / personal-name)?

**Inputs:**
- `R` = projected annual revenue
- `C_incorp` = annual cost of incorporation in jurisdiction J (BG OOD: ~€500/yr accounting; US Delaware LLC via Stripe Atlas: ~€500/yr first year + €350/yr franchise tax)
- `L_personal` = personal liability exposure (qualitative: low for digital products with TOS; high for medical/financial)
- `T_admin` = annual admin hours (BG OOD: ~10 hrs; US Delaware C-Corp: ~30 hrs)
- `Tax_diff` = tax-rate difference between personal and corporate income in jurisdiction J

**Decision rule:**
- If `R < €5K`: stay sole trader / personal name. Incorporation cost > revenue.
- If `R >= €5K AND L_personal == low`: stay sole trader unless raising capital or adding co-founder.
- If `R >= €30K OR L_personal == high OR raising_capital == true`: incorporate.

**Output line in `launch-vehicle-decision.md`:**
> "Stay свободна професия until first €5K MRR. Revisit at €30K MRR or when first co-founder joins. Incorporation cost in BG: ~€500/yr accounting + €30/yr filings."

**BG-specific override (added 2026-05-03):** if profile signals employer IP-clause concern, the breakeven flips — incorporate spouse-owned EOOD immediately (Layer 1 €153 one-time, dormant Layer 2 = €0/mo) rather than defer. The decision becomes risk-driven, not revenue-driven. The €500/yr accounting figure is Layer 2 (activity-triggered) — pre-launch dormant EOOD has zero recurring cost beyond annual zero-activity ГДД filing. See `references/knowledge/launch/jurisdictions/bg.md` § "Cost to incorporate EOOD — corrected framing".

## Calculator 5: BG КЕП cost (added 2026-05-03)

**Question:** What's the minimum-friction КЕП setup cost for a BG founder (precondition for any TR/NAP/чл.97а filing)?

**Inputs:**
- `vehicles_active` = who needs their own КЕП (builder-only, spouse-only, both)
- `professional_required` = does ANY vehicle need Professional КЕП (yes if EOOD, ET, or свободна професия)

**Decision rule (default Cloud unless explicitly overridden):**
- 1× Personal Cloud КЕП = **6.00 лв / 3.07 €/year** (15 лв / 7.67 €/3-year)
- 1× Professional Cloud КЕП = **50.40 лв / 25.77 €/year** (132.30 лв / 67.64 €/3-year)
- Choose Cloud over Hardware (saves ~75% on personal, ~30% on professional, eliminates hardware procurement, mobile-app onboarding)

**Output line in `launch-vehicle-decision.md`:**
> "Layer 0 КЕП cost: builder Personal Cloud (€7.67 / 3yr) + spouse Professional Cloud (€67.64 / 3yr) = ~€75 total for 3 years. Mobile-only via B-Trust Mobile app, no hardware. See `references/knowledge/competitors/b-trust-bg/CAPABILITIES.md`."

## How to use these in the four output artifacts

Every output artifact MUST include the calculator's formula (inputs + result) inline next to the recommendation. Never recommend an action without the math; never display the math without the source URL.

If any input is unknown, surface it as a one-line ask:
> "Confirm employment status (above/below max insurable cap?) to sharpen the net-cost figure. Defaulting to 'unknown' for now."

Citations: every threshold value (caps, VAT triggers, franchise taxes) MUST link to the corresponding `references/knowledge/launch/jurisdictions/<j>.md` or `references/knowledge/launch/credit-programs/<p>.md` file, which in turn cites the official URL with date.
