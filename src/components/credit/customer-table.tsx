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
import { CreditCard, Phone, Mail, FileText, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LedgerDialog } from './ledger-dialog'
import { SettlementDialog } from './settlement-dialog'
import { CustomerFormDialog } from './customer-form-dialog'
import type { CreditCustomerWithBalance, CreateSettlementDto, UpdateCreditCustomerDto } from '@/types'

export interface CustomerTableProps {
  customers: CreditCustomerWithBalance[]
  isLoading: boolean
  isSales: boolean
  searchQuery: string
  onSettlement: (customerId: string, data: CreateSettlementDto) => Promise<void>
  onUpdate: (id: string, data: UpdateCreditCustomerDto) => Promise<void>
}

export function CustomerTable({
  customers,
  isLoading,
  isSales,
  searchQuery,
  onSettlement,
  onUpdate,
}: CustomerTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Credit Limit</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12">
                <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No customers match your search' : 'No credit customers yet'}
                </p>
              </TableCell>
            </TableRow>
          ) : (
            customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>
                  <div className="font-medium">{customer.name}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={customer.type === 'CORPORATE' ? 'default' : 'secondary'}>
                    {customer.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {customer.phone && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </div>
                    )}
                    {customer.email && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {customer.email}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {customer.creditLimit ? (
                    <span className="font-mono">{customer.creditLimit.toLocaleString()} MVR</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      'font-mono font-medium',
                      customer.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
                    )}
                  >
                    {customer.outstandingBalance.toLocaleString()} MVR
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <LedgerDialog
                      customer={customer}
                      trigger={
                        <Button size="sm" variant="outline">
                          <FileText className="h-4 w-4 mr-1" />
                          Ledger
                        </Button>
                      }
                    />
                    {!isSales && (
                      <CustomerFormDialog
                        mode="edit"
                        initialData={customer}
                        onSubmit={async () => {}}
                        onUpdate={onUpdate}
                        trigger={
                          <Button size="sm" variant="outline">
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        }
                      />
                    )}
                    {customer.outstandingBalance > 0 && !isSales && (
                      <SettlementDialog
                        customer={customer}
                        onSubmit={onSettlement}
                        trigger={<Button size="sm">Settle</Button>}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
