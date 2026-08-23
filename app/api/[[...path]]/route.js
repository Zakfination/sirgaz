import { NextResponse } from "next/server";

// Legacy Mongo catch-all endpoint intentionally disabled.
// sirgaZ production data access is Supabase/RLS/RPC only.
const disabled = () => NextResponse.json({ error: "Legacy API disabled" }, { status: 404 });

export const GET = disabled;
export const POST = disabled;
export const PUT = disabled;
export const PATCH = disabled;
export const DELETE = disabled;
export const OPTIONS = () => new NextResponse(null, { status: 204 });
