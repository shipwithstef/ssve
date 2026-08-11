# EIT Urban Mobility — Applied Knowledge

## 1. Distilled positions per theme

### Theme 1: Corporate Eligibility & RIS
*   **Quote:** *"Your startup has individual founders and executive team members who jointly hold more than 40% share of the company’s equity before the current fund raising."* (Source: `details/eligibility.md` § 1.2)
    *   *Interpretation:* Companies that have undergone heavy early dilution or are operated by non-equity-owning managers are locked out of the grant process to ensure founder operational commitment.
*   **Quote:** *"Bulgaria is listed as an eligible EIT Regional Innovation Scheme (RIS) country for 2026. This qualifies Bulgarian entities for a reduced co-funding rate of 25% (versus 35% for non-RIS applicants)."* (Source: `details/eligibility.md` § 2.0)
    *   *Interpretation:* Startups in RIS countries like Bulgaria receive a significant financial advantage, lowering the required matching private capital threshold to 25%.

### Theme 2: Share Subscription & Holding Structures
*   **Quote:** *"The subscription price of the shares allocated to EIT Urban Mobility is set at their nominal value (par value), rather than the market price of the fundraising round."* (Source: `details/investment-mechanics.md` § 1.2)
    *   *Interpretation:* EIT secures its financial sustainability return by taking shares at par value, representing a de facto dilutive fee that founders must factor into their round economics.
*   **Quote:** *"The legal entity that incurs and records the project costs must be the applicant entity receiving the grant. If the startup has a parent holding company (TopCo) in another jurisdiction... the TopCo must issue and allocate the nominal value shares to EIT Urban Mobility."* (Source: `details/investment-mechanics.md` § 1.3)
    *   *Interpretation:* Dual-entity setups must strictly isolate grant expense reporting to the EU subsidiary while executing the nominal share issue at the parent holding level.

### Theme 3: NetSuite Portal & Administration Timelines
*   **Quote:** *"If a technical issue with the NetSuite portal prevents submission... The applicant must email the PMO team (contact-361d8a4c76@example.invalid) within 3 calendar days after the call closure."* (Source: `details/appeals-and-administration.md` § 1.2)
    *   *Interpretation:* Missing a deadline due to portal failure has a strict 72-hour reporting window with a time-stamped proof gate, excluding any client-side errors.
*   **Quote:** *"Startups have 7 calendar days from receiving results to submit a formal appeal."* (Source: `details/appeals-and-administration.md` § 1.4)
    *   *Interpretation:* The post-SER appeal window is extremely brief, counts weekends, and strictly limits challenges to factual discrepancies rather than evaluator opinions.

## 2. Cross-domain implications

### Applied to Example Company / Example Marketplace Context:
1.  **Fundraising Readiness Gate:** Example Company has a 100% founder-owned structure (SSVE Maintainer), satisfying the >40% founder equity rule. However, because EIT behaves strictly as a co-investor and expects *pari-passu* investment alongside VCs/angels (as outlined in `details/investment-mechanics.md`), Surge cannot apply until a primary fundraising round is actively open and a lead investor is secured.
2.  **RIS Subsidy Optimization:** Since Surge is established in Bulgaria, they can leverage the 25% co-funding rate. For the maximum €2.5M ticket or any smaller ticket, the required match funding from the private co-investors is limited to 25%, drastically easing round closure.
3.  **Entity Expense Splitting:** If Example Marketplace is commercialized via a holding company (e.g., a US TopCo for venture backing), the grant application must be submitted by Example Company (the Bulgarian subsidiary) to record costs, but the nominal value shares must be issued by the TopCo parent.
4.  **IP Cleanliness Necessity:** EIT requires satisfactory due diligence on IP ownership prior to signing the FSA. Before applying, SSVE Maintainer must formally transfer all personal Example Marketplace IP and codebase rights to Example Company.
5.  **NetSuite Registration Delay:** Surge must register and obtain a PIC number via the EU Portal, then submit a NetSuite PIF at least 2 weeks before their target cut-off, as NetSuite profile validation takes up to 2 working days and portal traffic jams are common on cut-off days.

## 3. Contradictions / open questions

*   **Valuation Cap Discrepancy:** The EIT Urban Mobility investment thesis document (`Thesis.txt`) states that the pre-money valuation is *"Uncapped"*, whereas the 2026-2028 Startup Investment Call Manual (`Call-Manual.txt`) explicitly establishes a hard admissibility cap stating the company pre-money valuation *"does not exceed €50,000,000"*.
    *   *Resolution:* The €50M cap is an eligibility gate for the open grant calls, whereas the general investment arm of EIT can co-invest in growth-stage startups beyond the open call manual without valuation caps.
*   **Voluntary vs. Mandatory FS Share Allocation:** Section 3.4.4 of the Call Manual describes the financial sustainability equity allocation as being on a *"voluntary basis"* to *"potentially explore EIT Urban Mobility becoming a shareholder"*. However, in Section 2.2 (Exclusion Criteria), startups are excluded if they *"Do not accept the general principles and objectives of EIT Urban Mobility’s FS strategy."*
    *   *Resolution:* While the share allocation is framed as voluntary to align with Horizon Europe rules, it is practically a mandatory contracting condition; refusing to execute the nominal share allocation results in a failure to conclude the contracting phase and loss of the grant.

## 4. Recency-weighted insights

*   **Tax Dilution Alert (2026 Call Manual v1.2):** Obtaining a Horizon Europe grant alongside a nominal value share subscription can trigger deemed income or gift tax liabilities depending on national tax rules. Startups must seek tax counsel prior to signing the FSA.
*   **Upright Project Net Impact Ratio (2025 Impact Report):** EIT now utilizes a rigorous quantitative net impact metric processed by the Upright Project. Their portfolio averages a 50% Net Impact Ratio (compared to S&P 500's 11%). Startups must articulate their ESG contribution using this strict `(positive - negative) / positive` formula.
*   **EU Taxonomy Alignment (2025 Impact Report):** EIT's portfolio achieves 53.7% Taxonomy eligibility and 38.5% alignment, demonstrating a very narrow 15.2% gap. Evaluators look for startups whose activities are technically aligned (DNSH compliant) under Climate Change Mitigation (34.5% of portfolio alignment) or Circular Economy (6.7%).

## 5. Source map

*   **Theme 1 (Eligibility & RIS):** `details/eligibility.md` § 1.1 (cut-offs), § 1.2 (mandatory checklist), § 2.0 (Bulgarian RIS advantage).
*   **Theme 2 (Investment & Holding Structures):** `details/investment-mechanics.md` § 1.1 (instruments), § 1.2 (nominal subscription), § 1.3 (TopCo structures).
*   **Theme 3 (Administration & Appeals):** `details/appeals-and-administration.md` § 1.1 (PIC/PIF), § 1.2 (portal failure email), § 1.4 (SER appeal window).
*   **Theme 4 (Impact & Thesis):** `details/impact-and-thesis.md` § 1.1 (thesis stats), § 1.2 (portfolio scores), § 1.3 (EU Taxonomy), § 1.4 (case studies).

## 6. What this distillation does NOT capture

*   This synthesis does not capture the specific product architecture or code layout of Example Marketplace.
*   It does not include any updates or modifications to the Call Manual beyond version 1.2 (published March 2026).
*   It does not detail the exact accounting entry mechanics for capitalized grants under Bulgarian national law, which must be assessed by Surge's CPA.
