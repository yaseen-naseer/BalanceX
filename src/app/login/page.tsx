import { LoginForm } from "@/components/auth"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function LoginPage() {
  const count = await prisma.user.count()
  if (count === 0) {
    redirect("/setup")
  }

  const session = await getServerSession(authOptions)
  if (session) {
    redirect("/")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <LoginForm />
    </div>
  )
}
