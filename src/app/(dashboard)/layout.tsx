import { Sidebar } from "@/components/layout"
import { IdleTimeout } from "@/components/layout/idle-timeout"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import type { ReactNode } from "react"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    // Only hit the DB when there's no session — check if setup is still needed
    const count = await prisma.user.count()
    redirect(count === 0 ? "/setup" : "/login")
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <IdleTimeout />
      <main className="flex-1 ml-64 transition-all duration-300">
        {children}
      </main>
    </div>
  )
}
