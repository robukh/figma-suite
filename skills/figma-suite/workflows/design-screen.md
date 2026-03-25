# Workflow: Design Screen

Compose new screens or flows in Figma by reusing the published design system — components, variables, and styles.

---

## When to Use

- "Design a settings page" — create from a text description
- "Build the onboarding flow" — compose multiple connected screens
- "Recreate this wireframe in Figma" — translate wireframe/sketch to high-fidelity design
- "Update the dashboard layout" — modify an existing screen

---

## Phase 0: Understand the Screen

1. **Parse the user's request** — what screen, what content, what purpose
2. **Check for existing specs** — look for:
   - Feature specs in `docs/specs/` (if configured or discoverable)
   - Wireframes in `docs/wireframes/` or `wireframes/`
   - Existing code for the screen in the codebase
3. **Check for existing Figma screens** — call `mcp__figma__get_metadata` to see if this screen already exists
4. **Determine scope**:
   - Single screen → build in one pass
   - Multi-screen flow → build each screen, then connect with arrows/annotations

Present the plan to the user before building.

---

## Phase 1: Discover Design System

Before building anything, inventory available design resources from all configured libraries (`config.libraries[]`).

### Components
For each library, call `mcp__figma__search_design_system` to find:
- All published components and their variants
- Component property definitions
- Instance swap slots

**Index what's available across all libraries.** Never recreate a component that already exists in any library.

### Variables
For each library, call `mcp__figma__get_variable_defs` to get:
- All color variables (light/dark modes)
- Spacing variables
- Typography variables
- Radius variables

### Styles
Check for text styles and effect styles that may exist independently of variables.

### Design rules
Read the project's `design-rules.md` from the workspace folder. Apply these rules throughout all phases.

### Target file
If `config.designFiles[]` has multiple entries, ask the user which design file to work in. If only one, use it directly.

---

## Phase 2: Create Page and Wrapper Frame

1. **Create or navigate to the target page** in Figma
   - If designing a new screen: create a page named after the screen (e.g., "Dashboard - Active")
   - If updating: navigate to the existing page
2. **Create a device frame** as the wrapper:
   ```
   Frame: "Screen Name"
   Width: from config (default 393 for mobile, 1440 for web)
   Height: from config (default 852 for mobile, 900 for web)
   Fill: bound to Semantic/background variable
   Auto-layout: vertical
   Padding: 0
   Clip content: true
   ```
3. Add status bar frame at top (use component instance if available)

---

## Phase 3: Build Section by Section

Decompose the screen into logical sections. Build each one sequentially.

### For each section:

1. **Plan the section** — identify which components, tokens, and layout to use
2. **Create a section frame** inside the wrapper:
   - Auto-layout (vertical or horizontal as needed)
   - Padding bound to spacing variables
   - Gap bound to spacing variables
   - Fill: transparent or bound to surface variable
3. **Place component instances** — use `instantiate_component` or create instances via `use_figma`
   - Set variant properties (e.g., `Variant=Primary, Size=Large`)
   - Override text properties with screen-specific content
   - Swap icons via instance swap properties
4. **Bind all visual properties to variables**:
   - Background colors → Semantic variables
   - Text colors → Semantic variables
   - Spacing (padding, gap) → Spacing variables
   - Corner radius → Radius variables
   - Font properties → Typography variables
5. **Screenshot and validate** the section:
   - Call `mcp__figma__get_screenshot`
   - Check alignment, spacing, visual balance
   - Fix issues (max 3 iterations per section)

### Section ordering (typical mobile screen)

```
1. Status Bar (component instance or fixed frame)
2. Navigation Bar (back button, title, action buttons)
3. Hero / Header section
4. Content sections (cards, lists, forms)
5. Action area (primary/secondary buttons)
6. Tab Bar (component instance) — for main tab screens only
```

---

## Phase 4: Polish

After all sections are built:

1. **Full-screen screenshot** — verify overall composition
2. **Check spacing hierarchy** — outer containers should have proportionally more spacing than inner elements (~1.4x per nesting level, snapped to token grid)
3. **Verify dark mode** — if the file has a dark mode page/variant, duplicate the screen and switch all variables to Dark mode values
4. **Add annotations** (if requested):
   - Screen name and purpose
   - Key interactions (tap targets, gestures)
   - Navigation connections to other screens
5. **Responsive check** — if the design should work across sizes, test by resizing the wrapper frame

---

## Phase 5: Multi-Screen Flows

When designing a flow (e.g., onboarding, checkout):

1. Build each screen following Phases 2-4
2. Arrange screens left-to-right on the Figma canvas with consistent spacing (100px gap)
3. Add flow arrows between screens:
   - Use FigJam connectors if in FigJam
   - Use line/arrow elements in Figma design files
4. Label transitions (e.g., "Tap 'Continue'", "Swipe left")
5. Group all screens into a section named after the flow

---

## Design Rules

All universal component rules from SKILL.md apply (Zero Raw Values, Text Styles, Component Composition, Hug Contents). For Plugin API details, see [plugin-api-patterns.md](../reference/plugin-api-patterns.md).

### Project-specific rules

Before building any screen, read the project's `design-rules.md` from the workspace folder (path in `config.designRulesPath`). This file contains the project's specific layout, spacing, typography, and component rules. Follow them.

If no design rules file exists, infer sensible defaults from the library's variables:
- Use the library's spacing scale to pick padding and gap values (prefer the most commonly used mid-range values)
- Use the library's radius scale for corner radii
- Follow the typography scale as-is
- Apply general best practices (consistent spacing, visual hierarchy)

### Screen-specific rules

- **Typography hierarchy** — each screen should use at most 3-4 text sizes. Follow the project's typography scale.
- **Content-first** — use realistic content, not "Lorem ipsum". Use domain-appropriate copy that matches the project's purpose. If specs or wireframes exist, pull actual copy from them.

---

## Updating Existing Screens

When modifying a screen that already exists:

1. **Read the current state** — call `mcp__figma__get_design_context` with the screen's nodeId
2. **Take a screenshot** of the current state for reference
3. **Identify what to change** — sections to add, remove, or modify
4. **Work section by section**:
   - For additions: create new section frame and place it
   - For modifications: update properties on existing instances (prefer `swapComponent()` for compatible swaps)
   - For removals: confirm with user before deleting any section
5. **Preserve x/y/width/height** for elements in non-auto-layout parents
6. **Screenshot and validate** after each change

---

## Prototyping (Optional)

If the user requests interactive prototyping:

1. Set up prototype connections between screens using `use_figma`:
   - Tap triggers on buttons and interactive elements
   - Navigation actions (Navigate To, Back, Open Overlay)
   - Transition animations (Smart Animate preferred, or Dissolve)
2. Set a starting frame for the prototype
3. Test the flow by describing the interaction sequence
