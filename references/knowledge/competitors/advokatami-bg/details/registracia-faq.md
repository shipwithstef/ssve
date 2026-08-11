# Advokatami.bg `/registracia-na-firma/` — Full FAQ Accordion (Verbatim)

**Source:** Playwright extraction 2026-05-03 (the static fetch + LLM summarization missed all 9 accordion bodies; user caught one manually; this file captures all of them)

**Method:** `node research/scripts/playwright-extract.mjs https://www.advokatami.bg/registracia-na-firma/` — JS-rendered DOM after auto-expanding all `<details>` and `.accordion` elements.

## Accordion 1: Какво точно ще се изисква от мен?

> "Да попълниш кратък въпросник с данни за бъдещата фирма — име, управител, съдружници, адрес и дейност. Ние подготвяме документите и ти ги изпращаме по имейл за подписване. След подписване, управителят посещава нотариус (заверка на подпис — ~10 мин) и банка (внасяне на капитала). Връщаш ни сканираните документи по имейл и ние се заемаме с Търговски регистър."

**Plain interpretation:** 5-step flow:
1. Fill questionnaire (name, manager, partners, address, activity)
2. They prepare docs → email to client for signing
3. Manager visits notary (~10 min, certifies specimen signature)
4. Manager visits bank (deposits capital)
5. Client emails scanned signed docs back → they file in TR

## Accordion 2: Каква е цената и какво включва?

> "Цената е **€119 с вкл. ДДС** — еднаква за ЕООД и ООД, без значение от броя съдружници.
> Включва: консултация, изготвяне на всички документи, подаване в Търговския регистър, следене на производството и реагиране при указания.
> Допълнително: **€28.38 държавна такса** (плаща се директно), **~€15 банкови такси** и **~€3 нотариална заверка**.
> Хонорарът се заплаща при поръчка — приемаме карта, ePay, EasyPay, банков превод."

**Total all-in: ~€165** (€119 + €28.38 + ~€15 + ~€3)

## Accordion 3: Колко време отнема регистрацията?

> "Документите изготвяме в рамките на същия ден (или следващия работен ден, ако поръчваш след 16:00 ч.). Обработката в Търговски регистър отнема 2 работни дни. Като цяло — средно 3 работни дни от поръчка до ЕИК или 2 работни дни от подписани документи до ЕИК - бързината зависи от теб."

**Plain interpretation:** 3 working days from order to ЕИК (2 if you sign quickly).

## Accordion 4: Трябва ли да ходя до нотариус? А до банка?

> "Да, и за двете. Управителят е задължен да завери „Съгласие и образец от подпис" пред нотариус — отнема около 10 минути, таксата е ~€3. Капиталът се внася по набирателна сметка в банка — банковите такси са около €15. И двете се правят в твоя град — не е нужно да идваш в София."

**Plain interpretation:** Notary AND bank visits required, but in your city — no need to come to Sofia.

## Accordion 5: Какъв капитал да избера?

> "Минимумът е **€1 (2 лв.)**, но на практика е по-добре да вложиш реален начален капитал, съобразен с предстоящите разходи на бизнеса. Капиталът си е собственост на фирмата и можеш да го използваш свободно след регистрацията. Ако не си сигурен — ще те консултираме."

**Plain interpretation:** 2 BGN minimum (symbolic) but practical advice = capitalize realistically. Capital becomes company property, freely usable post-registration.

## Accordion 6: Не съм в София — мога ли да се възползвам?

> "Разбира се! Работим онлайн с клиенти от цяла България и чужбина. Единствените посещения на място (нотариус и банка) ги правиш в своя град. Хиляди фирми от Пловдив, Варна, Бургас и всички останали градове са регистрирани чрез нас."

## Accordion 7: Какво се случва ако регистрацията бъде отказана?

> "Следим производството в реално време и реагираме при указания от длъжностното лице. Ако въпреки всичко регистрацията бъде отказана по наша вина — **ние покриваме новата държавна такса или ти връщаме парите**. 100% гаранция."

**Plain interpretation:** Money-back guarantee if rejection due to their fault — they cover new state fee OR refund.

## Accordion 8: Можете ли да помогнете за лицензи и разрешителни?

> "Да! Помагаме за стартиране на бизнес с ресторант, кафене, салон за красота, автомивка, магазин, обменно бюро, туристическа агенция и много други. Свържи се с нас за конкретна информация за твоя случай."

**Plain interpretation:** Yes, license/permit help available for: restaurant, café, beauty salon, car wash, shop, currency exchange, travel agency, etc. **Highly relevant for Example Marketplace's customer segment.**

## Accordion 9: Какво трябва да направя след регистрацията?

> "След регистрацията изпращаме подробна информация за следващите стъпки: **осигуряване на управителя**, **избор на счетоводство**, **поръчка на печат**, **откриване на разплащателна сметка**, **евентуална регистрация по ЗДДС**. Не те оставяме сам — на разположение сме за въпроси и след регистрацията."

**Plain interpretation:** Post-registration support flow:
1. Manager social-security registration
2. Accountant selection
3. Company seal order
4. Operating bank account opening
5. Possible VAT registration (e.g. чл. 97а ЗДДС — directly relevant for Example Marketplace Day-1 trigger)

## Accordion 10: ЕООД или ООД — кое да избера?

> "Ако стартираш бизнес сам — ЕООД. Ако имаш един или повече съдружници — ООД. И при двата варианта отговорността е ограничена до капитала, а правният режим е почти идентичен. **Цената ни е еднаква и за двете.**"

**Plain interpretation:** Solo founder → EOOD. Co-founders → OOD. Both have limited liability. Price is same.

## Trust signals on page

> "Присъедини се към **10 500+ предприемачи**, които вече регистрираха фирма с нас. €119 с вкл. ДДС. Фирмата е готова до 2 дни."
>
> "Въпроси? **contact-28745f8699@example.invalid** | Отговаряме бързо"
>
> "★ **4.9/5 от 960+ отзива в Google** | ★ 4.8/5 от 414 във Facebook"

## What this changes for Example Marketplace launch decision

| Before (missing accordion) | After (full extraction) |
|---|---|
| Layer 1 cost: ~€147 (€119 + €28.12 state assumed) | **Layer 1 cost: ~€165 all-in** (€119 inc.VAT + €28.38 state + ~€15 bank + ~€3 notary) |
| State fee: €28.12 (assumed from elsewhere) | **State fee: €28.38** (verbatim from this page) |
| Notary handling: unknown | **~€3 specimen signature certification, in your own city, ~10 min** |
| Bank fees: unknown | **~€15 capital deposit account opening + transfer** |
| Sequencing: marketing summary | **Full 5-step process: questionnaire → docs prepared → notary visit → bank visit → email back → TR filing** |
| Money-back guarantee: unknown | **Yes — they cover new state fee OR refund if rejection due to their fault** |
| Time: "до 24 часа" generic | **3 working days order→ЕИК (2 if you sign quickly)** |
| Post-reg support: unknown | **Manager SS + accountant + seal + bank + VAT registration guidance** |
| Sofia required: unknown | **No — notary + bank in your own city, online for everything else** |
| Example Marketplace-relevant license help: unknown | **Yes — restaurant/café/salon/car wash/etc., directly relevant for Example Marketplace's customer segment** |

## Sources

- Playwright extraction: `raw/playwright-registracia.txt` (11,080 chars, 2026-05-03)
- Original gemini extraction (incomplete): `raw/gemini-extraction.md` (2026-05-03)
- User caught the gap manually: pasted accordion content in session 2026-05-03
