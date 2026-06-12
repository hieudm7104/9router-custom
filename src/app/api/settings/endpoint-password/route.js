import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSettings, updateSettings } from "@/lib/localDb";

export const dynamic = "force-dynamic";

// This route lives under /api/settings/* so it is protected by the dashboard
// guard (requires dashboard login). It manages the SAME endpointPassword used
// by the /dashboard/endpoint admin lock, so an authenticated dashboard admin
// can set/reset the shared endpoint password directly from /dashboard/profile.

// GET - report whether an endpoint password has been set (never returns the value).
export async function GET() {
  try {
    const settings = await getSettings();
    const hasPassword = !!settings.endpointPassword;
    return NextResponse.json({ hasPassword, usingDefault: !hasPassword });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - set/reset the shared endpoint password. The caller is already an
// authenticated dashboard admin (guard enforces it), so no current password
// is required here.
export async function PUT(request) {
  try {
    const { newPassword } = await request.json();
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 4) {
      return NextResponse.json(
        { error: "New password must be at least 4 characters" },
        { status: 400 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    await updateSettings({ endpointPassword: hash });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
