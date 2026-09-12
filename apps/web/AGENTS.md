<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## UI conventions

- Use shadcn/ui components for all interactive UI controls. Reuse the project's `radix-nova` components from `@/components/ui` and compose them when a dedicated control is unavailable.
- Date and time pickers must use themed shadcn components, not the browser popups from `input type="date"`, `input type="time"`, or `input type="datetime-local"`.
- Preserve the existing theme, shared sliding tabs, and `corner-brackets` hover treatment on action buttons. Do not overwrite customized shared components when adding a registry component.
- Avoid routine refresh icons in page headings. Keep retries in actual error states.
