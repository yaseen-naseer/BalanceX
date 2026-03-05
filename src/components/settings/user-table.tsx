'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pencil, UserX, CheckCircle2, XCircle } from 'lucide-react'
import { roleLabels, roleBadgeColors, type User } from './types'

export interface UserTableProps {
  users: User[]
  currentUserId: string | undefined
  isLoading: boolean
  onEdit: (user: User) => void
  onDeactivate: (userId: string) => void
  onReactivate: (userId: string) => void
}

export function UserTable({
  users,
  currentUserId,
  isLoading,
  onEdit,
  onDeactivate,
  onReactivate,
}: UserTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>{user.username}</TableCell>
              <TableCell>
                <Badge className={roleBadgeColors[user.role]}>{roleLabels[user.role]}</Badge>
              </TableCell>
              <TableCell>
                {user.isActive ? (
                  <Badge variant="outline" className="text-emerald-600">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-rose-600">
                    <XCircle className="mr-1 h-3 w-3" />
                    Inactive
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(user)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {user.id !== currentUserId &&
                    (user.isActive ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeactivate(user.id)}
                        className="text-rose-600 hover:text-rose-700"
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReactivate(user.id)}
                        className="text-emerald-600 hover:text-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
