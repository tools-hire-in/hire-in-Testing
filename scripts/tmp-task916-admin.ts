import { db } from "../server/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  const hash = await bcrypt.hash("TestPass123!", 12);
  await db.execute(sql`
    INSERT INTO admin_users (email, password, first_name, last_name, role, is_active)
    VALUES ('task916-tester@hire-in.com', ${hash}, 'Task', 'Tester', 'super_admin', true)
    ON CONFLICT (email) DO UPDATE SET password = ${hash}, role = 'super_admin', is_active = true, deleted_at = NULL
  `);
  console.log("test admin ready");
  process.exit(0);
}
main();
