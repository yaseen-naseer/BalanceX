'use client'

export interface User {
  id: string
  username: string
  name: string
  email: string | null
  role: 'OWNER' | 'ACCOUNTANT' | 'SALES'
  isActive: boolean
  createdAt: string
}

export interface UserFormData {
  username: string
  name: string
  email: string
  password: string
  role: 'OWNER' | 'ACCOUNTANT' | 'SALES'
}

export const roleLabels = {
  OWNER: 'Owner',
  ACCOUNTANT: 'Accountant',
  SALES: 'Sales',
} as const

export const roleBadgeColors = {
  OWNER: 'bg-purple-100 text-purple-800',
  ACCOUNTANT: 'bg-blue-100 text-blue-800',
  SALES: 'bg-green-100 text-green-800',
} as const

export const initialFormData: UserFormData = {
  username: '',
  name: '',
  email: '',
  password: '',
  role: 'SALES',
}
