# Medito — scope and delivery order

1. Analysis: a Persian mental-health practitioner directory with patient, practitioner and administrator roles. No payments, prescriptions, medical records or video calls.
2. UX and architecture: one Next.js App Router application (React/TypeScript), PostgreSQL, SQL migrations, private document volume. No microservices or ORM.
3. Registration and verification: password authentication, private identity/license/degree documents, official-reference evidence and recorded human interview. Identity and professional credentials are separate checks. No fabricated government integration. Approval requires an administrator and evidence; external registry access remains an operational dependency.
4. Profiles and search: approved practitioners, city/specialty/mode filters, private practitioner dashboard.
5. Scheduling, reviews and ranking: practitioner availability, atomic booking, cancellation/rescheduling, completed-appointment reviews, Bayesian ranking.
6. Initial release: sensitive-path integration tests, production build, Docker Compose, backup/restore instructions.
7. In-app audio: appointment-bound WebRTC rooms, authenticated database signaling, microphone/connection lifecycle, configurable TURN.
8. Matching assistant: opt-in external-model interpretation of the user's stated need; deterministic filtering of approved database profiles. No diagnosis or invented practitioners. Without model configuration, clearly labeled guided search remains available.

## Acceptance and sensitive tests

- Users cannot choose administrator privileges or approve themselves.
- Session tokens are hashed at rest, passwords use scrypt, mutations require same-origin requests.
- Documents never live under public/, are limited to 5 MiB and checked by signature and type; only their owner and administrator may download them.
- Approval requires all three document types, identity and license checks, official reference, and completed interview. Decisions are audited.
- Database constraints and transactions prevent overlapping availability and duplicate bookings, including concurrent requests. Past/cancelled/unapproved slots cannot be booked.
- Only the patient on a completed appointment can submit one review; ratings are validated.
- Only participants can signal/read a call, during its permitted time window; cancelled sessions close access.
- AI cannot choose unknown/unapproved practitioners or override explicit filters. No conversations or documents are sent to the model without user consent.

## Release boundary

Phases 1–6 form the initial release. Audio and the assistant are subsequent features in the same repository. Automated checks accompany the corresponding implementation, not just the release phase. Government services, provider credentials, HTTPS and public TURN infrastructure cannot be manufactured by the application.
