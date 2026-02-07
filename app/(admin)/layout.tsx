import { redirect } from "next/navigation"
import { requireAuth } from "@/components/auth/role-guard"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = await requireAuth()

  if (user.role !== "ADMIN") {
    redirect("/")
  }

  return <>{children}</>
}
