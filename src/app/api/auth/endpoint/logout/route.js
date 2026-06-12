import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearEndpointAdminCookie } from "@/lib/auth/endpointSession";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  clearEndpointAdminCookie(cookieStore);
  return NextResponse.json({ success: true });
}
