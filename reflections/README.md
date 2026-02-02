# Reflections

This folder maintains the project's institutional memory through two types of reports.

## Purpose

**Audit Trail**: Every significant decision and error is documented with full context, enabling future review of why the project evolved as it did.

**Learning Loop**: Each report captures lessons learned, creating a knowledge base that improves future development.

---

## Folder Structure

```
reflections/
├── decisions/       # Design deviations and trade-off records
│   └── _TEMPLATE.md
├── errors/          # Error investigations and solutions
│   └── _TEMPLATE.md
└── README.md
```

---

## Naming Convention

### Decision Reports
```
YYYY-MM-DD-[short-slug].md
```
Example: `2026-02-02-batch-limit-reduced.md`

### Error Reports
```
YYYY-MM-DD-[error-type]-[short-slug].md
```
Example: `2026-02-02-build-next-standalone-config.md`

---

## When to Write

| Situation | Report Type |
|-----------|-------------|
| PRD says X, we built Y | Decision |
| Chose between multiple valid approaches | Decision |
| Simplified scope due to time/complexity | Decision |
| Error took >10 min to debug | Error |
| Solution was non-obvious | Error |
| Same error could happen again | Error |

---

## Quick Reference

**Decision reports answer**: "Why didn't we follow the plan?"

**Error reports answer**: "What went wrong and how do we prevent it?"
