import { getSql } from "@/lib/db";
import { isWorkspacePreview } from "@/lib/env.server";

const OWNER_EMAILS = new Set(["notisastranov@gmail.com"]);

export type Access = {
  userId: string;
  email: string;
  owner: boolean;
};

export async function accessFor(userId: string): Promise<Access> {
  const sql = await getSql();
  const people = await sql<{ email: string }>`select "email" as email from "user" where "id" = ${userId}`;
  const email = String(people[0]?.email ?? "").trim().toLowerCase();
  const known = await sql<{ user_id: string }>`select user_id from datanet_owners where user_id = ${userId}`;
  const owner = known.length > 0 || OWNER_EMAILS.has(email) || isWorkspacePreview();
  if (owner && known.length === 0) {
    await sql`insert into datanet_owners (user_id, email) values (${userId}, ${email}) on conflict (user_id) do nothing`;
  }
  return { userId, email, owner };
}
