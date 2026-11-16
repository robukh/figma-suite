# DESIGN.md Template

The project's design contract, in the open DESIGN.md format (Google Stitch spec: YAML tokens for the exact values, prose for the why) extended with figma-suite fields. It lives at the repo root so code agents and figma-suite read the same file; standalone projects keep it in the workspace.

**Contents:** [Ownership](#ownership) · [Template](#template) · [Extensions](#figma-suite-extensions) · [Derive vs ask](#derive-vs-ask) · [Rules for editing](#rules-for-editing) · [Checks](#checks)

A complete working example: `evals/fixtures/acme/DESIGN.md`.

## Ownership

| Part | Owner | Written by |
|---|---|---|
| Front matter token groups `colors`, `typography`, `rounded`, `spacing` | token source | **generated** by setup/sync, between `# figma-suite:generated tokens` and `# /figma-suite:generated` comment lines |
| "Figma bindings" section | live Figma file + mapping | **generated**, between `<!-- figma-suite:generated bindings -->` and `<!-- /figma-suite:generated -->` |
| `name`, `mode`, `description`, `components:` | the team | authored |
| All other prose sections | the team | authored; sync may only *propose* edits |

## Template

````markdown
---
name: <Product>
mode: operate            # operate | consumer | persuade | read
description: <one line: what it is, for whom, how it should feel>
# figma-suite:generated tokens
colors: { }              # name -> "#hex"; referenced as {colors.name}
typography: { }          # name -> { fontFamily, fontSize, fontWeight, lineHeight }
rounded: { }
spacing: { }
# /figma-suite:generated
components:
  <mapping-id>:          # must equal a component-mappings/<id>.json id
    use: <when to use it, one sentence>
    variants: [ ]        # allowed variants; must exist in the mapping's enum values
    icon: none           # none | leading | trailing | icon-only
    backgroundColor: "{colors.…}"   # optional style tokens (Google spec fields)
    textColor: "{colors.…}"
---

## Overview          Product, audience, job, mode and why; 3 personality adjectives.
## Colors            The accent and what it is reserved for; neutrals; status colors and their non-color cue.
## Typography        Families, the scale, max sizes per screen.
## Layout            Base unit, grid, max widths, spacing rhythm, density.
## Elevation         Planes and shadows; "flat" is a valid answer.
## Shapes            Radius by component role.
## Components        Usage rules beyond the front matter: button hierarchy, icon policy, badge policy, card policy.
## Icons             Library, stroke, sizes, where icons are and are not used.
## Motion            Only if prototypes are in scope.
## Accessibility     Target level (WCAG 2.2 AA default), focus, touch targets.
## Voice and content Casing, vocabulary glossary, banned words, empty/error/confirm templates, number and date formats.
## Project decisions Each override of an anti-slop default, with who confirmed it. Mark `inferred` until confirmed.
## Figma bindings    (generated) library keys, collections, component node ids.
## Reference screens 2–3 golden screens (file + node id) as positive examples, with what to copy from each.
## Open decisions    Questions the team has not settled.
## Do's and Don'ts   ≤10 testable lines, specific to this product.
````

Required sections (the contract check errors without them): Overview, Colors, Typography, Layout, Components, Voice and content, Project decisions, Do's and Don'ts. Keep that order for the first seven standard sections.

## figma-suite extensions

Google's spec has no equivalent for these, so they are extra front matter keys (the Google linter may warn `unknown-key`; ours accepts them): `mode`; per component `use`, `variants`, `icon`. Component keys are mapping ids (kebab-case), not display names. Never duplicate props, Figma keys or node ids in `components:`; those live in the mapping and the generated bindings block.

## Derive vs ask

Repository evidence is a hypothesis: mark every derived fact `inferred` until the team confirms it.

| Auto-derive from code and Figma | Ask the user (≤3 questions per round) |
|---|---|
| Tokens (CSS vars, Tailwind, DTCG, Figma variables) | Audience, job to be done, `mode` |
| Component inventory, variants, icon library in use | 3 personality adjectives; references to follow or avoid |
| Existing copy: casing, button vocabulary (grep strings) | Icon, badge and density policy |
| Density (row heights, padding statistics) | Voice, banned words, glossary |
| Breakpoints, platform, framework | Locales, RTL, accessibility target |
| Candidate golden screens (most-instanced frames) | Hard constraints (legal text, brand rules) |

## Rules for editing

- Every ban in [anti-slop.md](anti-slop.md) needs a positive decision here: say what to use, not only what to avoid ("flat cards with no border" beats "no shadows").
- Overrides name the rule: "K02: icon on Add task button (confirmed)".
- Keep it short and non-obvious. Do not restate what the code already says; long files cost tokens without improving output.
- Hand edits belong in authored sections. Edits inside generated blocks are overwritten by sync and flagged by the contract check.

## Checks

The contract check ([SKILL.md → Commands](../SKILL.md#commands-defined-once-workflows-say-run-the-contract-check)) verifies: front matter parses; required sections exist; `mode` and `icon` values are valid; every `{token.ref}` resolves; each `components:` id has a mapping file; allowed `variants` exist in the mapping; component text/background contrast ≥4.5:1; authored sections are not empty; and freshness against `state.json`.
