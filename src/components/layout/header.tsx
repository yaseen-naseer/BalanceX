'use client';

import { format } from 'date-fns';
import { Calendar, Bell, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openWhatsNew } from '@/components/dashboard/whats-new-dialog';

interface HeaderProps {
    title: string;
    subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
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

            {/* Right: Context & Actions */}
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

                {/* What's New */}
                <Button
                    variant="ghost"
                    onClick={openWhatsNew}
                    className="hover:bg-muted rounded-xl gap-2"
                >
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-semibold">What&apos;s New</span>
                </Button>
            </div>
        </header>
    );
}
