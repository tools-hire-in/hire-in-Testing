---
name: AdminLayout named export
description: AdminLayout is a named export, not a default export — wrong import crashes at runtime.
---

# AdminLayout is a named (not default) export

The file `client/src/components/admin/AdminLayout.tsx` exports AdminLayout as a **named** export:

```ts
export function AdminLayout({ children }: AdminLayoutProps) { … }
```

**Why this matters:** Importing as `import AdminLayout from "@/components/admin/AdminLayout"` compiles but fails at runtime with:
> "The requested module does not provide an export named 'default'"

**How to apply:** Always use the named import form:
```ts
import { AdminLayout } from "@/components/admin/AdminLayout";
```
