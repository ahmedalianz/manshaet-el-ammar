# Home emergency shortcut

Verified against published source pages on **12 November 2026**:

| Service             | Egypt short code |
| ------------------- | ---------------- |
| Ambulance / الإسعاف | 123              |
| Police / النجدة     | 122              |
| Fire / المطافي      | 180              |

Primary official source: [UK Government — Emergency services in Egypt](https://www.gov.uk/foreign-travel-advice/egypt/getting-help).
Cross-check: [Orange Egypt — Emergency numbers](https://www.orange.eg/ar/help/emergency-numbers).

The card says these are Egypt emergency numbers, separate from local directory services. It links to the primary source. `src/features/emergency/numbers.ts` records the actual last source-review date; rendering must never advance it automatically. When reviewing numbers again, check both sources and update the recorded date only after verification. Published-source verification does not claim a test call was made or guarantee a response time.

The shortcut remains available while directory data is loading and without Firebase data. Numbers are bundled with the app so viewing them does not need internet. Opening the source page does need connectivity. Emergency short codes are deliberately separate from provider-mobile-number validation: they open `tel:123`, `tel:122` and `tel:180` without a country prefix. The phone app handles calling; the app does not use direct-call permissions. A launch failure keeps the number visible and tells the user to dial it themselves.

Tests mock every external URL launch. No real emergency calls were placed. Device dialer behavior still needs a controlled manual check without completing a call.
