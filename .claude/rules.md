# Claude Rules for TTB Label Verification Project

## Project Context
This is a take-home project for a Treasury TTB position. The goal is to build an AI-powered alcohol label verification tool. Always reference `docs/TTB_LABEL_VERIFICATION_PRD.md` for requirements and `docs/APPROACH.md` for technical decisions.

---

## Git Commit Practices

### Commit Frequency
- Commit after completing each logical unit of work (a feature, a fix, a refactor)
- Never leave work uncommitted at the end of a session

### Commit Message Format
```
<type>: <short summary>

## What was completed
- Bullet points of specific changes made

## Context
Brief explanation of why these changes were made and how they fit into the larger goal

## Files changed
- List of files added/modified/deleted

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Commit Types
- `feat`: New feature or functionality
- `fix`: Bug fix
- `refactor`: Code restructuring without behavior change
- `docs`: Documentation only
- `chore`: Build, config, or tooling changes
- `style`: Formatting, no code change

---

## Reflections System

### When to Write a Decision Report (`reflections/decisions/`)
Create a decision report when:
- Implementation deviates from the PRD
- A technical choice differs from the original plan
- Trade-offs are made due to operational realities
- Scope is adjusted (features added, removed, or simplified)

### When to Write an Error Report (`reflections/errors/`)
Create an error report when:
- An error takes more than 10 minutes to resolve
- The solution was non-obvious
- The error could recur in similar situations
- The error reveals a gap in understanding

---

## Development Workflow

1. **Before implementing**: Check the PRD section relevant to the current task
2. **During implementation**: Note any deviations from plan
3. **After completing a unit of work**:
   - Write reflection reports if applicable
   - Commit with full context
4. **Before ending a session**: Ensure all work is committed and documented

---

## Code Standards

- TypeScript strict mode
- Explicit return types on functions
- No `any` types without justification
- Tailwind for styling (no custom CSS unless necessary)
- Server components by default, client components only when needed
- Error boundaries for graceful failure handling
