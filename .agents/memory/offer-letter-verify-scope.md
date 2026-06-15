---
name: Offer-letter acceptance is NOT covered by /verify
description: Enduring contract — which document types /verify validates
---

**Contract:** the public `/verify` page only validates `hr_letter` and `contract`
document types. Offer-letter acceptance has no /verify path, and countersigning reads
the stored hash/auth code rather than recomputing it.

**Implication:** evolving the offer-letter acceptance hash payload (e.g. folding in
new acknowledgement fields) does not break /verify and does not invalidate
already-accepted letters. Safe to change the acceptance payload shape.
