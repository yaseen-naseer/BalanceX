'use client'

import { Header } from '@/components/layout'
import { useAuth } from '@/hooks/use-auth'
import { AuditLogSection } from '@/components/settings'

export default function AuditPage() {
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'

  return (
    <div className="flex flex-col">
      <Header title="Audit Log" subtitle="Security and activity trail" />

      <div className="flex-1 space-y-6 p-6 max-w-5xl">
        {isOwner ? (
          <AuditLogSection />
        ) : (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            Only Owners can view the audit log.
          </div>
        )}
      </div>
    </div>
  )
}
