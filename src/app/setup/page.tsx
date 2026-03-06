import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { SetupWizard } from "./setup-wizard"

export const dynamic = "force-dynamic"

export default async function SetupPage() {
  // If any user exists, setup is complete — lock the page permanently
  const count = await prisma.user.count()
  if (count > 0) {
    redirect("/")
  }

  return <SetupWizard />
}
