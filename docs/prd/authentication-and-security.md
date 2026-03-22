# Authentication And Security

This document defines the access model for Life OS. The current goal is a simple self-hosted email-and-password login with strong per-user data isolation and admin-managed account creation.

## Current decision

Life OS uses multiple user accounts with email-and-password login, but keeps account creation private and admin-managed.

## Why this is the right MVP choice

- It supports sharing one deployment safely across multiple users.
- It is much simpler than social auth or public multi-user registration.
- It avoids the complexity and risk of public sign-up flows.
- It still creates a real security baseline for personal data.

## Chosen authentication model

### Account model

- Multiple user accounts
- No public sign-up
- No public invites
- No role system

### Account creation

Accounts should be created through one of these controlled methods:

1. bootstrap environment variables on first boot for the first account
2. a local admin CLI or setup command for additional accounts

Public first-run registration should not be part of MVP.

### Login method

- Email plus password
- Email is the canonical identifier
- Password login only for MVP

### Password reset

- No email reset flow in MVP
- Password resets happen through an admin CLI or deployment-level reset flow that revokes existing sessions

This keeps the product simple and appropriate for a private self-hosted app.

## Session model

### Chosen approach

Use server-managed sessions with secure cookies.

### Why not JWT for MVP

- Server sessions are simpler to revoke
- They avoid local-storage token complexity
- They fit a self-hosted app with strict per-user isolation well

### Session requirements

- `HttpOnly` cookie
- `Secure` cookie in any HTTPS environment
- `SameSite=Strict` by default
- server-side session invalidation on logout
- sliding expiration with a `14-day` session window

## Minimum security baseline for MVP

These are required even for a private VPS deployment.

### Password storage

- Hash passwords with `Argon2id`
- Never store plaintext passwords
- Never log passwords

### Transport and deployment

- Private network or VPN access is acceptable for early personal use
- If exposed to the public internet, HTTPS becomes mandatory before launch
- Secrets must be stored in environment variables or secret storage, never hardcoded

### Request protection

- CSRF protection for state-changing requests
- Basic login rate limiting
- Basic brute-force protection after repeated failed login attempts

### Audit visibility

Track at least:

- successful login
- failed login
- logout
- password change or reset

### Session control

- Logout everywhere option
- Manual session invalidation after password reset

## Non-goals

- public sign-up
- OAuth or social login
- SSO
- two-factor authentication
- passwordless login
- device trust management

## Architecture guidance

Build the auth layer so it can grow later without rewrite:

- keep auth separate from user-profile domain logic
- avoid assuming there will only ever be one account in database schema
- use a generic user table even if MVP only permits one owner record
- keep permission checks minimal now but structurally extensible

## Later hardening path

When the product moves beyond a private VPS deployment, the next upgrades should be:

1. enforced HTTPS everywhere
2. stronger rate limiting and bot protection
3. optional two-factor authentication
4. IP allowlisting or VPN-only access for private deployments
5. email reset flow
6. roles and permissions if the product direction changes
