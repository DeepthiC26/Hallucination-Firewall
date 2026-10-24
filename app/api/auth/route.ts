import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const SESSION_COOKIE = "hf_session"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export async function POST(req: Request) {
  const { action, name, email } = await req.json()

  if (action === "login" || action === "signup") {
    const cookieStore = cookies()
    cookieStore.set(SESSION_COOKIE, "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    })

    return NextResponse.json({
      ok: true,
      user: { name: name || email?.split("@")[0] || "User", email },
    })
  }

  if (action === "logout") {
    const cookieStore = cookies()
    cookieStore.delete(SESSION_COOKIE)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get(SESSION_COOKIE)
  return NextResponse.json({ authenticated: !!session?.value })
}
