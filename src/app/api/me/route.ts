import { NextResponse } from "next/server";
import { handle, resolveIdentity, verifyRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const id = await resolveIdentity(await verifyRequest(req));
  return NextResponse.json({
    role: id.role,
    name: id.name || null,
    email: id.email || null,
    phone: id.phone || null,
    reason: id.reason || null,
  });
});
