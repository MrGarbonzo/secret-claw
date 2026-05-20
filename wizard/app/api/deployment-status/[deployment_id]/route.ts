import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: { deployment_id: string } },
) {
  const id = context.params.deployment_id;
  if (!id) {
    return NextResponse.json({ error: "deployment_id missing" }, { status: 400 });
  }
  const record = await db.get(id);
  if (!record) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(record);
}
