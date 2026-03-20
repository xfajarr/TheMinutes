import { readFileSync } from "fs";
import { join } from "path";
import { db } from "./client";

const schema = readFileSync(join(import.meta.dir, "schema.sql"), "utf-8");

await db.unsafe(schema);
console.log("✓ Migrations applied");
await db.end();
