---
name: software-architecture
description: Analyze and improve modular software architecture.
---

# Software Architecture Skill

## Objective
Produce architecture decisions based on
verified source code evidence.

## Phase 1: Architecture discovery
- Inspect source directory structure.
- Identify application entry points.
- Analyze static and dynamic imports.
- Identify external dependencies.
- Map responsibilities and data flows.
- Identify browser-specific dependencies.

## Phase 2: Architecture evaluation
Evaluate:
- Coupling.
- Cohesion.
- Testability.
- Maintainability.
- Security boundaries.
- Resource lifecycle.
- Performance constraints.

## Phase 3: Modeling
Produce:
- C4 System Context.
- C4 Container diagram.
- C4 Component diagram.
- Dependency analysis.
- Architecture Decision Records.

## Phase 4: Improvement proposals
Each proposal must contain:
- Technical problem.
- Source evidence.
- Impact.
- Alternatives.
- Recommendation.
- Migration plan.
- Verification plan.

## Phase 5: Quality gate
Reject proposals when:
- Source evidence is missing.
- Existing behavior is not preserved.
- Dependencies are introduced without justification.
- Testing strategy is undefined.
- Security implications are ignored.

## Restrictions
Read-only analysis of production code.
Do not execute destructive commands.
Do not modify gameplay.
Do not claim quality improvements without evidence.

## Definition of Done
Architecture documentation is traceable,
reviewable and ready for human approval.
