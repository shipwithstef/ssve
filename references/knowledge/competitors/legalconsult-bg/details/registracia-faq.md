# LegalConsult.bg `/услуги/регистрация-на-фирми/` — Full FAQ (Verbatim)

**Source:** Playwright extraction 2026-05-03 — audit of original gemini extraction. Page DOES have FAQ but answers are inline (not collapsed accordion), so original extraction caught most. Re-verified for completeness.

## Pricing block (verbatim)

> **Регистрация на ЕООД, ООД, ЕТ**
> 125 евро или 244,48 лв
> включва и безплатна консултация
>
> **Регистрация на АД**
> 500 евро или 977,92 лв

## FAQ block (verbatim)

### Колко струва откриване на фирма онлайн?
(Answered by the pricing block above — €125/€500.)

### Каква информация е необходима за регистрация на фирма
(Pre-procedure information requirements.)

### Колко време отнема регистрацията на фирма?
(Not extracted in this audit pass — refresh if material to decision.)

### Какво ми е необходимо, за да започнем процедурата?

> "Необходимо е да ни предоставите основните данни за бъдещата фирма: фирмено наименование, предмет на дейност, седалище и адрес на управление, учредители/съдружници, капитал и дялове, управител и начин на представляване. След това ние изготвяме и организираме подписването на документите."

### Какъв капитал е необходим за регистрация на ЕООД или ООД?

> "Минималният капитал при регистрация на ЕООД или ООД, считано от **01.01.2026 г., е 1 евро**. На практика капиталът се избира според нуждите на бизнеса и конкретната ситуация. Важно е да се съобразят и дяловете (ако е ООД) и начинът на управление."

**Plain interpretation:** Min capital changed to **€1** as of 1 Jan 2026 (post-EUR adoption) — NOT 2 BGN as in pre-EUR knowledge files.

### Каква е държавната такса за регистрация на фирма?

> "Държавната такса зависи от вида заявление и начина на подаване. При електронно подаване таксата е в размер на **28,12 евро (55 лева)**."

**Plain interpretation:** State fee €28.12 (55 BGN at fixed exchange rate 1.95583).

> **Discrepancy with Advokatami extraction:** Advokatami's accordion stated €28.38. LegalConsult states €28.12. The official current state fee is **€28.12 = 55 BGN exactly**. Advokatami's €28.38 may be slightly inaccurate or include a small additional element. Will note as open question.

### Кое е по-подходящо – регистрация на ЕООД, ООД или ЕТ?
(Comparison of vehicles — answered with general guidance.)

## What this audit revealed

| Item | Original extraction | Audit finding |
|---|---|---|
| Pricing €125 | ✅ Captured | ✅ Confirmed |
| State fee €28.12 / 55 BGN | ✅ Captured | ✅ Confirmed |
| Min capital | Old: 2 BGN | **Updated 2026-01-01: €1 (post-EUR adoption)** |
| Bank fees | NOT captured | **Not on this page** (LegalConsult is less detailed than Advokatami here) |
| Notary fees | NOT captured | **Not on this page** |
| 5-step process detail | NOT captured | **Not detailed on this page** |

LegalConsult's `/услуги/регистрация-на-фирми/` is genuinely less detailed than Advokatami's. Not because the static fetch missed accordions — because the LegalConsult page is just less informative.

## What's still unknown for LegalConsult

To make a fair side-by-side with Advokatami, would need:
- LegalConsult's notary handling (likely same ~€3 since it's a statutory cost)
- LegalConsult's bank-fee handling (likely same ~€15 since it's a bank cost)
- LegalConsult's process timeline
- LegalConsult's money-back guarantee policy (Advokatami offers 100% refund on rejection-by-fault; LegalConsult unclear)
- LegalConsult's post-registration support flow

These would require asking LegalConsult directly OR a deeper extraction of their `/общи-условия/` page.

## Conclusion of audit

Original LegalConsult extraction was substantially correct (price + min capital pre-2026 + state fee captured). Two updates:

1. **Min capital changed to €1 as of 2026-01-01** — propagate to bg.md launch knowledge
2. **State fee €28.12 = 55 BGN is the verified figure** — Advokatami's €28.38 should be verified (likely small inaccuracy in Advokatami's page or rounding)

Add to coverage gap: LegalConsult's process detail + money-back policy not extracted; not material for Example Marketplace decision today.
