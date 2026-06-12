import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getSettings } from "@/lib/localDb";
import {
  setEndpointAdminCookie,
  DEFAULT_ENDPOINT_PASSWORD,
} from "@/lib/auth/endpointSession";
import { checkLock, recordFail, recordSuccess, getClientIp } from "@/lib/auth/loginLimiter";

export const dynamic = "force-dynamic";

// Separate lockout counter from the dashboard login (prefix the ip key).
function lockKey(request) {
  return `endpoint:${getClientIp(request)}`;
}

export async function POST(request) {
  try {
    const key = lockKey(request);
    const lock = checkLock(key);
    if (lock.locked) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${lock.retryAfter}s.`, retryAfter: lock.retryAfter },
        { status: 429, headers: { "Retry-After": String(lock.retryAfter) } }
      );
    }

    const { password } = await request.json();
    if (typeof password !== "string") {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    const settings = await getSettings();
    const storedHash = settings.endpointPassword;

    let isValid = false;
    if (storedHash) {
      isValid = await bcrypt.compare(password, storedHash);
    } else {
      // No admin password set yet → accept the default.
      isValid = password === DEFAULT_ENDPOINT_PASSWORD;
    }

    if (isValid) {
      recordSuccess(key);
      const cookieStore = await cookies();
      await setEndpointAdminCookie(cookieStore, request);
      return NextResponse.json({ success: true, usingDefault: !storedHash });
    }

    const { remainingBeforeLock } = recordFail(key);
    const postLock = checkLock(key);
    if (postLock.locked) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${postLock.retryAfter}s.`, retryAfter: postLock.retryAfter },
        { status: 429, headers: { "Retry-After": String(postLock.retryAfter) } }
      );
    }
    return NextResponse.json(
      { error: `Invalid password. ${remainingBeforeLock} attempt(s) left before lockout.`, remainingBeforeLock },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
