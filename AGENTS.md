# Codex — La Busqueda del Idolo Perdido

## Project
3D browser adventure game developed with:
- JavaScript ES Modules
- Three.js and WebGL
- Vite
- Vitest

## Repository
- Application: frontend/src/
- Unit tests: frontend/tests/
- Requirements: docs/requirements/
- Architecture: docs/architecture/
- QA: docs/quality/
- Role instructions: agents/
- Original workflows: skills/

## Team
Delegate specialized analysis to:
- requirements_analyst
- software_architect
- qa_engineer

## Mandatory engineering workflow
1. Read relevant documentation.
2. Inspect existing source code.
3. Report evidence with file and line references.
4. Identify risks and alternatives.
5. Propose a minimal change.
6. Request human approval before implementation.
7. Run tests and build after approved changes.
8. Present the diff for human review.

## Initial operating policy
- Analysis only until explicitly authorized.
- Do not modify production code.
- Do not change gameplay.
- Do not create commits automatically.
- Do not push or merge branches.
- Do not delete files.
- Do not install dependencies without approval.
- Do not modify secrets or credentials.
- Do not claim tests passed without execution evidence.

## Critical technical context
- main.js contains the existing game lifecycle.
- The isolated FSM is not integrated into main.js.
- ADR-001 and ADR-002 are still proposed.
- Local accounts do not provide server-side authentication.
- A derived cryptographic key is stored in sessionStorage.
- The existing game behavior must be preserved.

## Verification
Run from frontend/:
- npm test
- npm run build

Report:
- Branch and commit.
- Files inspected.
- Requirements affected.
- Risks.
- Tests actually executed.
- Proposed changes.
- Items requiring human approval.
