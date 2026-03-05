'use client'

import { useMemo } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ChevronsUpDown, Check, User, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CreditCustomerWithBalance } from '@/types'

export interface CustomerSelectorProps {
  customers: CreditCustomerWithBalance[]
  selectedCustomer: CreditCustomerWithBalance | null
  isLoading: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (customer: CreditCustomerWithBalance) => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

export function CustomerSelector({
  customers,
  selectedCustomer,
  isLoading,
  open,
  onOpenChange,
  onSelect,
  searchQuery,
  onSearchChange,
}: CustomerSelectorProps) {
  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers
    const query = searchQuery.toLowerCase()
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) || c.phone.toLowerCase().includes(query)
    )
  }, [customers, searchQuery])

  const getCustomerIcon = (type: string) => {
    return type === 'CORPORATE' ? (
      <Building2 className="h-4 w-4 text-blue-600" />
    ) : (
      <User className="h-4 w-4 text-emerald-600" />
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedCustomer ? (
            <div className="flex items-center gap-2">
              {getCustomerIcon(selectedCustomer.type)}
              <span>{selectedCustomer.name}</span>
            </div>
          ) : (
            'Select customer...'
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name or phone..."
            value={searchQuery}
            onValueChange={onSearchChange}
          />
          <CommandList>
            <CommandEmpty>{isLoading ? 'Loading...' : 'No customers found.'}</CommandEmpty>
            <CommandGroup>
              {filteredCustomers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.id}
                  onSelect={() => onSelect(customer)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedCustomer?.id === customer.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-1 items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getCustomerIcon(customer.type)}
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.phone}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          'text-sm font-mono',
                          customer.outstandingBalance > 0
                            ? 'text-amber-600'
                            : 'text-muted-foreground'
                        )}
                      >
                        {customer.outstandingBalance.toLocaleString()} MVR
                      </p>
                      {customer.creditLimit !== null && (
                        <p className="text-xs text-muted-foreground">
                          Limit: {customer.creditLimit.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
