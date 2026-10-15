import { NextResponse } from "next/server";
import { HttpError, handle, requireAdmin } from "@/lib/api-auth";
import { loadDemoData } from "@/lib/demo";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/** Admin: fill an empty center with sample data and return two demo logins (phone + PIN). */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const existing = await adminDb().collection("batches").limit(1).get();
  if (!existing.empty) throw new HttpError(409, "Demo data can only be loaded into an empty center.");
  const logins = await loadDemoData(admin.email || admin.uid);
  return NextResponse.json({ logins });
});
