import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getSettings, updateSettings } from "@/lib/localDb";
import {
  ENDPOINT_ADMIN_COOKIE,
  verifyEndpointAdminToken,
  setEndpointAdminCookie,
  DEFAULT_ENDPOINT_PASSWORD,
} from "@/lib/auth/endpointSession";

export const dynamic = "force-dynamic";

// PATCH /api/auth/endpoint/password - change the endpoint admin password.
// Requires an already-unlocked admin session (endpoint_admin_token).
export async function PATCH(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ENDPOINT_ADMIN_COOKIE)?.value;
    if (!(await verifyEndpointAdminToken(token))) {
      return NextResponse.json({ error: "Endpoint admin unlock required" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 4) {
      return NextResponse.json({ error: "New password must be at least 4 characters" }, { status: 400 });
    }

    const settings = await getSettings();
    const storedHash = settings.endpointPassword;

    // Verify the current password (hash if set, otherwise the default).
    let currentValid = false;
    if (storedHash) {
      currentValid = await bcrypt.compare(currentPassword || "", storedHash);
    } else {
      currentValid = (currentPassword || "") === DEFAULT_ENDPOINT_PASSWORD;
    }
    if (!currentValid) {
      return NextResponse.json({ error: "Invalid current password" }, { status: 401 });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    await updateSettings({ endpointPassword: hash });

    // Refresh the admin cookie so the session stays valid after the change.
    await setEndpointAdminCookie(cookieStore, request);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
