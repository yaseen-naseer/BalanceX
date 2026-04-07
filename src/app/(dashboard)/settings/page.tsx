'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApiClient } from '@/hooks/use-api-client'
import { Header } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Users, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import {
  type User,
  type UserFormData,
  initialFormData,
  UserFormDialog,
  AddUserButton,
  UserTable,
  DataManagementSection,
  CashFloatSettingsSection,
  ShiftSettingsSection,
  AuditLogSection,
  WholesaleTiersSection,
} from '@/components/settings'

export default function SettingsPage() {
  const api = useApiClient()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<UserFormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isOwner = currentUser?.role === 'OWNER'

  const fetchUsers = useCallback(async () => {
    if (currentUser?.role !== 'OWNER') {
      setIsLoadingUsers(false)
      return
    }

    try {
      const result = await api.get<User[]>('/api/users')
      if (result.success && result.data) {
        setUsers(result.data)
      } else {
        toast.error(result.error || 'Failed to load users')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to load users')
    } finally {
      setIsLoadingUsers(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.role])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleAddUser = async () => {
    if (!formData.username || !formData.name || !formData.password) {
      toast.error('Username, name, and password are required')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await api.post('/api/users', formData)

      if (result.success) {
        toast.success('User created successfully')
        setShowAddDialog(false)
        setFormData(initialFormData)
        fetchUsers()
      } else {
        toast.error(result.error || 'Failed to create user')
      }
    } catch {
      toast.error('Failed to create user')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditUser = async () => {
    if (!editingUser) return

    setIsSubmitting(true)
    try {
      const updateData: Record<string, unknown> = {
        name: formData.name,
        email: formData.email || null,
        role: formData.role,
      }
      if (formData.password) {
        updateData.password = formData.password
      }

      const result = await api.put(`/api/users/${editingUser.id}`, updateData)

      if (result.success) {
        toast.success('User updated successfully')
        setShowEditDialog(false)
        setEditingUser(null)
        setFormData(initialFormData)
        fetchUsers()
      } else {
        toast.error(result.error || 'Failed to update user')
      }
    } catch {
      toast.error('Failed to update user')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeactivateUser = async (userId: string) => {
    try {
      const result = await api.delete(`/api/users/${userId}`)
      if (result.success) {
        toast.success('User deactivated')
        fetchUsers()
      } else {
        toast.error(result.error || 'Failed to deactivate user')
      }
    } catch {
      toast.error('Failed to deactivate user')
    }
  }

  const handleReactivateUser = async (userId: string) => {
    try {
      const result = await api.put(`/api/users/${userId}`, { isActive: true })

      if (result.success) {
        toast.success('User reactivated')
        fetchUsers()
      } else {
        toast.error(result.error || 'Failed to reactivate user')
      }
    } catch {
      toast.error('Failed to reactivate user')
    }
  }

  const openEditDialog = (user: User) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      name: user.name,
      email: user.email || '',
      password: '',
      role: user.role,
    })
    setShowEditDialog(true)
  }

  const handleFormChange = (data: Partial<UserFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }))
  }

  return (
    <div className="flex flex-col">
      <Header title="Settings" subtitle="Application configuration and data management" />

      <div className="flex-1 space-y-6 p-6 max-w-5xl">
        {/* User Management (Owner Only) */}
        {isOwner && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
                <CardDescription>Manage user accounts and permissions</CardDescription>
              </div>
              <AddUserButton onClick={() => setShowAddDialog(true)} />
            </CardHeader>
            <CardContent>
              <UserTable
                users={users}
                currentUserId={currentUser?.id}
                isLoading={isLoadingUsers}
                onEdit={openEditDialog}
                onDeactivate={handleDeactivateUser}
                onReactivate={handleReactivateUser}
              />
            </CardContent>
          </Card>
        )}

        {/* Add User Dialog */}
        <UserFormDialog
          mode="add"
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          formData={formData}
          onFormChange={handleFormChange}
          onSubmit={handleAddUser}
          isSubmitting={isSubmitting}
        />

        {/* Edit User Dialog */}
        <UserFormDialog
          mode="edit"
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          formData={formData}
          onFormChange={handleFormChange}
          onSubmit={handleEditUser}
          isSubmitting={isSubmitting}
          editingUser={editingUser}
        />

        {/* Cash Float Settings (Owner Only) */}
        {isOwner && <CashFloatSettingsSection isOwner={isOwner} />}

        {/* Wholesale Discount Tiers (Owner Only) */}
        {isOwner && <WholesaleTiersSection isOwner={isOwner} />}

        {/* Shift Settings (Owner Only) */}
        {isOwner && <ShiftSettingsSection isOwner={isOwner} />}

        {/* Audit Log (Owner Only) */}
        {isOwner && <AuditLogSection />}

        {/* Data Management */}
        <DataManagementSection isOwner={isOwner} />

        {/* Application Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Application Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Application</span>
              <span className="font-medium">BalanceX</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Version</span>
              <Badge variant="secondary">MVP v1.0.0</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Storage</span>
              <Badge variant="outline">PostgreSQL Database</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge className="bg-emerald-600">Connected</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
