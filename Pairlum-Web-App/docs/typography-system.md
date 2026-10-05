# PAIRLUM — GLOBAL TYPOGRAPHY SYSTEM
## Claude implementation spec — V5

Use this document as the **single source of truth for typography across Pairlum**.

Do not invent a different typography style per page.

This system is inspired by the **typographic architecture and visual behavior** of the current Emotion Agency website reference shared by the user, but Pairlum must keep its **own brand identity, wording, colors, imagery, logo, and interactions**.

---

# 1. CORE TYPOGRAPHY ARCHITECTURE

Pairlum uses **four typography roles**:

### A. High-contrast upright display serif
Use for:
- Hero statements
- Major emotional headlines
- Large section statements
- Memory/story titles
- Large statistics when they are part of the emotional composition

Visual character:
- Elegant
- Narrow / editorial
- High contrast between thick and thin strokes
- Cinematic
- Premium
- Light/regular rather than bold

Default behavior:
- Weight: `400`
- Tight line-height
- Slight negative letter spacing
- Can use uppercase for large statements

---

### B. Matching italic display serif
Use for:
- Expressive opening words
- One short emotional phrase
- A single contrast word inside a larger headline
- Poetic accents

Examples:

```text
Let's BUILD
SOMETHING
MEANINGFUL
```

```text
Somewhere

BETWEEN THE DISTANCE
WE BUILT
OUR OWN WORLD
```

Rules:
- Do not italicize entire sections.
- Use italic as a contrast device.
- Prefer one word or one short phrase.

---

### C. Technical mono
Use for:
- Metadata
- Dates
- Archive labels
- Small system descriptions
- `[01]` numbered links
- Small uppercase descriptions
- Technical coordinates / distance context
- Tiny badges where appropriate

Visual character:
- Compact
- Technical
- Uppercase
- Small
- Functional
- Slight tracking

Example:

```text
[01] OUR STORY ↗
[02] LETTERS ↗
[03] CAPSULES ↗
```

---

### D. Clean UI sans
Use for:
- Navigation
- Buttons
- Forms
- Inputs
- Product controls
- Settings
- Tabs
- Section labels
- Functional body text

Visual character:
- Clean
- Modern
- Quiet
- Never overly bold
- Supports the display serif instead of competing with it

---

# 2. FONT ROLE IMPLEMENTATION

Use these font-role variables globally:

```css
--font-display: "Bodoni Moda", Didot, "Bodoni 72", "Times New Roman", serif;
--font-mono: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
--font-ui: "Inter", "Helvetica Neue", Arial, sans-serif;
```

These are **free implementation proxies** for the intended visual direction.

Do NOT claim that these are Emotion Agency's exact proprietary fonts.

If Pairlum later receives a final licensed/custom display serif, replace only the font variables.  
Do not rebuild the scale or hierarchy unless explicitly requested.

---

# 3. MAIN DISPLAY SCALE

Desktop:

```css
--display-xxl: clamp(4.9rem, 7.2vw, 8.9rem);
--display-xl:  clamp(4.25rem, 6.4vw, 7.6rem);
--display-lg:  clamp(3.6rem, 5.4vw, 6.25rem);
--display-md:  clamp(3rem, 4.5vw, 5.1rem);
```

Structural headings:

```css
--h1: clamp(2.8rem, 4.1vw, 4.7rem);
--h2: clamp(2.25rem, 3.3vw, 3.65rem);
--h3: clamp(1.7rem, 2.3vw, 2.55rem);
```

UI / small text:

```css
--body-lg: 1.125rem;
--body: 1rem;
--body-sm: .875rem;
--nav: .79rem;
--section-label: .92rem;
--mono: .72rem;
--mono-small: .66rem;
```

Mobile:

```css
--display-xxl: clamp(3.45rem, 17vw, 5.35rem);
--display-xl: clamp(3.15rem, 15.5vw, 4.9rem);
--display-lg: clamp(2.85rem, 14vw, 4.35rem);
--display-md: clamp(2.55rem, 12vw, 3.8rem);
```

---

# 4. DISPLAY TYPOGRAPHY RULES

Main display serif:

```css
font-family: var(--font-display);
font-weight: 400;
font-style: normal;
letter-spacing: -0.035em;
```

Recommended line-height:

```css
XXL: 0.82
XL:  0.84
LG:  0.86
MD:  0.89
```

This tight line-height is intentional.

Do NOT use:

```css
line-height: 1.2;
```

for giant emotional headlines.

Do NOT rely on bold weight to create hierarchy.

Hierarchy should come from:

```text
scale
line breaks
placement
whitespace
contrast
italic vs upright
```

---

# 5. MIXED EDITORIAL HEADLINE

Pairlum must support a headline where italic serif and upright serif coexist.

Example HTML:

```html
<h1 class="pairlum-editorial-headline">
  <em>Let's</em> KEEP
  <span class="pairlum-arrow">↳</span>
  SOMETHING
  MEANINGFUL
</h1>
```

Base implementation:

```css
.pairlum-editorial-headline {
  font-family: var(--font-display);
  font-weight: 400;
  font-style: normal;
  font-size: var(--display-xl);
  line-height: .82;
  letter-spacing: -.038em;
  text-transform: uppercase;
}

.pairlum-editorial-headline em {
  font-style: italic;
  text-transform: none;
  letter-spacing: -.055em;
}
```

Do not use the italic word only as decoration.  
It should carry emotional meaning.

---

# 6. TECHNICAL MONO SYSTEM

Base style:

```css
font-family: var(--font-mono);
font-weight: 500;
font-size: .66rem to .72rem;
line-height: 1.18;
letter-spacing: .025em to .04em;
text-transform: uppercase;
```

Examples:

```text
12 SEPTEMBER 2026

A PRIVATE WORLD FOR TWO PEOPLE

[01] OUR STORY ↗
[02] LETTERS ↗

6,847 KM APART
STILL PART OF THE SAME STORY
```

Do not make this text large.

The contrast between **tiny technical text** and **huge serif display text** is a core part of the system.

---

# 7. CLEAN SANS SYSTEM

Use the UI sans for:

```text
Navigation
Buttons
Inputs
Form labels
Tabs
Settings
Functional body copy
Section labels
```

Default weights:

```text
400
500
600 only where needed
```

Avoid:

```text
700
800
900
```

for the main Pairlum visual language.

---

# 8. SECTION LABELS

Use clean sans, not serif.

Example:

```text
MEMORIES ↘
OUR SPACE ↘
TODAY ↘
```

Recommended:

```css
font-family: var(--font-ui);
font-size: .92rem;
font-weight: 500;
line-height: 1;
letter-spacing: -.025em;
text-transform: uppercase;
```

Section labels can use a muted color.

---

# 9. NUMBERED LINK PATTERN

Recommended structure:

```html
<div class="pairlum-numbered-link">
  <span class="pairlum-index">[01]</span>
  <span>OUR STORY ↗</span>
</div>
```

Use for:
- Archive navigation
- Chapter navigation
- Memory categories
- Timeline categories
- Book chapters where appropriate

Do not use numbered indexes everywhere.

Use them only when they improve the archive/catalogue feeling.

---

# 10. PAIRLUM-SPECIFIC TYPOGRAPHY ROLES

## Memory title

```css
font-family: var(--font-display);
font-size: clamp(2.6rem, 4vw, 4.7rem);
font-weight: 400;
line-height: .91;
letter-spacing: -.034em;
```

## Whisper / emotional aside

```css
font-family: var(--font-display);
font-style: italic;
font-size: clamp(2rem, 3vw, 3.5rem);
line-height: .9;
letter-spacing: -.045em;
```

## Large relationship stat

Example:

```text
6,847 km
```

Recommended:

```css
font-family: var(--font-display);
font-size: clamp(5rem, 10vw, 10.5rem);
font-weight: 400;
line-height: .80;
letter-spacing: -.055em;
```

---

# 11. COMPOSITION RULES

The typography must not behave like a normal SaaS website.

Avoid repeating:

```text
Heading
Paragraph
Button
Card

Heading
Paragraph
Button
Card
```

Instead use editorial composition:

```text
tiny label

                       giant statement

small technical copy


          italic word
                 GIANT SERIF LINE
                 GIANT SERIF LINE


visual


tiny metadata
```

Important:
- Do not center every section.
- Allow controlled asymmetry.
- Use whitespace deliberately.
- Let some type sit close to the edge where appropriate.
- Major headlines should feel like part of the visual composition.
- Typography may overlap or interact with photography/visuals when readability is preserved.

---

# 12. LINE-BREAK RULES

Major headlines need intentional line breaks.

Good:

```text
BETWEEN THE DISTANCE
WE BUILT
OUR OWN WORLD
```

Not:

```text
BETWEEN THE
DISTANCE WE BUILT OUR
OWN WORLD
```

Do not let the browser make random hero line breaks when the design relies on a specific composition.

Use explicit line containers or `<br>` where needed.

---

# 13. CAPITALIZATION

Use uppercase for:
- Giant editorial statements
- Mono metadata
- Technical labels
- Small navigation labels where appropriate

Do NOT use uppercase for:
- Long body copy
- Personal letters
- Every emotional sentence

Italic serif accent words normally stay in natural capitalization.

Example:

```text
Let's BUILD
SOMETHING
MEANINGFUL
```

---

# 14. ARROWS AS TYPOGRAPHY

Allowed glyphs:

```text
↗
↘
↳
→
```

Use them as part of the typographic system.

Do not add random decorative arrow icons when a typographic glyph is enough.

---

# 15. MOTION

Motion rule:

```text
reveal → settle → pause
```

For main display lines:
- Masked vertical reveal
- Slight stagger
- No bouncing
- No zooming
- No random letter chaos
- No constant movement

CSS fallback:

```css
.pairlum-mask {
  overflow: hidden;
}

.pairlum-mask > span {
  display: block;
  transform: translateY(110%);
  opacity: 0;
  transition:
    transform 950ms cubic-bezier(.22,1,.36,1),
    opacity 420ms ease;
}

.pairlum-mask.is-visible > span {
  transform: translateY(0);
  opacity: 1;
}
```

If GSAP is already used in the project, prefer:

```text
GSAP
SplitText
ScrollTrigger
CustomEase
```

for production headline reveals.

Always support `prefers-reduced-motion`.

---

# 16. CTA TEXT MOTION

Buttons may use two stacked copies of the same label.

Example behavior:

```text
Enter our space
        ↓ hover
Enter our space
```

The first label slides out and the second slides in.

Keep the motion subtle and quick.

---

# 17. RESPONSIVE BEHAVIOR

Do not simply scale desktop down.

On mobile:
- Keep display type large.
- Preserve the serif/italic contrast.
- Reduce horizontal offsets.
- Simplify asymmetry if needed for readability.
- Keep tiny mono labels legible.
- Avoid breaking one meaningful phrase across too many lines.

Mobile should still feel cinematic, not like a compressed desktop page.

---

# 18. WHERE TO USE EACH ROLE

## Landing page
- Hero: display serif + italic serif
- Microcopy: mono
- Navigation: sans
- CTA: sans

## Sign up / Login
- Main emotional line: display serif
- Small contextual line: mono or sans
- Form: sans
- Error/helper states: sans

## Onboarding
- Major step statement: display serif
- Step number: mono
- Input/UI: sans

## Home / Our Space
- Emotional statements: display serif
- Date/distance metadata: mono
- Navigation/UI: sans

## Memories
- Memory title: display serif
- Date/time: mono
- Caption/body: sans
- Rare poetic aside: italic serif

## Letters
- Letter title: display serif
- Long reading text: display serif only if readability remains excellent; otherwise use a dedicated readable serif.
- Metadata: mono
- UI controls: sans

## Timeline
- Chapter/year label: mono
- Major chapter statement: serif
- Controls: sans

## Pairlum Book
- Display serif dominates the emotional editorial experience
- Mono may be used for archive/date details
- Sans for UI/proofing controls

---

# 19. NON-NEGOTIABLE RULES

1. Main emotional display = high-contrast serif.
2. Expressive accent = matching italic serif.
3. Technical metadata = mono.
4. Product controls = clean sans.
5. Giant display weight should normally be `400`.
6. Do not replace hierarchy with heavy bold.
7. Keep giant display line-height extremely tight.
8. Use slight negative tracking on large serif.
9. Keep mono text tiny and compact.
10. Use authored line breaks for major statements.
11. Do not center everything.
12. Use asymmetry intentionally.
13. Whitespace is part of the typography.
14. Do not add more font families per screen.
15. Do not invent random font sizes.
16. Do not create generic SaaS typography.
17. Do not copy Emotion Agency's exact wording, logo, assets, or compositions.
18. Pairlum keeps its own warm emotional identity.
19. This typography system must be applied globally.
20. If an existing component conflicts with this system, update the component to use these tokens rather than adding another typography style.

---

# 20. IMPLEMENTATION INSTRUCTION FOR CLAUDE

When working on the Pairlum codebase:

1. Inspect the current typography implementation first.
2. Create or update one global typography/theme file.
3. Reuse existing design tokens where possible.
4. Map old heading/body styles onto the four roles in this document.
5. Do NOT create independent typography CSS inside every component.
6. Do NOT change Pairlum's product logic.
7. Do NOT change the logo.
8. Do NOT redesign unrelated functionality.
9. Keep responsive behavior.
10. Keep accessibility and reduced motion.
11. Apply this system consistently across all Pairlum screens.
12. When uncertain between styles, prefer:
   - display serif for emotion
   - mono for metadata
   - sans for function

---

# 21. REFERENCE EXAMPLES FOR PAIRLUM

### Example 1

```text
Somewhere

BETWEEN THE DISTANCE
WE BUILT
OUR OWN WORLD
```

### Example 2

```text
Let's KEEP
↳
SOMETHING
MEANINGFUL
```

### Example 3

```text
MEMORIES ↘

[01] OUR STORY ↗
[02] LETTERS ↗
[03] CAPSULES ↗
```

### Example 4

```text
12 SEPTEMBER 2026

Not important then.
Everything now.
```

### Example 5

```text
6,847 km

STILL PART OF
THE SAME STORY
```

---

# FINAL DESIGN INTENT

Pairlum typography should feel:

```text
cinematic
editorial
intimate
premium
quiet
memorable
emotionally intentional
```

It must NOT feel:

```text
generic SaaS
heavy-bold
corporate
template-driven
cluttered
overly decorative
game-like
```

The goal is not to copy another website.

The goal is to give Pairlum the same level of **typographic confidence, hierarchy, scale, and visual memory**, while keeping the experience unmistakably Pairlum.
