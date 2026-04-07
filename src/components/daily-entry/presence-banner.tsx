'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Users } from 'lucide-react'

interface PresenceBannerProps {
  editors: Array<{ userId: string; userName: string }>
}

export function PresenceBanner({ editors }: PresenceBannerProps) {
  if (editors.length === 0) return null

  const names = editors.map((e) => e.userName)
  let label: string
  if (names.length === 1) {
    label = `${names[0]} is also viewing this entry`
  } else if (names.length === 2) {
    label = `${names[0]} and ${names[1]} are also viewing this entry`
  } else {
    label = `${names[0]} and ${names.length - 1} others are also viewing this entry`
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="flex items-center gap-2 py-3">
        <Users className="h-4 w-4 text-blue-600" />
        <span className="text-sm text-blue-800 font-medium">{label}</span>
      </CardContent>
    </Card>
  )
}
