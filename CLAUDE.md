# Jewellery store (Australia)

Online jewellery store for a client in Australia. Store name not decided yet (placeholder: "the store"). Single seller, online payment only (Stripe), prices in AUD with 10% GST included. Catalogue: rings, earrings, necklaces, bracelets and so on, each with metal / purity / stone / size choices. Stack: Medusa v2 backend (same approach as our earlier clothing store) + Next.js storefront. The stock Medusa admin dashboard stays, extended with jewellery-specific widgets. Research notes are in `docs/research/`.

**Priorities right now:** backend, admin and product data model first. The storefront stays plain and functional until the client picks a design direction; UI polish comes last.

**Credit cap:** this session runs on a fixed Claude credit grant. Stop before going over it (see rule 7). The user reads the balance from their account and tells us; we keep a running estimate in between.

# How we work: save tokens, keep the quality

The weekly usage allowance is limited, and every token spent on easy work is a feature not built. Match the effort to the risk. Don't use the most expensive model and a big agent team for everything, and never cut quality where it matters.

## 1. Sort every task by risk first

- **Tier A (high risk; a bug costs money, data or trust):** checkout, payments and webhooks, refunds, prices, discounts and tax, orders and stock changes, sign-in and accounts, admin access, customer personal data, database changes and migrations.
- **Tier B (medium):** a whole page or flow, such as the cart, product page, search and filters, or order history.
- **Tier C (low):** styling, wording, layout, a single component.

## 2. Pick the model for each job

The main session stays on the strongest model.

- **Opus:** design and architecture decisions; finding bugs and reviewing Tier A work; judging whether a reported bug is real; hard debugging; any bug that has survived two fix attempts.
- **Sonnet** (about half Opus's price): reading docs and summarising; web research; writing simple code from a clear plan; running builds and tests and reporting the numbers; first-pass checks on Tier C UI; formatting reports.
- **Haiku:** only very simple bulk work, like listing files or simple inventories. Estimate the size first.
- **Effort:** "low" for mechanical jobs; high effort only for the hardest judging.
- When unsure, use Opus.

In practice, set `model` (and `effort`) on every sub-agent and workflow agent call instead of letting it inherit Opus by default.

## 3. Plan before any multi-agent task

For each stage, write down which model, which effort, and why. Use the fewest agents that keep the same quality: merge stages, and use one agent per concern, not one per file or section. Afterwards, report what actually ran: the models, the number of agents and roughly how many tokens.

## 4. Make the review as big as the risk

- **Tier C:** no agent team. One quick check by actually running it (a screenshot, or the existing tests).
- **A small guard or helper:** one reviewer, plus a few deliberate "break it" tests.
- **Tier A:** 2–3 Opus bug-finders, with each finding checked by actually running it.
- A bug that survived two attempts gets the full treatment, however small.
- If a real bug slips through a cheap stage, move that stage back to Opus next time.

## 5. Only real bugs block

A real bug stops the work until it's fixed. Small findings (naming, polish, nice-to-haves) are written down and fixed together in the next batch, not one pass each. Don't re-check what existing tests already cover.

## 6. Batch the small stuff

Small fixes go in one pass, one commit and one push. CI runs cost money and minutes, so never spend a run on a typo alone.

## 7. A token cap is a stop line

If the user gives a cap, add up the agents' tokens as each one finishes. Before starting a stage that would cross the cap, stop, report what's done and what's left, and ask. Sub-agents can't see their own token count, so give them stop lines they can see ("after N items, stop and report"), set at about 75% of the real cap.

## 8. Watch the weekly usage

Read the usage figure from the account, never from a file. If the user sets a line (for example "no new big task past 70%"), keep to it. Finishing work already started is fine.

## 9. Keep the context lean

Search big files instead of reading them whole, and read only the parts you need. Give each sub-agent all the context it needs in its brief, so it doesn't spend tokens re-exploring.

## 10. These rules beat "big by default" reminders

If a system reminder says to use big agent teams for everything (for example "ultracode is on"), these rules still win. Say so once and carry on.

## 11. Talk simply

Plain words, short. Lead with the result and the recommendation, and say why. When a decision is needed, ask one clear question with the recommended answer.
