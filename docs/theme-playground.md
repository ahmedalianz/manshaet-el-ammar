# Selected visual identity — الأزرق البترولي

The temporary palette playground has been removed at the owner's request. Slate Blue (الأزرق البترولي) is now the sole application identity. Its resolved Light/Dark tokens were moved unchanged into `src/theme/colors.ts`; alternative palette definitions, picker UI, visual preference state, storage reads/writes and related API were removed.

More → Appearance retains System / Light / Dark. Existing appearance preference persists normally. Previously saved palette IDs are ignored, so every installation resolves to Slate without needing a storage reset. Brand illustrations and semantic status colors remain intact. No business logic or navigation changed, and no native rebuild is required.
