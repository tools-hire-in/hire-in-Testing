---
name: drizzle-kit push needs TTY
description: drizzle-kit push uses an arrow-key terminal UI that can't be piped. Use a SQL script to apply schema when new tables/columns are needed.
---

# drizzle-kit push needs TTY

## Rule
When `drizzle-kit push` needs to apply new tables or columns, it will hang on an interactive arrow-key prompt that `printf "\n"` or `echo "yes"` cannot navigate reliably. Instead, write a `scripts/apply-*.ts` file that uses `db.execute(sql\`...\`)` with `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` and run it via `npx tsx`.

**Why:** The drizzle-kit push interactive UI is a proper terminal UI (not simple line-based stdin), requiring a real TTY. The piping workaround only works occasionally.

**How to apply:** Any time a session plan includes `db:push` for new tables/columns, budget for a fallback SQL script. The script pattern is already proven at `scripts/apply-salary-structure-schema.ts`.

Also: the `drizzle-kit push` prompt about "add unique constraint without truncating" selects "No" by default — not a blocker, just noise in the output.
