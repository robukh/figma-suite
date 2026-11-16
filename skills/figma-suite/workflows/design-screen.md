# Workflow: Design Screen

Design a screen or flow the way a senior product designer would: from the user's job and a content inventory, using the project's own components and tokens, subtracting before decorating, and reviewed by someone who did not build it. Figma's official skills own the mechanics; this workflow owns the judgment.

**Contents:** [Load first](#load-first) · [Phases](#phases) · [Running the slop scan](#running-the-slop-scan) · [The critique loop](#the-critique-loop) · [Report](#report) · [Flows](#multi-screen-flows) · [Updating a screen](#updating-an-existing-screen) · [Prototyping](#prototyping-only-if-asked)

## Load first

1. `figma-use` and `figma-generate-design` ([official-skills.md](../reference/official-skills.md)); `create_session` for the target design file.
2. [craft-floor.md](../reference/craft-floor.md). Re-read it at the start of each major section, because long sessions drift back toward defaults.
3. On demand: [anti-slop.md](../reference/anti-slop.md), [ux-checklist.md](../reference/ux-checklist.md), [critique-rubric.md](../reference/critique-rubric.md).

## Phases

**0. Load context.** Read the project snapshot: DESIGN.md, mapping files, config. If the contract is **STALE**, offer `sync` first. If DESIGN.md is missing, derive a flagged draft ([design-md.md](design-md.md)) and continue; do not block. Pick the mode from DESIGN.md, or by the brief: `operate` for work tools, `consumer` for mobile and lifestyle apps, `persuade` for marketing and landing pages, `read` for content. Pick the target design file (ask only if there are several).

**1. Brief.** One sentence each: user, job ("when ___ the user wants ___ so they can ___"), primary action, platform, success. Look for existing specs (`docs/specs/`, `docs/wireframes/`), code for the same screen, and an existing Figma screen (`get_metadata`). List the screen's states. **Write the brief-coverage list:** every item the brief asks for, plus the platform's chrome (mobile: status bar, home indicator, tab bar when the app has several top-level destinations, nav bar; web app: navigation shell; landing page: nav and footer). The main frame must show all of it, and the brief's central interaction in its populated state.

**2. Content inventory.** List every piece of content with its user need and a verdict: *must-say*, *can-defer*, *cut*. Pull real copy from specs; invent realistic data (short, typical, very long). Plan the state frames. **Checkpoint:** show the user the brief, the inventory and the structure from phase 3 in one compact message and get one go-ahead. After that, build without further questions unless something blocks. If no user can answer (an autonomous or delegated run), state your assumptions at the top of the report and continue; do not stall.

**3. Structure plan.** Describe the layout in text: platform chrome, regions, order by priority, the one focal point, the one primary action, at most five content groups and four options per decision point, and how the screen fills its viewport with the content the product would really show. Then run the defaults review: "would I produce this for any similar screen?" Change what is generic. Check the plan against the ux-checklist (needs, states, flows).

**4. Hierarchy.** Choose the text styles per level (≤4 sizes on product screens; consumer and marketing screens may add one display size), spacing by role, and the alignment axis. Squint test the plan.

**5. Build.** Follow `figma-generate-design` for discovery (Code Connect → libraries → whole-frame inventory → gap search), for the wrapper frame, for componentizing repeats, and for the build in retry-safe phases. figma-suite specifics:
- Resolve each code component to its Figma component through `component-mappings/{id}.json`; set variants and text through `propertyMap.values` (the code value `"primary"` becomes Figma `Type=Primary`). `figma-only` components are used as-is; `code-only` ones have no Figma node.
- Respect DESIGN.md `components:` policy (allowed variants, icon policy) and `Project decisions`.
- Bind every fill, stroke, radius, padding side and gap to the role-correct semantic variable; apply Text Styles; every container of related children is auto-layout ([component-craft.md](../reference/component-craft.md)).
- Icons come from the design system's icon component or the codebase SVG. Use them where the platform or task expects them (tab bar, media controls, toolbars, scannable list rows). If the library lacks an icon you need, create a minimal icon component on your page (one stroke weight, 16/20/24 grid, `createNodeFromSvg`) rather than substituting text. Do not put one in every button.
- Assert the product font family after building (the official skill's read-back).
- Build the state frames from phase 2 next to the main screen, named `<Screen> / <state>` (for example `Team settings / Invite open`).
- **When the system lacks something you need, do not flatten the design to fit.** A missing spacing tier or display type size: use an on-scale raw value (multiples of 4 or 8; landing pages need 64 to 120px section spacing and a display size), record it as an exception and report the library gap (offer `sync` or `build-library` afterwards). A missing component variant (for example a destructive Button): use the nearest variant, override only the minimum (a bound semantic color), record it, and propose the variant. Local helper components for repeated rows and missing icons are allowed on your own page (componentize repeats, per `figma-generate-design`); do not edit the library's components or variables during `design` unless asked.
- **Platform chrome and density:** build the chrome from phase 1 (status bar, tab bar, nav) so the screen reads as a real app screen, and fill the viewport with realistic content; if the bottom third of a mobile screen is empty, something the product would show is missing.
- A change to a main component may not reach instances that already carry overrides; re-check placed instances after editing a component.

**6. Mechanical gate.** Run the slop scan ([below](#running-the-slop-scan)). Fix every `error`; list `advisory` findings. A waiver needs a written reason and goes in the report (and in DESIGN.md `Project decisions` if it is a standing decision).

**7. Subtract pass.** For each badge, border, subtitle, card, metric and repeated label ask "what is lost if this goes?" and remove what you can name as redundant or decorative, using the redundancy test in [anti-slop.md](../reference/anti-slop.md#icon-and-description-decision-tables). Never remove brief content, platform chrome or icons the platform expects. Finding nothing to remove is a valid result; log what you removed.

**8. Critique.** The [critique loop](#the-critique-loop) in a fresh context.

**9. States and handoff.** Confirm the state frames exist (or are marked "n/a — reason"), add annotations only where behavior is not visible (interactions, open decisions), and write the report. One composition screenshot and one after a visual fix; the latest passing screenshot is final.

## Definition of done

Before reporting, confirm each (a skipped item goes in "not verified"):
- [ ] The brief-coverage list is fully visible in the main frame, including the platform chrome and the central interaction in its populated state.
- [ ] The slop scan ran **after the last edit** with 0 errors (bans). Advisories are read, not all fixed.
- [ ] The subtract pass ran and its removals (if any) are logged.
- [ ] The critic reviewed in a fresh context; scores are reported as they are (advisory, not a gate) with the open findings.
- [ ] The product font was asserted, and state frames exist or are marked n/a with a reason.
- [ ] Project facts in DESIGN.md are validated (`check-contract.mjs --design-md <file>` when there is no workspace).

## Running the slop scan

1. Open `scripts/slop-scan.min.js` (same checks as the readable `slop-scan.js`, about a third smaller; the readable file is the source and what you read when a finding looks wrong). Set `ROOT_IDS` (the screen frame and its state frames; they must be on the same page), `PLATFORM` (`"desktop"` or `"touch"`), `CASING`, and optionally `ALLOW` (rule IDs waived with a reason). Edit only those constants.
2. Run it through `use_figma` as the **whole** script (read-only; it returns `{ findings, counts, truncated }` and mutates nothing). Put every frame (screen and state frames) in `ROOT_IDS` so the scan runs once, then once more after the last edit. Do not paste a trimmed copy to save tokens: a partial scan is not a scan, and the checks you drop are the ones you will miss. It switches to the frame's page itself; check that `scanned` roughly matches the node count you expect.
3. Fix `error` findings by editing the design, re-run. The scan is mechanical: it cannot judge taste, which is what phase 8 is for. Findings that look wrong are reported as such (a false positive tuned out via `ALLOW` with a reason), not silently ignored.

## The critique loop

Follow [critique-rubric.md](../reference/critique-rubric.md): spawn the critic in a fresh context with the brief, DESIGN.md and the frame's `fileKey`/`nodeId`; it reviews before seeing scan output, scores six dimensions 0–4 and returns P0–P3 findings with rule IDs. Fix the highest-severity findings (related ones can go in the same round), at most two rounds, and ask the critic whether the new version is better than the previous one. Keep the better version.

## Report

Return a compact report: brief; what was reused (components, variables, styles); scan result (errors fixed, advisories, waivers); removals from the subtract pass; critic scores and open findings; **not verified** (dark mode, real data, prototype, other platforms). No lengthy narration.

## Multi-screen flows

Build each screen through phases 3–9, then check the flow: shortest path to the goal, entry/next/recovery on every screen, the same component behaving the same everywhere, consistent vocabulary, destructive steps confirmed once. Arrange left to right with a consistent gap, label transitions ("Tap Continue"), and group the screens in a named section. In FigJam use connectors; in Design files use arrows.

## Updating an existing screen

Read it first (`get_design_context`/`get_metadata`) and screenshot it. Identify sections to add, change or remove; confirm before deleting anything. Prefer `swapComponent()` for compatible swaps, keep x/y/size of children in non-auto-layout parents, then run phases 6–8 on the result.

## Prototyping (only if asked)

Add connections with `use_figma` (tap triggers, Navigate To / Back / Open Overlay, Smart Animate preferred), set the starting frame, and describe the interaction sequence. Motion states what changed; at most one authored moment; 150–250 ms for product UI.
