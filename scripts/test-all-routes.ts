import http from "http"

const routes = [
  "/",
  "/signin",
  "/signup",
  "/dashboard",
  "/dashboard/knowledge-base",
  "/dashboard/verify",
  "/dashboard/analytics",
  "/dashboard/history",
  "/dashboard/courtroom",
  "/dashboard/trust-report",
  "/dashboard/audit-logs",
  "/dashboard/explainability",
  "/api/kb-status",
  "/api/seed-kb",
  "/api/docs",
  "/api/datasets",
  "/api/document-health",
  "/api/benchmark",
  "/api/audit-log",
  "/api/analytics",
]

function checkRoute(path: string): Promise<{ path: string; status: number; error?: string }> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:3000${path}`, (res) => {
      resolve({ path, status: res.statusCode || 0 })
    })
    req.on("error", (err) => {
      resolve({ path, status: 0, error: err.message })
    })
    req.setTimeout(30000, () => {
      req.destroy()
      resolve({ path, status: 408, error: "Timeout" })
    })
  })
}

async function main() {
  console.log("Checking all routes on http://localhost:3003...\n")
  for (const r of routes) {
    const res = await checkRoute(r)
    if (res.status >= 200 && res.status < 400) {
      console.log(`✓ [${res.status}] ${res.path}`)
    } else {
      console.error(`✗ [${res.status}] ${res.path} ${res.error ? `(${res.error})` : ""}`)
    }
  }
}

main().catch(console.error)
