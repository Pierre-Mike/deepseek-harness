**Neither change needs an Agent Note.**

1. **Button relocation**: Exempt as a "local UI presentation tweak" (Instructions, "When to write a note"). Moving a button for discoverability is a UI adjustment, not a lasting decision a maintainer would revisit.

2. **Variable rename** (`tmp` → `rows`): Exempt as "a rename with no naming rule behind it." This is mechanical refactoring of a local variable scoped to one function.

Both fall below the threshold. If the button move solves a real UX problem, a one-line commit message ("moved Export button to top-right for discoverability") documents the rationale without a note.