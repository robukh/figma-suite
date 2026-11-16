# UX Checklist

What a senior product designer settles before and while drawing, as questions an agent can answer from a brief, a screenshot and a node tree. Used by the `design` workflow (phases 1–4, 9), the critic, and `audit`.

**Contents:** [Needs first](#1-needs-first) · [Structure](#2-structure-and-hierarchy) · [States](#3-states-matrix) · [Data realism](#4-data-realism) · [Accessibility floor](#5-accessibility-floor-wcag-22-aa) · [Heuristics](#6-heuristics-per-screen) · [Subtract heuristics](#7-subtract-heuristics) · [Flows](#8-multi-screen-flows)

## 1. Needs first

- **Job story:** "When ___, the user wants to ___, so they can ___." If you cannot write it, you are not ready to draw.
- **Primary action:** the one thing this screen exists for. Name it. Everything else supports or defers to it.
- **Content inventory:** list every piece of content. Mark each *must-say*, *can-defer* (progressive disclosure) or *cut*, and the user need it serves. Cut anything with no need.
- **Platform:** conventions follow the destination (iOS tab bar and back swipe, Material bottom nav, web top nav). Do not mix platforms.

## 2. Structure and hierarchy

- Order content by priority, not by the order it was thought of. Top and leading edge first.
- One dominant element, then secondary, then tertiary. Two elements competing to be loudest is a defect.
- Hick: fewer choices decide faster — at most 4 visible options per decision point; Miller: chunk runs longer than about 7.
- Fitts: the primary target is large and near its context.
- Gestalt: proximity and common region group before borders do.
- Progressive disclosure: two levels at most; never hide something the task needs.
- Squint test on a blurred screenshot: title, primary action and groups still identifiable.

## 3. States matrix

For every screen, a frame or an explicit "n/a — reason" for each: **empty** (first use, no results, cleared), **loading** (skeleton, not a spinner over nothing), **error** (what failed + next step), **partial** (some data failed), **success**, **permission denied**, **offline**. Interactive components also need default, hover, focus, active, disabled. A screen with only the happy path is unfinished.

## 4. Data realism

Design with realistic names, numbers and dates at three lengths: short, typical, very long (a 60-character name, a 7-digit amount). Show 1, 5 and 1,000-row behavior for lists and tables (pagination, virtualization hint, empty). Decide truncation vs wrapping; do not leave it to chance. Mixed locales and RTL where the product supports them.

## 5. Accessibility floor (WCAG 2.2 AA)

Text contrast ≥4.5:1 (large text and UI parts ≥3:1) · targets ≥24px (44px on touch) · visible focus state · meaning never by color alone · labels visible (a placeholder is not a label) · logical heading order · icon-only controls have names.

## 6. Heuristics per screen

Nielsen's ten as questions; the highest-yield ones first: Is system status visible? (Recognition over recall) Can the user see options instead of remembering them? Is it consistent with the rest of the product? Is error prevention built in, with undo preferred to a confirm dialog? Is anything irrelevant on screen (aesthetic and minimalist design)? Score each 0–4 only when asked ([critique-rubric.md](critique-rubric.md)).

## 7. Subtract heuristics

For the subtract pass (phase 7). Ask of each element: *what is lost if this goes?*
1. Delete borders, fills and icons that carry no information; replace separators with spacing.
2. Merge a label into its value ("12 left in stock", not "In stock: 12"); labels are a last resort.
3. Emphasize by de-emphasizing everything else, instead of making the target louder.
4. Cut every word that does not need to be there.
5. Frequently seen things get no flourish.
6. Spend boldness in one place; remove one accessory before finishing.
7. Chrome recedes; content leads.

## 8. Multi-screen flows

Is the flow the shortest path to the goal? Does each screen have an entry, a next step and a recovery path? Does the same component behave the same on every screen (names, placement, states)? Is label vocabulary consistent across the flow? Are destructive or irreversible steps confirmed once, and only once?
