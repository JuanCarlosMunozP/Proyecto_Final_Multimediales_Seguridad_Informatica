---
name: requirements-engineering
description: Analyze source code and create traceable requirements.
---

# Requirements Engineering Skill

## Purpose
Produce software requirements based on verified
repository evidence.

## Workflow

### Step 1: Repository inspection
- Read README.md.
- Inspect package.json.
- Identify application entry points.
- Identify modules and responsibilities.
- Review current tests.

### Step 2: Requirements identification
Classify requirements as:
- RF: Functional Requirement.
- RNF: Non-Functional Requirement.
- SEC: Security Requirement.

### Step 3: Use case specification
Document:
- Identifier.
- Actor.
- Goal.
- Preconditions.
- Main flow.
- Alternative flows.
- Postconditions.
- Acceptance criteria.

### Step 4: Traceability
Associate:
Requirement -> Use Case -> Source -> Test.

### Step 5: Quality validation
Reject documentation that:
- Invents implemented functionality.
- Lacks evidence.
- Contains untestable acceptance criteria.
- Mixes current and future architecture.

## Restrictions
Do not modify frontend production code.
Do not execute destructive commands.
Do not claim tests passed without evidence.

## Output
Markdown documentation under docs/requirements/.

## Completion
Human review is required before approval.
