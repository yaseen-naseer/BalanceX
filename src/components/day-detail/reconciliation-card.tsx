'use client'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Banknote, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DailyEntryWithRelations } from '@/types'
import type { CalculationData } from '@/hooks/use-daily-entry'
import type { EntryTotals } from './types'

export interface ReconciliationCardProps {
  entry: DailyEntryWithRelations
  totals: EntryTotals
  calculationData: CalculationData
  walletTopupsTotal: number
}

export function ReconciliationCard({
  entry,
  totals,
  calculationData,
  walletTopupsTotal,
}: ReconciliationCardProps) {
  if (!entry.cashDrawer && !entry.wallet) return null

  return (
    <div className="space-y-4">
      {/* Summary Reconciliation Card */}
      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-primary">
          Reconciliation
        </h4>

        {/* Cash Drawer Summary Row */}
        {entry.cashDrawer && (
          <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-primary/10">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-emerald-600" />
              <span className="font-medium text-sm">Cash Drawer:</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono text-sm">
              <span>
                Expected{' '}
                <span className="font-semibold">
                  {Number(entry.cashDrawer.closingExpected).toLocaleString()}
                </span>
              </span>
              <span className="text-muted-foreground">|</span>
              <span>
                Actual{' '}
                <span className="font-semibold">
                  {Number(entry.cashDrawer.closingActual).toLocaleString()}
                </span>
              </span>
              <span className="text-muted-foreground">|</span>
              <span
                className={cn(
                  'font-semibold',
                  entry.cashDrawer.variance === 0 ? 'text-emerald-600' : 'text-amber-600'
                )}
              >
                Var {Number(entry.cashDrawer.variance) > 0 ? '+' : ''}
                {Number(entry.cashDrawer.variance).toLocaleString()}
                {Number(entry.cashDrawer.variance) !== 0 && ' ⚠️'}
              </span>
            </div>
          </div>
        )}

        {/* Wallet Summary Row */}
        {entry.wallet && (
          <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-primary/10">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-sm">Wallet:</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono text-sm">
              <span>
                Expected{' '}
                <span className="font-semibold">
                  {Number(entry.wallet.closingExpected).toLocaleString()}
                </span>
              </span>
              <span className="text-muted-foreground">|</span>
              <span>
                Actual{' '}
                <span className="font-semibold">
                  {Number(entry.wallet.closingActual).toLocaleString()}
                </span>
              </span>
              <span className="text-muted-foreground">|</span>
              <span
                className={cn(
                  'font-semibold',
                  entry.wallet.variance === 0 ? 'text-emerald-600' : 'text-amber-600'
                )}
              >
                Var {Number(entry.wallet.variance) > 0 ? '+' : ''}
                {Number(entry.wallet.variance).toLocaleString()}
                {Number(entry.wallet.variance) !== 0 && ' ⚠️'}
              </span>
            </div>
          </div>
        )}

        {/* Bank Deposit Summary Row */}
        {entry.cashDrawer && Number(entry.cashDrawer.bankDeposits) > 0 && (
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-sm">Bank Deposit:</span>
            </div>
            <span className="font-mono text-sm font-semibold text-blue-600">
              MVR {Number(entry.cashDrawer.bankDeposits).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Detailed Calculation Breakdown */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">Calculation Breakdown</h4>

        {/* Cash Drawer Calculation */}
        {entry.cashDrawer && (
          <CashDrawerCalculation
            cashDrawer={entry.cashDrawer}
            totalCash={totals.totalCash}
            calculationData={calculationData}
          />
        )}

        {/* Wallet Calculation */}
        {entry.wallet && (
          <WalletCalculation
            wallet={entry.wallet}
            reloadSales={totals.reloadSales}
            walletTopupsTotal={walletTopupsTotal}
          />
        )}
      </div>
    </div>
  )
}

interface CashDrawerCalculationProps {
  cashDrawer: NonNullable<DailyEntryWithRelations['cashDrawer']>
  totalCash: number
  calculationData: CalculationData
}

function CashDrawerCalculation({
  cashDrawer,
  totalCash,
  calculationData,
}: CashDrawerCalculationProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2',
        cashDrawer.variance === 0
          ? 'bg-muted/50'
          : Math.abs(Number(cashDrawer.variance)) > 500
            ? 'bg-rose-50 border-rose-200'
            : 'bg-amber-50 border-amber-200'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-emerald-600" />
          <span className="font-medium text-sm">Cash Drawer Calculation</span>
        </div>
        <Badge
          variant={
            cashDrawer.variance === 0
              ? 'default'
              : Math.abs(Number(cashDrawer.variance)) > 500
                ? 'destructive'
                : 'secondary'
          }
        >
          {cashDrawer.variance === 0
            ? 'Balanced'
            : Math.abs(Number(cashDrawer.variance)) > 500
              ? 'High Variance'
              : 'Minor Variance'}
        </Badge>
      </div>

      <div className="bg-white/50 rounded p-2 space-y-1 text-sm font-mono">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Opening Balance</span>
          <span>{Number(cashDrawer.opening).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-emerald-600">
          <span>+ Cash Sales</span>
          <span>+{totalCash.toLocaleString()}</span>
        </div>
        {calculationData.cashSettlements > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>+ Cash Settlements</span>
            <span>+{calculationData.cashSettlements.toLocaleString()}</span>
          </div>
        )}
        {Number(cashDrawer.bankDeposits) > 0 && (
          <div className="flex justify-between text-blue-600">
            <span>- Bank Deposits</span>
            <span>-{Number(cashDrawer.bankDeposits).toLocaleString()}</span>
          </div>
        )}
        {calculationData.walletTopupsFromCash > 0 && (
          <div className="flex justify-between text-rose-600">
            <span>- Wallet Top-ups (Cash)</span>
            <span>-{calculationData.walletTopupsFromCash.toLocaleString()}</span>
          </div>
        )}
        <Separator className="my-1" />
        <div className="flex justify-between font-semibold">
          <span>= Expected Closing</span>
          <span>{Number(cashDrawer.closingExpected).toLocaleString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm pt-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Actual Closing:</span>
          <span className="font-mono font-medium">
            {Number(cashDrawer.closingActual).toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Variance:</span>
          <span
            className={cn(
              'font-mono font-bold',
              cashDrawer.variance === 0
                ? 'text-emerald-600'
                : Number(cashDrawer.variance) > 0
                  ? 'text-emerald-600'
                  : 'text-rose-600'
            )}
          >
            {Number(cashDrawer.variance) > 0 ? '+' : ''}
            {Number(cashDrawer.variance).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}

interface WalletCalculationProps {
  wallet: NonNullable<DailyEntryWithRelations['wallet']>
  reloadSales: number
  walletTopupsTotal: number
}

function WalletCalculation({ wallet, reloadSales, walletTopupsTotal }: WalletCalculationProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2',
        wallet.variance === 0
          ? 'bg-muted/50'
          : Math.abs(Number(wallet.variance)) > 500
            ? 'bg-rose-50 border-rose-200'
            : 'bg-amber-50 border-amber-200'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-blue-600" />
          <span className="font-medium text-sm">Wallet Calculation</span>
        </div>
        <Badge
          variant={
            wallet.variance === 0
              ? 'default'
              : Math.abs(Number(wallet.variance)) > 500
                ? 'destructive'
                : 'secondary'
          }
        >
          {wallet.variance === 0
            ? 'Balanced'
            : Math.abs(Number(wallet.variance)) > 500
              ? 'High Variance'
              : 'Minor Variance'}
        </Badge>
      </div>

      <div className="bg-white/50 rounded p-2 space-y-1 text-sm font-mono">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Opening Balance</span>
          <span>{Number(wallet.opening).toLocaleString()}</span>
        </div>
        <div className="text-xs text-muted-foreground pl-2">
          ({wallet.openingSource.replace(/_/g, ' ')})
        </div>
        {walletTopupsTotal > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>+ Top-ups</span>
            <span>+{walletTopupsTotal.toLocaleString()}</span>
          </div>
        )}
        {reloadSales > 0 && (
          <div className="flex justify-between text-rose-600">
            <span>- Reload Sales</span>
            <span>-{reloadSales.toLocaleString()}</span>
          </div>
        )}
        <Separator className="my-1" />
        <div className="flex justify-between font-semibold">
          <span>= Expected Closing</span>
          <span>{Number(wallet.closingExpected).toLocaleString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm pt-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Actual Closing:</span>
          <span className="font-mono font-medium">
            {Number(wallet.closingActual).toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Variance:</span>
          <span
            className={cn(
              'font-mono font-bold',
              wallet.variance === 0
                ? 'text-emerald-600'
                : Number(wallet.variance) > 0
                  ? 'text-emerald-600'
                  : 'text-rose-600'
            )}
          >
            {Number(wallet.variance) > 0 ? '+' : ''}
            {Number(wallet.variance).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}
