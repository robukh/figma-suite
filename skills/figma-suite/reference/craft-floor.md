# Craft Floor

Read before drawing, and again at the start of every major section (long sessions drift). Each line is a rule from [anti-slop.md](anti-slop.md); reasoning, exceptions and checks live there. **Bans** hold unless waived in writing; **defaults** are judgment calls that DESIGN.md `Project decisions` can change. Project taste always wins over this file.

**Order of priority: complete, then clear, then restrained.** A screen that looks unfinished fails before a busy one does. Restraint means removing what is redundant, never removing what the product needs.

## Before you draw
- State the user, the job, the primary action and the platform in one sentence each. Pick the mode from DESIGN.md: `operate` (tools used daily), `consumer` (mobile and lifestyle apps), `persuade` (marketing and landing pages), `read` (content). (P01)
- **Cover the brief.** List everything the brief asks for. The main frame must show every item, and the brief's central interaction in its populated state (rows selected, item in cart, menu open). Extra states go in extra frames, but the main frame is judged on its own. (P11)
- **Add the platform's chrome.** Mobile: status bar, home indicator, tab bar when the app has two or more top-level destinations, nav bar with title or back on detail screens. Web app: its navigation shell (top bar or sidebar). Tablet: its nav pattern. Landing page: nav and footer. This is structure, not decoration. (L13)
- List the content first; every element should trace to something the user needs to know or do. Ask "would I produce this for any similar screen?" and change what is generic. (P02, P03)

## Bans
1. No eyebrow or kicker text above a heading. (C01)
2. No emoji or glyph typed as an icon, bullet or link suffix; no middle-dot meta strings. (C08)
3. No nested cards; no colored side-stripe borders on cards or callouts. (L06, K07)
4. No gradient text, decorative glow, or glass blur. (K14)
5. No invented proof (round stats, fake testimonials) or placeholder names (Lorem, Acme). (C09)
6. No hype or filler copy, no apologies, no "Welcome back!". (C07)
7. No numbering (01/02/03) unless the content is a sequence. (C10)

## Defaults
- **Icons earn their place; they are not banned.** Use real icons where the platform or task expects them: tab bars, media controls, toolbars, list rows that scan faster with a leading icon, status. Do not repeat one decoratively in every button, heading or tile. If the library has no icon you need, make a minimal icon component (one stroke weight, 16/20/24) instead of substituting text. (K02, K04, K15)
- **A description under a title must add something** (a reason, consequence, format, next step or per-row data); drop it only when it restates the title. (C02, C03)
- One primary action per section. At most 4 visible options per decision point. (L01, L02)
- Group with spacing and alignment before borders; cards for units the user acts on. (L04, L07)
- One accent color, status never by color alone, contrast 4.5:1 body and 3:1 large and UI. (T01, T03)
- At most 4 text sizes on product screens; consumer and marketing screens may add one display size. Use the product's font. (T04, T09)
- **Fill the screen with what the product would really show.** Realistic, populated content for the platform; no empty bottom third on mobile, no sparse sketch. (L14)
- **When the system lacks a token, do not flatten the design to fit.** Use an on-scale raw value (multiples of 4 or 8) for larger spacing, display type or extra radii, record it as an exception, and report the library gap. Landing and consumer screens need display type and 64 to 120px section spacing. (T12)
- Buttons are verb + object. Errors say what failed and what to do. Empty states: why, then one action. (C04, C06)
- Realistic data at short, average and very long lengths; every state the brief implies is designed. (C09, K13, P06)
- Bind to variables and instance existing components where they exist. (T11, P04)

## Before you finish
- Run the slop scan (bans must be zero), remove only what you can name as redundant (never brief content or platform chrome), then get an independent review. Scores are advice, not a gate. (P05, P08)
- Report what was not verified.
