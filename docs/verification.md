# Verification record

- `npm test`: **16 passed**, using a disposable UTF-8 PostgreSQL 18 database. Includes actual concurrent booking requests, document authorization, verification gates, reviews, session/CSRF checks, call authorization and AI output validation.
- `npm run test:e2e`: **7 passed** in installed Chrome, repeated against the production standalone server. Exercises RTL/mobile layout, booking, guided matching, unauthorized room entry, registration/logout/password login, private uploads/admin approval, and two-browser real WebRTC audio with fake microphone devices.
- `npm run typecheck`: passed.
- `npm run build`: passed on Next.js 16.4.1 / React 19.3.1 / Node 22.23.3.
- Compose v5.6.0 `config --quiet`: passed.
- Initial Compose `up -d --build` attempt failed because Docker Engine was not installed at that time. Docker is now available; the origin regression fix was built and started successfully with `docker compose up -d --build --wait web`, and both services are healthy.
- Production standalone includes `pg` and dependencies needed by the runtime migration/admin/seed scripts. Public fonts and static files were copied to the standalone directory for the production smoke test, mirroring the Dockerfile layout.
- Live government registry requests are not configured; the application records a human verifier's official evidence and interview outcome.
- External AI requests were not sent: no key/model was supplied. Provider response validation uses controlled responses, and guided mode was exercised end to end.
- Public TURN connectivity and container backup restoration were not tested without the corresponding infrastructure.

The local `.env` contains random generated credentials and is ignored by Git and the Docker build context. Demo profiles are explicitly marked, contain no real practitioner data, and have no fabricated reviews. Browser-test accounts, uploaded documents and appointment fixtures are removed after tests.

## Local registration origin regression — 2026-10-15

- Reproduced the original error in the running container: a registration request from `http://127.0.0.1:3000` returned 403 while the configured `http://localhost:3000` passed origin validation.
- Explicit localhost, IPv4 loopback and IPv6 loopback aliases are now allowed only when the configured origin is also loopback, with the same protocol and port. Public deployments still accept only their configured origin; Host and forwarded headers cannot grant trust.
- `npm test`: **25 passed**, including 8 origin-policy regression tests and a successful IPv4-origin registration/password-login integration test. TypeScript validation passed.
- Container image production build and Compose health checks passed.
- Real Chrome registration, logout and password login passed against both `localhost:3000` and `127.0.0.1:3000`; foreign-origin mutations still returned 403. Temporary accounts created for these checks were deleted.

## Administrator provisioning — 2026-10-17

- The screenshot showed Compose invoked from `C:\Windows\System32`, where no project configuration exists. The administrator provisioning command had not executed.
- Ran the existing provisioning script against the running Compose web service; it created the configured administrator without modifying other accounts.
- Verified actual administrator password login in Chrome at `127.0.0.1:3000`, the verification dashboard, authorized access to `/api/admin/providers`, and logout. Credentials were read from the local environment without being logged.
- Repeated the command from `C:\Windows\System32` using `--project-directory 'D:\javascript course\medito'`; Compose found the project and preserved the existing account and password. Added that command to the README.
