# Security Frameworks & Domain Taxonomy

Research validating S/NC's security domain taxonomy against established frameworks, with a threat model grounded in the cooperative's infrastructure.

## S/NC Threat Model

### What We Are

A media production and distribution cooperative. Self-hosted on Proxmox with LXC containers behind Caddy TLS termination. Small team, limited operational capacity, high autonomy requirements.

### Attack Surface

| Domain | Service | Container | Status |
|--------|---------|-----------|--------|
| `s-nc.org` | Platform (Hono API + TanStack Start) | sncorg | Live |
| `files.s-nc.org` | Seafile (file sync + studio media) | seafile | Live |
| `code.s-nc.org` | Forgejo (git hosting + CI) | code.s-nc.org | Live |
| `demo.s-nc.org` | Staging environment | demo | Live |
| `storage.s-nc.org` | Garage (S3-compatible object storage) | TBD | Configured |
| `stream.s-nc.tv` | Owncast (live streaming) | TBD | Planned |

All containers share a VLAN subnet. Caddy is the single ingress point for all HTTPS traffic.

### Trust Boundaries

```
Internet → Caddy (TLS termination) → LXC containers → PostgreSQL
                                    → Garage S3 API
                                    → Seafile
                                    → Forgejo
```

Browser-direct uploads cross an additional boundary: browser → presigned URL → Caddy → Garage (bypassing the API).

### Key Assets

- **User data**: accounts, subscriptions, payment info (Stripe handles card data)
- **Media content**: music, video, studio recordings (Seafile + Garage)
- **Source code**: Forgejo is the primary host; GitHub is a public mirror
- **CI/CD credentials**: deploy keys, S3 keys, database credentials in Forgejo Secrets
- **Live streams**: RTMP keys, stream metadata (when Owncast goes live)

### Threat Actors (Realistic for Scale)

- **Opportunistic scanners**: automated port/vulnerability scanning. Caddy hardening and minimal exposure are the primary defenses.
- **Credential stuffing**: against login endpoints. Rate limiting and strong auth practices.
- **Supply chain compromise**: dependency vulnerabilities, compromised npm packages. Dependency auditing and pinned versions.
- **Insider risk (low)**: small cooperative, but secrets management and audit logging still matter.

### Not In Scope

Nation-state actors, targeted APT, physical security, compliance-driven requirements (no HIPAA/PCI-DSS obligations — Stripe handles PCI). This doesn't mean we ignore these areas, just that they don't drive architecture decisions.

## Framework Comparison

### Frameworks Evaluated

| Framework | Focus | Prescriptiveness | Scope |
|-----------|-------|-----------------|-------|
| OWASP Top 10 (2021) | Web application risks | Risk categories, not controls | Application |
| OWASP ASVS 5.0 | Application security verification | ~350 specific requirements | Application |
| CIS Benchmarks | Infrastructure hardening | Prescriptive config settings | Infrastructure |
| NIST CSF 2.0 | Risk management outcomes | Outcome-oriented, process-heavy | Organization |
| DevSecOps | CI/CD pipeline security | Process + tooling guidance | Build/release |
| SLSA | Supply chain integrity | 4 maturity levels | Artifacts |

### Coverage Matrix

How our 11 original domains map to each framework:

| Our Domain | OWASP Top 10 | ASVS 5.0 | CIS | NIST CSF | DevSecOps | SLSA |
|---|---|---|---|---|---|---|
| Auth & Access Control | A01, A07 | V6, V8 | Cloud IAM | Protect | DAST | — |
| Input Validation | A03 | V1, V2 | — | Protect | SAST/DAST | — |
| Error Handling | A05 (implicit) | V16 | — | Protect | — | — |
| Secrets Management | A02 | V11, V13 | DevSecOps, Cloud | Protect | SAST | SLSA 2+ |
| HTTP Security Headers | A05 (implicit) | V12 | — | Protect | DAST | — |
| CORS | A04 (implicit) | V4 | — | Protect | DAST | — |
| Rate Limiting | — | — | — | Detect | — | — |
| Dependency Security | A06 | Implicit | DevSecOps SCA | Identify, Govern | SCA | SLSA |
| Data at Rest | A02 | V14 | Cloud, OS | Protect | — | — |
| Logging & Audit | A09 | V16 | All benchmarks | Detect | DevSecOps | SLSA 2+ |
| Service Exposure | A05 (implicit) | V13 (implicit) | Cloud, OS | Identify, Protect | — | SLSA 3+ |

### Key Observations

**OWASP Top 10** is risk-oriented, not domain-oriented. Several of our domains map to implicit aspects of Top 10 categories rather than direct matches. A01 (Broken Access Control) and A03 (Injection) are the strongest alignments.

**OWASP ASVS** is the closest structural match to what we're doing — domain-based verification requirements. Our taxonomy is a deliberate simplification of ASVS's 17 chapters into 11 actionable domains. ASVS is application-only; it doesn't cover infrastructure.

**CIS Benchmarks** fill the infrastructure gap that ASVS leaves. They provide the "how to harden Caddy/PostgreSQL/containers" detail that our infra-tagged domains need.

**NIST CSF** is organizational — useful for framing why we care about each domain, but too process-heavy for sprint-level work. Its Govern/Identify/Protect/Detect/Respond/Recover functions map well to our pipeline stages (Scan = Identify, Triage = Govern, Fix = Protect, Validate = Detect).

**DevSecOps** and **SLSA** cover build-time security that none of our domains address. This is a real gap — Forgejo CI runs deploys with production credentials, and we have no artifact signing or SBOM generation.

## Gap Analysis

### Missing Domains

**Insecure Design / Threat Modeling (OWASP A04):** Architectural security decisions — trust boundary enforcement, request forgery prevention (SSRF, A10), secure defaults. Our taxonomy has rules for *implementing* security but nothing for *designing* it.

**Build & Supply Chain Security (SLSA + DevSecOps):** CI/CD pipeline hardening, artifact integrity, SBOM generation, reproducible builds. Forgejo Actions runs deploys with injected secrets — no verification that the build artifact matches the source.

### Weak Domains

**Error Handling as standalone:** Industry frameworks (OWASP V16, NIST Detect) treat error disclosure as part of logging and monitoring, not a separate concern. The rules are valid but the domain boundary is artificial.

**CORS as standalone:** ASVS groups CORS under API security (V4) or communications (V12). It's a subset of HTTP transport security, not a peer domain.

**Rate Limiting:** Not in any security framework. It's an operational concern (availability/DoS prevention) that matters for security but isn't a security domain per se.

**Service Exposure:** Too vague. Could mean network topology, reverse proxy config, port management, or API surface. Needs scoping.

### Code/Infra Tag Limitations

The binary `code`/`infra` tag doesn't capture domains that genuinely span both:
- **Secrets Management**: secrets are loaded in code (env vars, config) but stored and rotated in infrastructure (Forgejo Secrets, vault, rotation policies)
- **Dependency Security**: vulnerabilities are in code dependencies but remediation involves CI pipeline config and version management
- **Data Protection**: encryption at rest is infrastructure, PII handling is code, retention policies are organizational

A `cross-cutting` tag resolves this.

## Revised Taxonomy (v2)

Changes from v1, with rationale:

| Change | Rationale | Framework Basis |
|--------|-----------|----------------|
| Merge Error Handling → Logging, Errors & Monitoring | Error disclosure is a monitoring concern | OWASP V16, NIST Detect |
| Merge CORS → HTTP Security & CORS | Transport-layer siblings | ASVS V4/V12 |
| Rename Service Exposure → Network & Service Exposure | Clarifies scope | CIS Benchmarks, NIST Identify |
| Rename Data at Rest → Data Protection | Broader: at rest + in transit + PII + retention | ASVS V14, NIST Protect |
| Add Secure Design | Covers A04 + A10 (SSRF), trust boundaries | OWASP Top 10 |
| Add Build & Release Security | Covers SLSA + DevSecOps pipeline | SLSA, DevSecOps |
| Add `cross-cutting` domain tag | Binary code/infra misses spanning domains | All frameworks |

### v2 Domain Structure

| # | Domain | Tag | OWASP Alignment | Scope |
|---|--------|-----|----------------|-------|
| 1 | Auth & Access Control | code | A01, A07 / V6, V8 | Authentication, authorization, session management, role/resource access |
| 2 | Input Validation | code | A03 / V1, V2 | Schema validation, injection prevention, parameterized queries |
| 3 | Secure Design | code | A04, A10 / V15 | Trust boundaries, SSRF prevention, secure defaults, threat modeling patterns |
| 4 | Secrets Management | cross-cutting | A02 / V11, V13 | Secret loading, storage, rotation, leak prevention |
| 5 | HTTP Security & CORS | infra | A05 / V4, V12 | Headers, HSTS, CSP, CORS, server identification |
| 6 | Network & Service Exposure | infra | A05 / V13 | Reverse proxy, port management, admin access, API surface |
| 7 | Rate Limiting | infra | — / — | DoS prevention, per-endpoint/user limits, auth endpoint protection |
| 8 | Dependency & Supply Chain | cross-cutting | A06, A08 / — | Vulnerability scanning, version pinning, minimal deps, SBOM |
| 9 | Data Protection | cross-cutting | A02 / V14 | Encryption at rest/transit, PII handling, retention, backup security |
| 10 | Logging, Errors & Monitoring | cross-cutting | A09 / V16 | Audit trails, error disclosure, PII redaction, security event logging |
| 11 | Build & Release Security | infra | A08 / — | CI/CD hardening, artifact signing, deploy credential isolation, reproducible builds |

### What Changed for Existing Rules

- Error Handling rules (5) → folded into Logging, Errors & Monitoring
- CORS rules (5) → folded into HTTP Security & CORS as a subsection
- All other v1 rules remain in their renamed/restructured domains
- New domains (Secure Design, Build & Release Security) get 4-5 starter rules each

## Sources

- OWASP Top 10 (2021): https://owasp.org/www-project-top-ten/
- OWASP ASVS 5.0: https://owasp.org/www-project-application-security-verification-standard/
- CIS Benchmarks: https://www.cisecurity.org/cis-benchmarks
- NIST CSF 2.0: https://www.nist.gov/cyberframework
- SLSA Framework: https://slsa.dev/
- DevSecOps Pipelines: https://owasp.org/www-project-devsecops-guideline/
