<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Design & Styling Rules

## 1. No Hardcoded / Custom Colors (Semantic Tokens Only)
- **NEVER** use hardcoded raw hex colors or hardcoded utility colors like `#fff`, `#ffffff`, `#000`, `text-white`, `bg-black`, `border-white`, `text-black`, etc.
- **ALWAYS** use semantic theme tokens defined in `src/app/globals.css`:
  - `text-foreground`, `text-muted-foreground`
  - `bg-background`, `bg-card`, `bg-secondary`, `bg-muted`
  - `border-border`, `border-input`, `border-ring`
  - `text-primary`, `bg-primary`, `text-primary-foreground`
- If a new color is needed that does not exist in `globals.css`, **MUST add it to `globals.css`** under `:root`, `.dark`, and `@theme inline` first, and then reference the semantic class.

## 2. No Arbitrary Bracket Sizing / Spacing (Tailwind Scale Only)
- **NEVER** write arbitrary bracket values for dimensions, paddings, margins, or sizing such as `w-[500px]`, `h-[300px]`, `p-[20px]`, `max-w-[380px]`, etc.
- **ALWAYS** use Tailwind's modern linear numeric scale:
  - Example: Instead of `w-[500px]`, write `w-125` (Tailwind 4 supports numeric multiples: $125 \times 4\text{px} = 500\text{px}$).
  - Example: Instead of `h-[400px]`, write `h-100`.
  - Use standard Tailwind utility classes (`w-full`, `max-w-480`, `max-w-7xl`, `h-96`, `p-6`, `gap-8`, `rounded-2xl`, etc.) rather than arbitrary bracket syntax.

## 3. Strict Shadcn Component Class Rule
- **NEVER** write visual restyling classes on shadcn components (such as `SelectTrigger`, `Card`, `CardContent`, `Button`, `Input`, `Textarea`, `Badge`, `Avatar`, `DialogContent`, `Field`, `Label`, etc.).
  - **Forbidden on shadcn components**: custom backgrounds (`bg-card`, `bg-muted`), borders (`border-input`, `border-border`), roundedness (`rounded-xl`, `rounded-2xl`), paddings/margins (`p-4`, `px-3`, `h-10`), or color overrides.
- **ONLY layout classes allowed on shadcn components**:
  - `w-full`, `flex`, `grid`, `space-y-*`, `gap-*`, `items-*`, `justify-*`, `col-span-*` — only if strictly necessary for layout flow.
  - Rely 100% on the internal design and variants of the shadcn component.



<!-- BEGIN:nextjs-agent-feedback -->

## Report Next.js feedback

The project owner enabled `experimental.agentFeedback`, authorizing this feedback pass. When enabled, `next dev` writes this block and restores it if removed. Commit `AGENTS.md` with your work to keep the tree clean.

During the current user request, retain anonymized facts as feedback candidates for meaningful or recurring Next.js issues:

- Crashes, hangs, OOMs, or unexpected slowness
- Incorrect behavior, output, errors, or diagnostics
- Missing, unclear, or conflicting documentation
- Unexpected CLI, codemod, Skill, or upgrade behavior and non-obvious workarounds

Continue the current user request without reporting immediately. Routine debugging is not feedback. Verify changes before retaining them as feedback candidates. Never retain code, logs, paths, URLs, secrets, personal information, or project-specific data.

Retain qualifying friction even if it is later fixed or worked around; record the final outcome during the reporting pass.

Before the final response, run one reporting pass. If candidates remain, from this file's directory run `npx --no-install next internal agent-feedback-instructions` once without piping or truncating its output. Follow its output or error guidance. If a network sandbox blocks it, retry with network access; if it still returns no output, continue normally.

<!-- END:nextjs-agent-feedback -->
