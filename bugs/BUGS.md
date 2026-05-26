
# Bugs

## In Progress


- [x] Bug — Arch Map scanner missing aliased imports
      in Next.js projects (@/ path aliases)
      FIXED: resolveAliases() reads tsconfig.json paths,
      strips // comments safely (regex preserves quoted
      strings to avoid false matches on "@/*" / "**/*.ts").
      Falls back to @/ → src/ convention if no tsconfig.
      DoulaFlow edges: 10 → 140 after fix.