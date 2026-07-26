---
name: VerifyLetter IIFE dead-code trap
description: JSX elements placed after an IIFE's return(…) close are dead code that crashes the Vite/Babel pre-transform, shutting down the dev server.
---

# VerifyLetter IIFE dead-code trap

`client/src/pages/VerifyLetter.tsx` renders the HR letter branch via an IIFE:

```tsx
) : (
  (() => {
    const r = result as HrLetterVerifyResult;
    const isAmendment = ...;
    return (
      <div className="grid ...">
        {/* grid items */}
      </div>
    );          ← `)` closes return(, `}` closes function body
  })()         ← closes outer `(` and calls the IIFE
)
```

**The trap**: New JSX children added after the `return (…);` closing `)` but before the `})()` invocation end up inside the IIFE body as unreachable code. Babel's JSX parser hits a `{` in a JS-expression context (not JSX), throws "Unexpected token, expected ','", and the Vite pre-transform error crashes the dev-server process via an uncaught exception.

**Why it kills the server**: `uncaughtException → shutdown` (boot-stability rule). If the error fires before "Background startup tasks complete", the whole app is down.

**How to apply**: When adding new fields to the HR-letter verify grid, insert them INSIDE the `<div className="grid">` before its closing `</div>`, before the `);` that ends the `return (`. Do not add any JSX after that `)`. Ensure the IIFE ends with `})()` at 16-space indentation.

**Symptom**: `SyntaxError: Unexpected token, expected "," (N:18)` in Vite logs pointing to a `{` that starts a JSX expression inside the IIFE body.
