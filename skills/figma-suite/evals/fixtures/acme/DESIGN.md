---
name: Acme Tasks
mode: operate
description: Task manager for small teams. Dense, calm, keyboard-first.
# figma-suite:generated tokens (rewritten by `sync`; do not hand-edit)
colors:
  action-primary: "#1a56db"
  on-action: "#ffffff"
  surface: "#ffffff"
  text-primary: "#111827"
typography:
  body: { fontFamily: Inter, fontSize: 14px, fontWeight: 400, lineHeight: 20px }
  heading: { fontFamily: Inter, fontSize: 20px, fontWeight: 600, lineHeight: 28px }
rounded:
  sm: 4px
  md: 8px
spacing:
  gap-inline: 8px
  gap-stack: 16px
# /figma-suite:generated
components:
  button:
    use: Every action. One primary per section; the rest are secondary or ghost.
    variants: [primary, secondary, ghost]
    icon: none
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.md}"
  card:
    use: A unit the user opens, moves or acts on as a whole. Never a generic wrapper.
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
---

## Overview

Acme Tasks is a work tool used all day by project leads, so the interface stays quiet and familiar. Mode is `operate`: standard controls, no decoration, every state designed. Personality: calm, precise, fast.

## Colors

One accent (`action-primary`) for the primary action, selection and links. Everything else is neutral. Status colors always pair with an icon or label.

## Typography

Inter. Four sizes at most per screen: heading, body, caption, and one display size on empty states.

## Layout

8px base. Content max width 1120px. Group with spacing before borders; more space above a heading than below it.

## Elevation

Flat. One shadow level for floating layers (menus, dialogs) only.

## Shapes

`rounded.md` for containers and buttons, `rounded.sm` for inputs and tags.

## Components

Usage policy lives in the front matter (`components:`); structure lives in `component-mappings/`. Buttons carry no icons by default; see Project decisions for the exceptions.

## Voice and content

Sentence case everywhere. Buttons are verb + object ("Save changes", "Assign task"). Errors say what failed and what to do next, without apology. No greetings, no exclamation marks. Empty states: one sentence on why it is empty, one action.

## Project decisions

These earn back anti-slop defaults. Each is confirmed by the team unless marked `inferred`.

- Casing: sentence case (confirmed).
- Icons in buttons: only `+` on "Add task" and an external-link glyph on "Open in browser" (confirmed). Navigation items always carry icon plus label.
- Cards: flat surface with `rounded.md`, no border, no shadow (confirmed).
- Descriptions under titles: allowed in empty states and on settings rows where the description states a consequence (confirmed).
- Dark mode: follows the system setting via variable modes (inferred).

## Figma bindings

<!-- figma-suite:generated bindings -->
- Library: Acme DS (`LIBFILEKEY`), collections: Primitives, Semantic
- button -> node 12:345, card -> node 12:400
<!-- /figma-suite:generated -->

## Reference screens

- Task list (node `20:100` in Acme Screens): the density and hierarchy to match.

## Open decisions

- Whether bulk actions get an icon-only overflow menu (inferred: yes).

## Do's and Don'ts

- Do keep one primary action per section.
- Do show real task titles, owners and dates in designs.
- Don't add a description under a title that restates it.
- Don't add an icon to a button whose label already says the action.
- Don't nest cards or add badges for decoration.
