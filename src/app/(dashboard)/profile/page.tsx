'use client'

import { Header } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { User } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { roleLabels, roleBadgeColors, PasswordChangeDialog } from '@/components/settings'

export default function ProfilePage() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col">
      <Header title="Profile" subtitle="Your account information and password" />

      <div className="flex-1 space-y-6 p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Your Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{user?.name || 'Unknown'}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Username</span>
              <span className="font-medium">{user?.username || 'Unknown'}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Role</span>
              <Badge className={user?.role ? roleBadgeColors[user.role] : ''}>
                {user?.role ? roleLabels[user.role] : 'Unknown'}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <span className="text-muted-foreground">Password</span>
                <p className="text-xs text-muted-foreground mt-1">Change your account password</p>
              </div>
              <PasswordChangeDialog />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
