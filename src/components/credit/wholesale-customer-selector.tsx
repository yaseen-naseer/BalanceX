'use client'

import { useState, useMemo } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { ChevronsUpDown, Check, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WholesaleCustomerData } from '@/types'

export interface WholesaleCustomerSelectorProps {
  customers: WholesaleCustomerData[]
  selectedCustomer: WholesaleCustomerData | null
  isLoading: boolean
  onSelect: (customer: WholesaleCustomerData) => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

export function WholesaleCustomerSelector({
  customers,
  selectedCustomer,
  isLoading,
  onSelect,
  searchQuery,
  onSearchChange,
}: WholesaleCustomerSelectorProps) {
  const [open, setOpen] = useState(false)

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers
    const query = searchQuery.toLowerCase()
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.phone.toLowerCase().includes(query) ||
        c.businessName?.toLowerCase().includes(query)
    )
  }, [customers, searchQuery])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedCustomer ? (
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-orange-600" />
              <span>{selectedCustomer.name}</span>
              {selectedCustomer.discountOverride != null && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {selectedCustomer.discountOverride}%
                </Badge>
              )}
            </div>
          ) : (
            'Select wholesale customer...'
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name, phone, or business..."
            value={searchQuery}
            onValueChange={onSearchChange}
          />
          <CommandList>
            <CommandEmpty>{isLoading ? 'Loading...' : 'No wholesale customers found.'}</CommandEmpty>
            <CommandGroup>
              {filteredCustomers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.id}
                  onSelect={() => {
                    onSelect(customer)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedCustomer?.id === customer.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-1 items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-orange-600" />
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {customer.phone}
                          {customer.businessName && ` · ${customer.businessName}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {customer.discountOverride != null && (
                        <Badge variant="outline" className="text-xs">
                          {customer.discountOverride}% fixed
                        </Badge>
                      )}
                      {customer.purchaseCount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {customer.purchaseCount} sale{customer.purchaseCount !== 1 ? 's' : ''}
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
