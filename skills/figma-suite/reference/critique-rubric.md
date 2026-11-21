# Critique Rubric and Critic Brief

How screens are reviewed in a **fresh context** and scored. Self-critique is too agreeable, so the review runs in a separate subagent that has not seen the build conversation. Used by `design` (phase 8) and `audit`.

**Contents:** [Loop](#loop) · [Dimensions](#dimensions-score-04-each) · [Findings](#findings) · [Critic brief](#critic-brief-copy-into-the-subagent-prompt) · [Calibration](#calibration)

## Loop

1. Run `slop-scan.js` first (mechanical errors block; see [design-screen.md](../workflows/design-screen.md)). Do **not** give its output to the critic yet — findings anchor judgment.
2. Spawn the critic with the brief below. It does its own review, then receives the scan output and merges.
3. Fix the highest-severity findings first; related findings may share a round. At most **2 rounds**.
4. After a round, ask the critic to compare the new version with the previous one ("is it better, and why?") rather than re-scoring from scratch; absolute scores are noisy and generous.
5. Keep the better version, not necessarily the last. Stop early when there are no P0/P1 findings.

**Scores are advice, not a gate.** In the first broad evaluation the old 17/20 bar was reached once in ten runs, and chasing it pushed agents to cut content and chrome. Report the scores and the open findings as they are, and state which findings you chose not to fix and why. Block only on: an open P0/P1, a ban from [anti-slop.md](anti-slop.md), or an item from the brief that is missing from the main frame.

## Dimensions (score 0–4 each)

Score separately; one blended number hides problems.

| Dimension | 4 | 2 | 0 |
|---|---|---|---|
| **Job and content** | Primary action obvious; every element serves a named need; copy specific and realistic | Purpose clear but some elements have no need or copy is generic | Cannot tell what the screen is for |
| **Completeness and platform fit** | Everything in the brief is visible in the main frame, the central interaction is shown in its populated state, platform chrome is present, the screen is filled with realistic content | One brief item or chrome element missing, or the screen feels sparse | Reads as a fragment or wireframe; key brief items absent |
| **Hierarchy** | One focal point, clear reading order, passes the squint test | Order mostly clear; two elements compete or levels blur | Flat; everything equal |
| **Restraint** | Nothing removable without loss; icons, badges, borders, cards each justified | Several decorative or repeated elements | Decoration dominates (tells from [anti-slop.md](anti-slop.md) all over) |
| **System fidelity** | Components and variables used, fully bound, matches DESIGN.md and mapping | A few raw values or off-spec edits | Rebuilt components, raw hex everywhere |
| **Craft** | Aligned, rhythm from the scale, all states and edge content present, accessible | Minor misalignment or missing states | Broken layout, clipped text, missing states |

## Findings

Each finding: **severity** (P0 blocks use or breaks the system · P1 clearly wrong · P2 should fix · P3 polish), **rule ID** from anti-slop.md or a heuristic name, **where** (node name and id), **what** and **why it matters**, **suggested fix** (one sentence). End the review with a **Not verified** list (for example: dark mode not checked, no real data tested, prototype not reviewed).

## Critic brief (copy into the subagent prompt)

> You are a senior product designer reviewing one screen. You have not seen how it was made. Be skeptical: LLM-generated UI is usually busier and more generic than it looks, and reviews of it tend to be too generous.
>
> Inputs: the brief (user, job, primary action, platform), the project's DESIGN.md, the Figma `fileKey` and `nodeId` of the screen. Use read-only tools only (`get_screenshot`, `get_metadata`, `get_design_context`, read-only `use_figma`); never mutate the file. Take one screenshot and read the node tree.
>
> 1. Without looking at any tool report, review the screen against the brief and DESIGN.md. Apply the squint test. For every icon, badge, border, subtitle, card and metric ask what is lost if it goes; say which could be removed.
> 2. Check the content: does each text node serve a stated need? Are titles restated by descriptions? Are button labels verb + object? Is data realistic?
> 3. Check completeness first: list what the brief asks for and what the platform's chrome should include (mobile status bar, tab or nav bar, home indicator; web navigation shell; landing nav and footer), then say what is missing from the main frame. A screen that looks unfinished or wireframe-like should lose points even when it is tidy. Do not reward removal for its own sake: fewer elements is only better when nothing the product needs is missing.
> 3b. Score the six dimensions 0–4 with a one-line justification each, using the rubric anchors.
> 4. List findings as P0–P3 with rule IDs, locations, fixes. Most valuable first. Maximum 12.
> 5. State what you did not verify.
> 6. If given a previous version, say which is better and why before anything else.
>
> Do not praise. Do not invent problems to look thorough; "none found" is a valid result for a dimension.

Run the critique in a fresh-context subagent when the host provides one (Claude Code: `Agent`; OpenCode: its subagent tool). If no subagent tool is available, run the same steps yourself after clearing your assumptions: re-read only the brief and DESIGN.md, take a fresh screenshot, and state that the review was not independent.

## Calibration

When the project has golden reference screens (DESIGN.md → Reference screens), include one or two with their scores in the critic prompt: scored examples calibrate the judge better than any rubric text. Watch for judge bias toward busy designs: if scores rise while the screen gets denser, trust the Restraint dimension and the slop scan over the total.
