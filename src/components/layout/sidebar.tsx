'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    FileSpreadsheet,
    FileCheck,
    Upload,
    Users,
    Landmark,
    Wallet,
    BarChart3,
    Settings,
    ClipboardList,
    ChevronLeft,
    ChevronRight,
    LogOut,
    User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { canAccessRoute } from '@/lib/permissions';
import type { UserRole } from '@prisma/client';

interface NavItem {
    title: string;
    href: string;
    icon: React.ElementType;
    badge?: string;
}

const navItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
    },
    {
        title: 'Daily Entry',
        href: '/daily-entry',
        icon: FileSpreadsheet,
    },
    {
        title: 'Day Detail',
        href: '/day-detail',
        icon: FileCheck,
    },
    {
        title: 'Import',
        href: '/import',
        icon: Upload,
    },
    {
        title: 'Credit Customers',
        href: '/credit',
        icon: Users,
    },
    {
        title: 'Bank Ledger',
        href: '/bank',
        icon: Landmark,
    },
    {
        title: 'Wallet',
        href: '/wallet',
        icon: Wallet,
    },
    {
        title: 'Monthly Report',
        href: '/reports',
        icon: BarChart3,
    },
];

interface BottomNavItem extends NavItem {
    ownerOnly?: boolean;
}

const bottomNavItems: BottomNavItem[] = [
    { title: 'Profile', href: '/profile', icon: User },
    { title: 'Settings', href: '/settings', icon: Settings },
    { title: 'Audit Log', href: '/audit', icon: ClipboardList, ownerOnly: true },
];

const roleLabels = {
    OWNER: 'Owner',
    ACCOUNTANT: 'Accountant',
    SALES: 'Sales',
} as const;

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const { user, logout } = useAuth();

    const userInitials = user?.name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U';

    return (
        <TooltipProvider delayDuration={0}>
            <aside
                className={cn(
                    'fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300',
                    collapsed ? 'w-16' : 'w-64'
                )}
            >
                {/* Logo */}
                <div className="flex h-16 items-center border-b border-sidebar-border px-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
                            <span className="text-lg font-bold text-sidebar-primary-foreground">B</span>
                        </div>
                        {!collapsed && (
                            <div className="flex flex-col">
                                <span className="text-lg font-bold tracking-tight text-sidebar-foreground">BalanceX</span>
                                <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-bold">Finance Manager</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex flex-col gap-1.5 p-3">
                    {navItems
                        .filter((item) => !user?.role || canAccessRoute(user.role as UserRole, item.href))
                        .map((item) => {
                            const isActive = pathname === item.href;
                            const Icon = item.icon;

                            const linkContent = (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
                                        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                        isActive
                                            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20'
                                            : 'text-sidebar-foreground/60'
                                    )}
                                >
                                    <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60")} />
                                    {!collapsed && <span>{item.title}</span>}
                                </Link>
                            );

                            if (collapsed) {
                                return (
                                    <Tooltip key={item.href}>
                                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                                        <TooltipContent side="right" className="font-medium">
                                            {item.title}
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            }

                            return linkContent;
                        })}
                </nav>

                {/* User & Settings */}
                <div className="absolute bottom-0 left-0 right-0 border-t border-sidebar-border p-3">
                    {/* Bottom nav items: Profile, Settings, Audit */}
                    <div className="flex flex-col gap-1 mb-2">
                        {bottomNavItems
                            .filter((item) => !item.ownerOnly || user?.role === 'OWNER')
                            .map((item) => {
                                const isActive = pathname === item.href;
                                const Icon = item.icon;
                                const linkContent = (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
                                            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                            isActive
                                                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20'
                                                : 'text-sidebar-foreground/60'
                                        )}
                                    >
                                        <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/60')} />
                                        {!collapsed && <span>{item.title}</span>}
                                    </Link>
                                );
                                if (collapsed) {
                                    return (
                                        <Tooltip key={item.href}>
                                            <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                                            <TooltipContent side="right" className="font-medium">
                                                {item.title}
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                }
                                return linkContent;
                            })}
                    </div>

                    {/* User Info */}
                    {user && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className={cn(
                                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all',
                                        collapsed && 'justify-center px-0'
                                    )}
                                >
                                    <Avatar className="h-8 w-8 ring-2 ring-sidebar-border">
                                        <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
                                            {userInitials}
                                        </AvatarFallback>
                                    </Avatar>
                                    {!collapsed && (
                                        <div className="flex flex-col items-start overflow-hidden">
                                            <span className="truncate font-bold text-sidebar-foreground">
                                                {user.name}
                                            </span>
                                            <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-bold">
                                                {user.role && roleLabels[user.role]}
                                            </span>
                                        </div>
                                    )}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" align="end" className="w-56 bg-sidebar border-sidebar-border text-sidebar-foreground">
                                <DropdownMenuLabel>
                                    <div className="flex flex-col">
                                        <span className="font-bold">{user.name}</span>
                                        <span className="text-[10px] uppercase font-bold text-sidebar-foreground/50">
                                            {user.role && roleLabels[user.role]}
                                        </span>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-sidebar-border" />
                                <DropdownMenuItem
                                    onClick={logout}
                                    className="cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-400/10 font-medium"
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Sign Out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {/* Collapse Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCollapsed(!collapsed)}
                        className={cn(
                            'mt-2 w-full justify-center text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                            collapsed ? 'px-0' : ''
                        )}
                    >
                        {collapsed ? (
                            <ChevronRight className="h-4 w-4" />
                        ) : (
                            <>
                                <ChevronLeft className="h-4 w-4 mr-2" />
                                <span className="font-bold text-xs uppercase tracking-wider">Collapse</span>
                            </>
                        )}
                    </Button>
                </div>
            </aside>
        </TooltipProvider>
    );
}
