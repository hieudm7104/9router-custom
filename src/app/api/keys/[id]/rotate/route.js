import { NextResponse } from "next/server";
import { rotateApiKey, getApiKeyById } from "@/lib/localDb";

export const dynamic = "force-dynamic";

// POST /api/keys/[id]/rotate - Generate a new key value, keep name + permissions
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    const existing = await getApiKeyById(id);
    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const rotated = await rotateApiKey(id);
    if (!rotated) {
      return NextResponse.json({ error: "Failed to rotate key" }, { status: 500 });
    }

    return NextResponse.json({ key: rotated });
  } catch (error) {
    console.log("Error rotating key:", error);
    return NextResponse.json({ error: "Failed to rotate key" }, { status: 500 });
  }
}
