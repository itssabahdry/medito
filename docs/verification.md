# Verification record

- `npm test`: **16 passed**, using a disposable UTF-8 PostgreSQL 18 database. Includes actual concurrent booking requests, document authorization, verification gates, reviews, session/CSRF checks, call authorization and AI output validation.
- `npm run test:e2e`: **7 passed** in installed Chrome, repeated against the production standalone server. Exercises RTL/mobile layout, booking, guided matching, unauthorized room entry, registration/logout/password login, private uploads/admin approval, and two-browser real WebRTC audio with fake microphone devices.
- `npm run typecheck`: passed.
- `npm run build`: passed on Next.js 16.4.1 / React 19.3.1 / Node 22.23.3.
- Compose v5.6.0 `config --quiet`: passed.
- Compose `up -d --build`: attempted; failed before image build because the Windows Docker Engine named pipe does not exist. Docker Desktop and WSL are not installed. No container startup or image build is claimed.
- Production standalone includes `pg` and dependencies needed by the runtime migration/admin/seed scripts. Public fonts and static files were copied to the standalone directory for the production smoke test, mirroring the Dockerfile layout.
- Live government registry requests are not configured; the application records a human verifier's official evidence and interview outcome.
- External AI requests were not sent: no key/model was supplied. Provider response validation uses controlled responses, and guided mode was exercised end to end.
- Public TURN connectivity and container backup restoration were not tested without the corresponding infrastructure.

The local `.env` contains random generated credentials and is ignored by Git and the Docker build context. Demo profiles are explicitly marked, contain no real practitioner data, and have no fabricated reviews. Browser-test accounts, uploaded documents and appointment fixtures are removed after tests.
