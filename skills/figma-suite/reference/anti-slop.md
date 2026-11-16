# Anti-Slop Catalog

Rules that keep generated UI from looking like generated UI. Each rule has a stable ID so findings, waivers and checks can cite it. `ban` = absolute (waive only with a written reason). `default` = holds unless the project earns it back in DESIGN.md `Project decisions`. The short version loaded while building is [craft-floor.md](craft-floor.md).

**Contents:** [How to use](#how-to-use) · [Content and copy](#content-and-copy) · [Hierarchy and layout](#hierarchy-and-layout) · [Components](#components) · [Colour and type](#colour-and-type) · [Process](#process) · [Icon and description decision tables](#icon-and-description-decision-tables) · [Per-project decisions](#per-project-decisions) · [Sources and confidence](#sources-and-confidence)

## How to use

- Precedence: DESIGN.md `Project decisions` → this catalog → general judgment. A ban stays a ban unless the waiver names the rule, the screen and the reason.
- **Check** = the `scripts/slop-scan.js` check that detects it mechanically (`S..`). Rules without one are judged by the critic ([critique-rubric.md](critique-rubric.md)).
- Avoiding one cliché tends to land on the next (no purple gradient → cream and terracotta). So every ban needs a positive project decision: DESIGN.md names the actual accent, type and structure to use instead.
- **Completeness outranks restraint.** In the first broad evaluation, the restrained version lost most mobile pairs because it removed platform chrome and icons and left screens sparse. Treat "remove" rules as applying to redundancy only.
- Mode changes how strict the defaults are: `operate` is the most austere, `consumer` (mobile and lifestyle apps) allows richer visuals, a display size and more content, `persuade` (marketing) allows display type, generous spacing and imagery placeholders.
- Motion is outside static Figma work; if a prototype is requested: motion states what changed, one authored moment at most, 150–250 ms for product UI, no bounce.

## Content and copy

| ID | Type | Rule | Instead / exception | Check |
|---|---|---|---|---|
| C01 | ban | No eyebrow or kicker above a heading | Fold real information into the heading or a breadcrumb. Exception: a caption that gives real section context in a flow | S10 |
| C02 | default | No description under a title unless it adds a reason, consequence, format, next step or per-row data | Tables below; run the redundancy test | S03 |
| C03 | default | Heading, label, helper text and tooltip each say something different; state one fact once | Delete the repeat; the heading carries the topic, the helper carries only what the heading cannot | S04 |
| C04 | default | Buttons are verb + object ("Save changes", "Delete 3 files"); never Submit, OK, Learn more, Click here | The label names the result | S20 |
| C05 | default | One action keeps one name across the flow | "Publish" → toast "Published" | — |
| C06 | default | Errors state what failed and the next step, without apology or "Oops". Empty states: why it is empty, then one action | Do not repeat the title in the body | S20 |
| C07 | ban | No hype or filler ("seamless", "supercharge", "unlock"), no "Not X. Y." taglines, no exclamation marks, no "Welcome back!" greeting | A greeting is allowed only when it carries state (unread count, last action) | S20 |
| C08 | ban | No emoji or glyphs as icons or bullets, no trailing "→" on links or buttons, no spaced em-dash labels, no middle-dot meta strings ("A · B · C") | Real icon component, or nothing | S20 |
| C09 | ban | No fabricated proof (round stats, invented testimonials, fake urgency) or placeholder names (Lorem, Acme, John Doe). Data is realistic at short, average and very long lengths | Take copy from specs; label synthetic data as synthetic | S20 |
| C10 | ban | No 01/02/03 numbering unless the content is a real sequence | A numbered list or steps component for sequences | S10 |
| C11 | default | Casing is a project decision; default sentence case. ALL-CAPS only for short glanceable labels the project allows | Title Case is the most common LLM drift | S11 |
| C12 | default | Copy speaks to the user's task, not the system's internals | "Manage notifications", not "Configure webhook" | — |

## Hierarchy and layout

| ID | Type | Rule | Instead / exception | Check |
|---|---|---|---|---|
| L01 | default | One primary action per section or screen | Demote the rest to secondary or ghost | S25 |
| L02 | default | At most 4 visible options per decision point | Group behind a menu or progressive disclosure, two levels at most | — |
| L03 | default | Squint test: focal element, secondary, and groups stay identifiable when blurred | Increase contrast between levels, not decoration | — |
| L04 | default | Group by proximity and alignment before borders or containers. Delete a border whose removal loses no grouping | Space, headings, background shift | — |
| L05 | default | More space above a heading than below; spacing varies with hierarchy | Spacing tokens by role, not one value everywhere | S14 |
| L06 | ban | No cards inside cards | Flatten; use spacing and a heading | S05 |
| L07 | default | A card is for a unit the user opens, moves or acts on. No three identical icon + heading + text tiles as page structure | List, table, or vary span and weight to the content | S04 |
| L08 | default | No stat or metric strip unless the user decides from those numbers, with context (period, comparison) | Put the number where the decision is made | — |
| L09 | default | Left-align text blocks; centre only single-focus screens (auth, empty state) | | — |
| L10 | default | Every screen has a next step or a recovery path; no dead ends | | — |
| L11 | default | Truncation, wrapping and overflow are designed for very long content | Fixed widths with ellipsis and tooltip, or wrap | S18 |
| L12 | default | Do not alternate image sides in a strict zig-zag | Landing pages only; vary the rhythm | — |
| L13 | default | Include the platform's chrome: mobile status bar, home indicator, tab bar (when the app has two or more top-level destinations), nav bar with title or back on detail screens; web app navigation shell; landing page nav and footer | Chrome is structure, not decoration; cutting it makes a screen read as a fragment. Skip only for modals and overlays | S27 |
| L14 | default | Fill the screen with the content the product would really show; no empty bottom third on mobile, no sparse sketch | Add the secondary list, summary or navigation a real screen has, not filler | S27 |

## Components

| ID | Type | Rule | Instead / exception | Check |
|---|---|---|---|---|
| K01 | default | At most one primary button per section | | S25 |
| K02 | default | Do not put an icon in every button; an icon inside a button must add meaning the label lacks (table below) | One meaningful icon, or none. Icons elsewhere (K15) are fine | S01 |
| K03 | default | Icon-only controls have an accessible name and a tooltip; never icon-only for destructive actions | Toolbars and row actions only | S01 |
| K04 | default | One icon family, one stroke weight, one size set, from a real library; never drawn by the model; icon color equals label color | Instance the icon component or import the codebase SVG | S02 |
| K05 | default | Navigation and tab bars show icon plus visible label; ≤5 top-level items; current location marked | | — |
| K06 | default | A badge or pill is for a defined status or count; at most one per row; status is never color-only | Plain text for everything else | S12 |
| K07 | ban | No colored side-stripe border (>1px) on cards, callouts or list items | Semantic surface plus icon plus neutral body text | S06 |
| K08 | default | Declare elevation once: border or shadow, not a hairline plus a wide shadow. One shadow level, for floating layers only | | S15 |
| K09 | default | Tables: only the columns the task needs, muted headers, right-aligned tabular numerals, one row-action pattern | | — |
| K10 | default | Forms: persistent visible labels (a placeholder is an example, not a label), inline errors, mark optional fields, helper text only when non-obvious | | — |
| K11 | default | Modals only for irreversible or required-input tasks; prefer inline or undo; never nested; a destructive confirm names the object | | — |
| K12 | default | Radius by component role; a nested radius equals the outer radius minus padding | | S15 |
| K13 | default | Design every state: default, hover, focus, disabled, loading, error, empty (and partial where it applies) | A state matrix per screen | S24 |
| K14 | ban | No gradient text, decorative glow, glass blur, or hard offset shadow (unless the project style is built on it) | A flat solid with a deliberate accent | S07, S08, S09 |
| K15 | default | Use icons where the platform or task expects them: tab bars, media controls, toolbars, scannable list rows, status. If the library lacks one, make a minimal icon component (one stroke weight, 16/20/24) instead of substituting text | A missing icon is a library gap, not a reason to drop the control. Text-only "Previous / Pause / Next" reads as a wireframe | — |

## Colour and type

| ID | Type | Rule | Instead / exception | Check |
|---|---|---|---|---|
| T01 | default | One accent plus neutrals; the accent marks the primary action, selection and links; status never relies on color alone | | — |
| T02 | default | Avoid the default AI palettes (purple or indigo gradients, cyan on near-black, neon glow) and reflex "safe" ones (cream plus terracotta) | Use the palette named in DESIGN.md | S21 |
| T03 | default | Contrast ≥4.5:1 for body text, ≥3:1 for large text and UI; never gray text on a colored surface — tint from the surface hue | | S16 |
| T04 | default | ≤4 text sizes per product screen from the type scale, ≤2 families, real steps between levels (product UI ≥1.125, marketing ≥1.25). Consumer and marketing screens may add one display size (and a large numeral where the content is a number) | | S13 |
| T05 | default | Body line length about 45–75 characters, leading ≥1.4 for body, no justified text | | S18 |
| T06 | default | No accent on a single heading word; no tracked ALL-CAPS micro-labels unless the project allows | | S11 |
| T07 | default | Tabular numerals for number columns; monospace only for code and data | | — |
| T08 | default | Body text ≥12px (product body ≥14 recommended); functional UI text ≥11px | | S17 |
| T09 | default | Use the product's font from DESIGN.md or the codebase; do not default to Inter unless it is the product font | Assert the font after the build | S13 |
| T10 | default | Targets ≥24px on desktop and ≥44px on touch | | S23 |
| T11 | default | Bind to semantic tokens where a token exists; no off-token hex, no off-scale spacing or radius | | S14, S22 |
| T12 | default | When the system has no token for what the screen needs (larger spacing steps, display type, extra radii), use an on-scale raw value (multiples of 4 or 8), record it as an exception and report the library gap. Never flatten the layout to fit the tokens available | Landing and consumer screens need display type and 64 to 120px section spacing; the fix for the library is `sync` or `build-library`, not a worse screen | S22 |

## Process

| ID | Rule |
|---|---|
| P01 | Write the brief before frames: user, job, primary action, platform, success |
| P02 | Content inventory first: every element traces to a user need, or it is cut |
| P03 | Defaults review of the structure plan: "would I produce this for any similar screen?" |
| P04 | Reuse existing components, variables and styles before creating; componentize repeats |
| P05 | Subtract pass: for each element ask what is lost if it goes; remove only what you can name as redundant or decorative (never brief content or platform chrome); log removals. Nothing found is a valid result |
| P11 | Cover the brief: list everything it asks for; the main frame shows each item and the central interaction in its populated state (selection, cart, open menu). Other states go in extra frames, but the main frame is judged alone |
| P06 | State matrix per screen (empty, loading, error, partial, success, permission, offline where relevant) and edge content |
| P07 | Consistency across screens: the same component is used the same way |
| P08 | Review in a fresh context; fix the highest-severity findings (related ones together), at most 2 rounds, ask whether the new version is better, keep the better one. Scores are advice, not a gate |
| P09 | Findings carry severity P0–P3 and cite rule IDs; list what was not verified |
| P10 | Waivers and overrides are written with a reason in DESIGN.md `Project decisions` |

## Icon and description decision tables

**Icon in a button** (Atlassian, Carbon, GOV.UK, Apple HIG, Material, NN/g; none names "icon in every button" explicitly, so this is derived from adjacent guidance):

| Situation | Icon? |
|---|---|
| Clear verb-phrase label ("Save changes", "Continue"); primary or submit button | No |
| Universal action with a well-known glyph (search, add, download, share) that adds affordance | Optional: one, leading |
| Icon encodes what the label cannot: external link, dropdown caret, forward/back direction | Yes |
| Space-constrained toolbar or repeated row actions | Icon-only, with accessible name and tooltip |
| Navigation, tab bar, sidebar | Icon **and** visible label |
| Destructive action | Text label; never icon-only |
| Ambiguous glyph (heart, star, filter, clock, custom) | Label only |
| Sibling buttons in one group | All or none |
| Decorative sparkle or arrow with no meaning | No |

**Description under a title** (Atlassian, Polaris, GOV.UK, Apple HIG, NN/g):

| Situation | Description? |
|---|---|
| Title self-explanatory in context ("Customers", "Billing") | No |
| Description paraphrases the title | No |
| First-use empty state | Yes: why it is empty, then the next step (1–2 sentences) |
| Form field with non-obvious format or a reason for asking | Yes: one short hint under the label |
| Consequence or irreversibility not obvious from the title | Yes |
| List rows differ in ways the title does not show and the secondary text is data (date, owner, status) | Yes, as metadata, not a sentence |
| Every row would carry the same-shaped sentence | No; show it only where content differs |
| Long explanation | Details disclosure, help link or detail view |
| Needed to complete the task | Inline, never only in a tooltip |

**Redundancy test — all three must pass or delete:** (1) *Deletion:* remove it; does the target user lose information or confidence? (2) *Paraphrase:* do its nouns and verbs reduce to the title's? (3) *Uniformity:* if most siblings carry same-shaped descriptions, keep only those where content actually differs.

## Per-project decisions

These differ between the best design systems, so never bake them in globally; DESIGN.md `Project decisions` records the choice: casing (default sentence case; Vercel uses Title Case, Atlassian/GOV.UK/Carbon sentence case) · icon policy and side · bordered or flat cards · 4 or 8 px base · display-font policy · dark by default · monospace for metrics · ALL-CAPS micro-labels · description density.

## Sources and confidence

Convergent across Anthropic's frontend-design skill, Impeccable, Vercel's Web Interface Guidelines, Google's DESIGN.md spec and Atlassian's DESIGN.md: C01, C03, C04, C08, C09, L04, L06, L07, K02, K06, K07, K14, T02, T03, T04, P03, P05. Derived from design-system and NN/g guidance rather than a named tell: C02, K02, K03. Lower confidence (source pages not fully verified: Material 3, Polaris; judge-bias claims): K05 counts, L08. No public study shows any rule set reduces slop; measure with `evals/`.
