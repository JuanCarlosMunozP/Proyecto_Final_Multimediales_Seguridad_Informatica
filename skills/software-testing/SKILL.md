---
name: software-testing
description: Design, execute and verify tests with evidence.
---

# Software Testing Skill

## Objective
Establish evidence-based quality controls.

## Phase 1: Discovery
- Read the SRS and architecture documents.
- Inspect existing test scripts and dependencies.
- Identify testable functions.
- Classify unit, integration and browser tests.

## Phase 2: Test Design
For each test define:
- Unique test ID.
- Related requirement.
- Preconditions.
- Test data.
- Execution steps.
- Expected result.
- Actual result when executed.

## Phase 3: Test Implementation
- Prefer isolated deterministic tests.
- Use existing test tooling when suitable.
- Avoid unnecessary mocks.
- Keep browser dependencies explicit.
- Do not alter production behavior to force tests.

## Phase 4: Execution
- Execute the appropriate test command.
- Verify exit status.
- Record successful, failed and skipped tests.
- Capture reproducible failure information.

## Phase 5: Regression
- Compare against the approved baseline.
- Re-run relevant tests after changes.
- Verify the production build.
- Include manual gameplay checks when needed.

## Quality Gate
Do not report a test as passed unless it ran.
Do not claim coverage without measurement.
Do not merge with unresolved critical regressions.

## Definition of Done
Every result is reproducible and traceable.
