import { getInvestigationById } from "@/lib/investigation_record"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const record = getInvestigationById(params.id)
  if (!record) {
    return new NextResponse("Investigation not found", { status: 404 })
  }
  return NextResponse.json(record)
}
