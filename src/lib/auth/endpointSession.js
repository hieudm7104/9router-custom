import { SignJWT, jwtVerify } from "jose";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR } from "@/lib/dataDir";

// Reuse the same JWT secret resolution as the dashboard session so a single
// JWT_SECRET / generated secret protects both the dashboard login and the
// dedicated endpoint-admin layer.
function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, "jwt-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {}
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const generated = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(file, generated, { mode: 0o600 });
  return generated;
}

const SECRET = new TextEncoder().encode(loadJwtSecret());

export const ENDPOINT_ADMIN_COOKIE = "endpoint_admin_token";

// Default admin password when the admin has never set one.
export const DEFAULT_ENDPOINT_PASSWORD =
  process.env.ENDPOINT_PASSWORD || "123456";

export function shouldUseSecureCookie(request) {
  const forceSecureCookie = process.env.AUTH_COOKIE_SECURE === "true";
  const forwardedProto = request?.headers?.get?.("x-forwarded-proto");
  const isHttpsRequest = forwardedProto === "https";
  return forceSecureCookie || isHttpsRequest;
}

export async function createEndpointAdminToken(claims = {}) {
  return new SignJWT({ endpointAdmin: true, ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(SECRET);
}

export async function verifyEndpointAdminToken(token) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload?.endpointAdmin === true;
  } catch {
    return false;
  }
}

export async function setEndpointAdminCookie(cookieStore, request) {
  const token = await createEndpointAdminToken();
  cookieStore.set(ENDPOINT_ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "lax",
    path: "/",
  });
}

export function clearEndpointAdminCookie(cookieStore) {
  cookieStore.delete(ENDPOINT_ADMIN_COOKIE);
}
