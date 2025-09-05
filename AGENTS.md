# AGENTS.md — Codex (Reviewer & Architect Only)

> **Scope**: Codex only performs *architecture & code review and planning*. It does **not** write code or push commits. Output must be review comments, change proposals, ADR drafts, acceptance checklists, and implementation plans.
> **_直言不讳+止损机制_**请用中文回答我的所有问题，每次都用审视的目光，仔细看我输入的潜在问题，你要指出我的问题，并给出明显在我思考框架之外的建议。

---

## 1) Repository Reality (what exists in this repo)

**Structure**
- `src/` — TypeScript + React 19 + Phaser + Electron
  - `src/components/` UI (PascalCase components)
  - `src/game/` scenes/state
  - `src/shared/` utilities (events, security, services)
  - `src/main/`, `src/preload/` — Electron entry & preload
  - `src/styles/` styles
- `tests/e2e/` — Playwright E2E specs. Unit tests live next to code as `*.spec|test.ts(x)`
- Config: `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc`, `playwright.config.ts`
- Outputs: `dist/`, `build/`, `coverage/`, `test-results/`

**Scripts & Tasks (npm)**
- Dev / Build:
  - `npm run dev`, `npm run preview`, `npm run build`
  - Electron: `npm run dev:electron`, `npm run build:electron`
- Quality & Safety:
  - Lint / Types: `npm run lint`, `npm run typecheck`
  - Unit tests: `npm test` or `npm run test:unit` (Vitest)
  - E2E tests: `npm run test:e2e` (Playwright)
  - Coverage gate (global): `npm run test:coverage:gate`
  - Guards / Checks: `npm run guard:quality`, `npm run guard:electron`, `npm run security:check`
  - Release safety (Electron fuses): `npm run security:fuses:prod`

**Coverage gates**
- Provider: v8
- **Global threshold**: **90%** for lines/branches/functions/statements (enforced by `test:coverage:gate`).

---

## 2) How Codex should work here (review & planning only)

- **Read-only posture**: Never write files, run destructive tools, or create commits. All output is advice, diffs-as-text, or checklists the human can apply.
- **Minimal context**: Refer to specific files/lines; avoid broad repository reads.
- **ADR first**: Any suggestion that changes contracts, thresholds, or security baselines must cite an existing **Accepted ADR** or include a new **ADR draft** (Nygard format).
- **arc42 alignment**: Keep cross-cutting & system backbone in **Base** (01–07, 09, 10). Place feature slices only in Overlay **08** and reference Base; do not duplicate thresholds.
- **Electron security baseline** (must be true in PRs):
  - `nodeIntegration=false`, `contextIsolation=true`, `sandbox=true`
  - Strict CSP; allow-list `connect-src`; main-process guards (window/navigation/permissions); whitelist-only `preload` exports.
- **Release health** (Sentry): Releases & Sessions must be enabled so we can compute **Crash‑Free Sessions/Users** and block poor releases in CI.

---

## 3) Review flow for PRs

**Pre-flight**
- Build is green; `npm run lint`, `npm run typecheck`, `npm run test:coverage:gate` pass
- For UI/gameplay, attach screenshots/GIFs in the PR
- Use Conventional Commits in PR titles & commits

**Architecture alignment**
- Cite relevant ADRs and overlays (08-x docs); propose an ADR draft if this PR changes policy or thresholds
- Check quality goals & constraints are upheld

**Code health**
- Small, focused diffs; readable design; tests present and meaningful
- Unit + E2E where applicable; coverage ≥ **90%** global

**Security**
- Electron baseline flags set; CSP/permissions/preload surfaces reviewed
- Call out risky switches (`appendSwitch`, debug flags) and remote content rules

**Observability & Release health**
- Verify Sentry release is created in CI and sessions are flowing
- Crash‑Free gating: see thresholds below

---

## 4) Planning (when work spans multiple days/modules or includes risky migrations)

If needed, create `IMPLEMENTATION_PLAN.md` in the PR (or include the following in the PR description):

```markdown
## Stage N: [Name]
**Goal**: [Specific deliverable]
**Success Criteria**: [Testable outcomes]
**Tests**: [Specific test cases]
**Risks/Mitigations**: [Known risks + rollback]
**Status**: [Not Started|In Progress|Complete]
```

Tasks spawned from a plan should include `adrRefs` / `archRefs` and reuse Overlay acceptance criteria.

---

## 5) CI, Branch protection, and required checks

- CI should run (at minimum): `lint` → `typecheck` → `test:unit` (with coverage) → `test:e2e` → `security:check` → release health check → package.
- **Required checks** on protected branches should include your CI job names for:
  - Unit tests (Vitest) and coverage gate
  - Playwright E2E
  - Release health (crash‑free threshold)
  - (Optional) task-link validation (ADR/CH back-links), if present in your pipeline
- If job names differ in your CI, mirror those exact job names in the branch protection rule.

---

## 6) Sentry configuration (Release Health)

> The repo doesn’t declare a project name in docs. To keep this actionable, we define a **default** you can override via env.

- **Default project**: `bc660-desktop` (override with `SENTRY_PROJECT` if your actual project differs)
- **Required env (CI & app)**:
  - `SENTRY_ORG=<your org>`
  - `SENTRY_PROJECT=${SENTRY_PROJECT:-bc660-desktop}`
  - `SENTRY_DSN=<dsn>`
  - `SENTRY_RELEASE` (e.g., `${GITHUB_SHA}` or `${npm_package_version}-${GITHUB_SHA:0:7}`)
  - `SENTRY_ENVIRONMENT=<dev|staging|prod>`
- **Crash‑Free thresholds** (gate merges when below):
  - **Sessions ≥ 99.0%**, **Users ≥ 99.0%** for `prod`
  - Looser thresholds are acceptable for `dev/staging`; document any exception in ADR‑0003
- CI should fail the PR if a release falls below the environment’s threshold.

---

## 7) Deliverables Codex must produce

- **PR Review checklist** covering ADR/Overlay alignment, security baseline, tests/coverage, observability, and rollback plans.
- **ADR draft** when policy/threshold/contract changes (Status: Proposed; link to PR).
- **Implementation plan** (if applicable) using the template above.
- **Security review notes** (Electron baseline & CSP) and remediation suggestions.
- **Release health gate** recommendation (thresholds, alerts, and fail-on-below policy).

---

## 8) Reviewer template (paste into PR)

```
### Architecture & ADR
- ADR refs: ADR-____ (Accepted/Proposed). Overlay 08 refs: ____.
- Does this change require a new ADR or supersede one? Yes/No

### Code Health
- Design clarity & scope: ✅/⚠️/❌
- Tests present & meaningful: ✅/⚠️/❌
- Coverage (global ≥ 90%): Pass/Fail

### Security (Electron)
- nodeIntegration/contextIsolation/sandbox: ✅/⚠️/❌
- CSP / preload surface / permission & navigation handlers: Notes + file/line refs

### Observability & Release Health
- Sentry release created & sessions flowing: Yes/No
- Crash-Free Sessions/Users (env threshold): Meets/Below → action

### Plan & Risks
- Implementation plan needed? Yes/No
- Key risks and rollback plan: bullets
```

---

## 9) References (for reviewers)

- **Conventional Commits** — commit format & SemVer mapping
- **Google Code Review** — improve overall code health over time
- **GitHub branch protection & required checks**
- **Electron security** — context isolation, sandbox, CSP
- **Sentry Release Health** — releases, sessions, crash-free metrics

_(Keep these as quick links in PR descriptions and review notes.)_
