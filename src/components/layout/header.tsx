'use client';

import { format } from 'date-fns';
import { Calendar, Bell, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';

interface HeaderProps {
    title: string;
    subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
    const { user, logout } = useAuth();
    const today = new Date();

    return (
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-background/80 px-8 backdrop-blur-md">
            {/* Left: Title */}
            <div className="flex flex-col">
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
                {subtitle && (
                    <p className="text-sm font-medium text-muted-foreground">{subtitle}</p>
                )}
            </div>

            {/* Right: Context & User */}
            <div className="flex items-center gap-6">
                {/* Date Context */}
                <div className="hidden md:flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-2 border border-border/50">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold tracking-tight">
                        {format(today, 'dd MMM yyyy')}
                    </span>
                </div>

                {/* Notifications */}
                <Button variant="ghost" size="icon" className="relative hover:bg-muted rounded-xl">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                </Button>

                {/* User Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-10 w-10 rounded-xl p-0 overflow-hidden ring-1 ring-border hover:ring-primary/50 transition-all">
                            <Avatar className="h-10 w-10 rounded-xl">
                                <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                                    {user?.name?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-bold leading-none">{user?.name || 'User'}</p>
                                <p className="text-[10px] items-center px-1.5 py-0.5 rounded-full bg-primary/10 text-primary w-fit font-bold uppercase tracking-wider">
                                    {user?.role || 'Staff'}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="cursor-pointer font-semibold">Profile</DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer font-semibold">Settings</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer font-semibold">
                            <LogOut className="mr-2 h-4 w-4" />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
