import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/localDb";
import {
  ENDPOINT_ADMIN_COOKIE,
  verifyEndpointAdminToken,
} from "@/lib/auth/endpointSession";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ENDPOINT_ADMIN_COOKIE)?.value;
    const unlocked = await verifyEndpointAdminToken(token);

    const settings = await getSettings();
    const hasPassword = !!settings.endpointPassword;

    return NextResponse.json({
      unlocked,
      hasPassword,
      usingDefault: !hasPassword,
    });
  } catch {
    return NextResponse.json({ unlocked: false, hasPassword: false, usingDefault: true });
  }
}
