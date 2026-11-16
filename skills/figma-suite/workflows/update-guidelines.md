# Workflow: Update Guidelines

Keep the project's written design guidance and its Figma documentation pages in agreement. DESIGN.md is the authored source; Figma gets a Foundations page and component notes; code docs (a design-system guide, JSDoc) can be updated from Figma annotations.

Load first: `figma-use` ([official-skills.md](../reference/official-skills.md)); `create_session`. Structure: [design-md-template.md](../reference/design-md-template.md).

## Directions

| Direction | Source | Destination |
|---|---|---|
| DESIGN.md → Figma | DESIGN.md (front matter and prose) | Foundations page, component descriptions, annotations |
| Code docs → Figma | `docs/design-system/GUIDE.md`, README, component docs | same |
| Figma → DESIGN.md / code docs | Figma annotations, component descriptions, page notes | DESIGN.md proposals (authored sections), guide, JSDoc |

In standalone mode DESIGN.md plays the role of the code docs.

## 1. Discover

- DESIGN.md at `designMdPath`; in code: `docs/design-system/GUIDE.md`, `docs/design-guide.md`, component docs; in Figma: pages named Foundations, Styles, Guidelines or Documentation, component descriptions, annotations (`get_design_context` includes annotations when present).
- Extract structured topics: typography scale, spacing, color semantics, radius rules, layout patterns, component specs, voice and content rules, project decisions.

## 2. Compare

| Topic | Source | Figma | Status |
|---|---|---|---|
| Typography scale | 10 sizes | 8 documented | Figma missing 2 |
| Project decisions | 5 | not documented | Missing in Figma |

Show the table and ask which updates to apply. Tokens are not compared here; `sync` owns them.

## 3. Apply to Figma

On a **Foundations** page, build with variable-bound content (reuse the build rules in [build-library.md](build-library.md)): color swatches (light and dark side by side, name + hex + usage), type samples (`text-heading / Inter SemiBold / 20/28 — Page title`), spacing blocks, radius samples, and a **Principles** frame with the Overview, Voice and content, and Project decisions text. On each component page: a description on the component set (purpose, when to use, accessibility), a short usage block taken from `components:` policy (allowed variants, icon policy), and Do/Don't examples if DESIGN.md has them. Add annotations where behavior is not visible.

## 4. Apply to code or DESIGN.md (Figma → text)

Read annotations and descriptions, then **propose** a diff: new sections or lines in the code guide or in DESIGN.md's authored sections (never in generated blocks). Show the diff and write only after approval.

Merge strategy: both agree → no change; text side has more detail → keep it and flag Figma as outdated; Figma has more → propose an addition; conflict → show both and let the user choose.

## 5. Validate

Re-read both sides, confirm approved updates landed, run the contract check, and summarize: updated in Figma, updated in text, remaining gaps.
