---
tags: [identity]
release_binding: null
created: 2026-04-20
---

# Bearer Token Auth for Native Apps

Enable Better Auth token-based auth alongside session cookies. Prerequisite for all mobile and TV app development. Session cookies are the current auth mechanism; native apps (iOS, Android, TV clients) need a stateless bearer token alternative since they cannot share a browser cookie jar.

Research in `.memory/research/multi-platform-strategy.md` under the Auth Token Support section has prior exploration on this. The Better Auth JWT plugin (`better-auth/plugins/jwt`) is already installed and may provide a direct path — verify whether it satisfies the native app use case before designing a custom token mechanism.
