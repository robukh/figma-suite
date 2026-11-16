# Evals

Three layers, from cheapest to most expensive.

## 1. Deterministic tests (no Figma, run any time)

```bash
node evals/fixtures/contract.test.mjs    # check-contract.mjs: seeded breaks + freshness
node evals/fixtures/slop-scan.test.mjs   # slop-scan.js against a mock Figma node tree
SCAN_FILE=slop-scan.min.js node evals/fixtures/slop-scan.test.mjs   # the minified build; regenerate with node scripts/build-slop-scan-min.mjs (needs bun) after editing slop-scan.js
node evals/check-links.mjs               # every relative markdown link and #anchor resolves
```

`evals/fixtures/acme/` is a complete sample workspace (config, three mapping files, token CSS, DESIGN.md) and doubles as the reference for the DESIGN.md format.

## 2. Behavior evals (`evals.json`, needs a throwaway Figma file)

Follow the skill-creator method: for each case run `old_skill` (git tag `v1.4.0`), `without_skill` (official Figma skills only) and `new_skill`, three runs each, and grade the assertions. Gates (listed at the top of `evals.json`) block acceptance on any failure. Cases marked `needs_figma` need a small design system file: a Primitives and Semantic variable collection, Button (Type, Size, Disabled, Label) and Card (Content slot) components published as a library, plus a design file with a Dashboard screen that contains planted defects (raw hex, a primitive binding, a detached instance, a `✕` text glyph, an eyebrow, a nested card). Never run write cases against a real project file.

Accept the new skill when: every gate and correctness assertion matches or beats `old_skill`; loaded tokens per run drop at least 30%; trigger cases (case 12) are measured separately from compliance.

## 3. Slop evals (the field has no published evidence; measure yourself)

15 to 20 varied screen briefs (settings, dashboard, table, form, empty state, onboarding, modal flow). Arms: no skill, v1.4.0, new skill, and new skill minus each component in turn (brief + inventory, slop scan, subtract pass, critic) to learn which parts earn their cost. Metrics:

- `slop-scan` error and advisory counts per screen, and specifically icons per button (S01) and description-under-title findings (S03).
- Blind pairwise human preference (which of two screens is better) on a held-out set of briefs not used while tuning the rules.
- Judge bias: check whether the critic prefers denser variants; if scores rise as screens get busier, down-weight the total and trust Restraint and the scan.
- Cost: tokens and `use_figma` calls.
- `slop-scan` false positives: log every finding a human rejects; tune thresholds and keep unproven checks at `advisory`.
