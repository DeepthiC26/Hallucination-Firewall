import {
  clearAuditLog,
  deleteAuditEntry,
  deleteAuditEntries,
  getAuditLogAll,
} from "@/lib/audit-log"
import { NextResponse } from "next/server"

export async function GET() {
  const log = getAuditLogAll(500)
  return NextResponse.json(log)
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      id?: string
      ids?: string[]
      clearAll?: boolean
    }

    if (body.clearAll) {
      const removed = clearAuditLog()
      return NextResponse.json({ ok: true, removed })
    }

    if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
      const removed = deleteAuditEntries(body.ids)
      return NextResponse.json({ ok: true, removed })
    }

    if (body.id) {
      const ok = deleteAuditEntry(body.id)
      if (!ok) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 })
      }
      return NextResponse.json({ ok: true, removed: 1 })
    }

    return NextResponse.json(
      { error: "Provide id, ids, or clearAll" },
      { status: 400 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
