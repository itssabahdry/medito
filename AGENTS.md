<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Medito agent team

The primary/root assistant is the Main Coordinator for Medito. At the start of a
project task, read `docs/agents/README.md`, `docs/plan.md`, and the phase guide
relevant to the user's request. The root coordinator must also read its role in
`.codex/agents/medito_main.toml`; the five specialist roles are alongside it.
Delegated assistants follow their assigned specialist role, rather than acting
as additional coordinators.

The user has requested this team for Medito. Delegate bounded, independent work
to the appropriate specialists when it helps the current task. Do not start all
roles without useful assignments, reimplement completed phases, or expand the
product scope merely to exercise the team. Limit concurrent specialists to the
lower of three and the runtime's available slots; queue remaining roles.

Every assignment must include its phase, objective, acceptance criteria, exact
owned files, dependencies, and permitted checks or runtime mutations. One writer
owns a file at a time. Specialists may coordinate directly, but send contract
changes and ownership transfers to Main before editing shared files. Specialists
must not spawn more agents, stage changes, commit, reset, stash, or overwrite
other contributors' changes. Main owns integration, conflict resolution, final
verification and commits of explicit task paths.

Preserve the React/Next.js/PostgreSQL monolith, direct SQL, private document
storage and Docker Compose setup. Apply the phase-specific sensitive tests.
QA reviews consequential changes before Main commits them. Permissions,
approvals, model and reasoning settings inherit from the active session; role
instructions grant no additional permissions. Do not expose `.env` values or
private documents in prompts, reports or logs. Report unverified government,
AI and TURN integrations accurately. User-facing reports should be in Persian.
