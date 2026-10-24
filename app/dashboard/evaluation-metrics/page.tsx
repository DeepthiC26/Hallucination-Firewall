import { redirect } from "next/navigation"

export default function EvaluationMetricsRedirect() {
  redirect("/dashboard/analytics#firewall-performance")
}
