# Workflow: design-md

Create or refresh the project's `DESIGN.md` — the design contract's authored half. Used by `setup` (first draft), on demand, and by `design` when the file is missing.

**Contents:** [Create](#create-a-new-designmd) · [Refresh](#refresh-an-existing-designmd) · [Interview](#interview) · [Finish](#finish)

Structure, ownership and rules: [design-md-template.md](../reference/design-md-template.md). Overrides must use IDs from [anti-slop.md](../reference/anti-slop.md).

## Create a new DESIGN.md

1. **Derive** (no questions yet). From the token map, mappings and code:
   - Front matter `colors`, `typography`, `rounded`, `spacing` from the token source, inside the generated markers; token names become `{colors.name}` references.
   - `components:` — one entry per mapping id with status `matched`, `split`, `merged` or `diverged`: `variants` from the mapping's enum values, `icon` from how the component is used in code (does the Button ever get an icon prop in practice?), `use` left as a first guess.
   - Voice and content from grep over UI strings: dominant casing, the verbs used on buttons, existing empty/error phrasing, banned-looking words.
   - Density from row heights and padding statistics; icon library from dependencies; golden reference screens as the most-instanced frames in the design files.
   - A Figma bindings block from `config.libraries`, collection names and component node ids.
2. **Mark** every derived judgment `inferred`.
3. **Write** DESIGN.md at `designMdPath` now, before any question. Run the contract check, fix errors, then run it with `--write-state` once clean.
4. **Ask** the few things that cannot be derived ([Interview](#interview)), all in one batch, and write the answers into the file as *confirmed*. If no one can answer, the file stays `inferred`.
5. Show a short summary: the mode chosen, the icon, casing and card decisions recorded, and the items still `inferred`.

## Refresh an existing DESIGN.md

- Rewrite only the generated blocks (tokens, bindings) from the current token source and mapping.
- For authored sections, produce a **suggested diff**: new components missing under `components:`, removed components, new variants not yet covered by policy, golden screens that no longer resolve, `inferred` items that code now confirms. Apply only what the user approves.
- Never delete a `Project decisions` line; mark it superseded and say by what.

## Interview

After the file is written. At most three questions per round, recommended answer first (use `AskUserQuestion`). Ask only what cannot be derived:

1. **Product** — who uses it, what job, which mode (`operate` for tools used repeatedly; `consumer` for mobile and lifestyle apps; `persuade` for marketing; `read` for content). Three adjectives for how it should feel.
2. **Taste decisions** — only those the code does not settle: icons in buttons (none / meaningful only / always), badge policy, card style (flat or bordered), casing, description density. Offer the best-system default as the recommended option.
3. **Constraints** — voice and banned words, locales/RTL, accessibility target, legal or brand rules.

Record each answer under `Project decisions` as a positive decision with the rule ID it overrides, marked *confirmed*.

## Finish

Run the contract check; the file must parse, contain the required sections, have resolving token references, and map every `components:` id to a mapping file. Offer `update-guide` to publish a Foundations page in Figma from the file.
