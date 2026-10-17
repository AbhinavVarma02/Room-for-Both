# Business case

Everything below is a product hypothesis unless it says otherwise. No customer interviews, pilots, or paid users
exist yet, and no time or money savings are claimed.

## Who it is for

**First users: independent retail and direct-to-consumer brands** with a handful of staff, such as a small-batch
skincare maker, a ceramics studio, or a coffee roaster. They want to reach new customers through a physical
partner (a bookstore, café, gallery, or boutique) but have no partnerships team.

**The other side: independent venues** that would welcome the right partner but have limited floor space, staff
hours, and evenings to give, and their own rules about what they carry.

**A plausible paying customer: an intermediary that arranges many small partnerships.** Market organisers,
business improvement districts, pop-up marketplaces, makers' collectives, and activation coordinators broker
dozens of brand-and-venue pairings a season. For them the cost of a stalled conversation is multiplied across a
programme, and they already hold both sides' contacts. This is the buyer I would test first; it is untested.

## The manual workflow today

As I understand it from how such collaborations are commonly arranged (not from my own research):

1. The brand picks venues it already knows, or searches a map by category, with no evidence that the venue's
   audience shares its customers' taste.
2. It sends a friendly, generic message.
3. Over several emails both sides discover each other's constraints one at a time: the venue only hosts on
   weeknights, the fee plus the brand's own costs exceed its budget, nobody agreed who staffs it.
4. When the first proposal does not fit, nobody knows which alternative to suggest, and the thread goes quiet.

## What changes with Room for Both

| Step | Manual | With Room for Both | What decides it |
|------|--------|--------------------|-----------------|
| Whom to approach | Known venues or a category search | Venues ranked by shared taste, with the category-only list beside it so the difference is visible | Qloo data |
| What to propose | A generic pop-up | Several ideas, each from a different slice of the evidence, shown with the formats that actually work on both sides' terms and what is still unverified | Qloo data, a stated rule, and the rules engine |
| Whose terms count | Discovered one email at a time | Both sides' terms side by side; the venue can answer privately through a link | Each party |
| Whether it fits | Found out late | Every arrangement checked at once: feasible, conditional, or no-go, with reasons | Deterministic rules |
| What to try instead | Guesswork | The smallest verified change, the first three questions, and a brief that lists each proposed change as needing the other side's confirmation | Deterministic rules |

## Why two-sided constraints and Decision Reversal matter

Most partner-discovery tools stop at "these venues match your audience". The hard part of a small partnership is
the counterparty's terms. Room for Both models the venue as a party with its own fees, days, space, staff time,
exclusions, and non-negotiables, keeps missing answers unknown instead of guessing, and turns a no into a
specific, verified "this would work if…". That is the moment a conversation usually dies.

## Value hypotheses to test

- **Fewer dead-end conversations:** a no-go is replaced by a specific alternative or a specific question.
- **Faster first meetings:** both sides arrive with the same structured facts.
- **Fairer proposals:** each side sees the other's constraints and its own priorities side by side.
- **Better-grounded outreach:** the first message names a cultural reason the venue's audience might care.

How I would test them: run the interview script with five brands, five venues, and two intermediaries; then a
pilot with one intermediary on real pairings, measuring how many first proposals reach a second meeting with and
without the brief. None of this has been done.

## Limits that matter commercially

- Adoption is two-sided: the venue must answer. The private link keeps that to one short form, but it is still
  friction, which is why an intermediary that already talks to both sides is the likelier buyer.
- The example deal is small (a few hundred dollars in fees). Value per deal is low; value per programme of many
  deals is the hypothesis.
- Cultural affinity is aggregate taste, not demand. A venue that ranks highly may still be a poor fit, may be a
  chain, or may not want partners.
- Operational facts (insurance, payment, restocking, dates) are outside the model and stay as questions.

## How it could be sustained

The product runs entirely on free tiers today. Paths that would not compromise its neutrality include a paid tier
for intermediaries that coordinate many partnerships and white-label use by them. Live cultural discovery needs
separately authorised Qloo access for any commercial use. Any such step would be a deliberate decision, not
something this repository enables by default.

## Out of scope

Payments, booking, automatic outreach, CRM features, revenue or traffic forecasts, and any inference of a
business's operations from cultural data.
