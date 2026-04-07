'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    FileSpreadsheet,
    CheckCircle2,
    Trash2,
    Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

export interface ParsedRow {
    siteName: string;
    paymentMethod: string;
    customerType: string;
    paymentType: string;
    amount: number;
}

export interface ImportPreviewData {
    filename: string;
    date: string;
    rows: ParsedRow[];
    totals: {
        cash: number;
        transfer: number;
        total: number;
    };
}

interface ImportPreviewProps {
    preview: ImportPreviewData;
    selectedDate: Date;
    isImporting: boolean;
    onDiscard: () => void;
    onImport: () => void;
}

export function ImportPreview({
    preview,
    selectedDate,
    isImporting,
    onDiscard,
    onImport,
}: ImportPreviewProps) {
    return (
        <>
            {/* Summary Card */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5" />
                            {preview.filename}
                        </CardTitle>
                        <CardDescription>
                            Will be imported for {format(selectedDate, 'EEEE, dd MMM yyyy')}
                        </CardDescription>
                    </div>
                    <Badge>
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Parsed
                    </Badge>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="bg-emerald-50 border-emerald-200">
                            <CardContent className="pt-4">
                                <p className="text-sm text-muted-foreground">Cash</p>
                                <p className="text-2xl font-bold text-emerald-700">
                                    {preview.totals.cash.toLocaleString()} MVR
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="bg-blue-50 border-blue-200">
                            <CardContent className="pt-4">
                                <p className="text-sm text-muted-foreground">Transfer</p>
                                <p className="text-2xl font-bold text-blue-700">
                                    {preview.totals.transfer.toLocaleString()} MVR
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="bg-primary/10 border-primary/20">
                            <CardContent className="pt-4">
                                <p className="text-sm text-muted-foreground">Total</p>
                                <p className="text-2xl font-bold">
                                    {preview.totals.total.toLocaleString()} MVR
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <Button variant="outline" onClick={onDiscard} disabled={isImporting}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Discard
                        </Button>
                        <Button onClick={onImport} disabled={isImporting}>
                            {isImporting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Import to Daily Entry
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Data Preview Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Imported Data ({preview.rows.length} rows)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Site Name</TableHead>
                                    <TableHead>Payment Method</TableHead>
                                    <TableHead>Customer Type</TableHead>
                                    <TableHead>Payment Type</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {preview.rows.slice(0, 10).map((row, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-medium">{row.siteName}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {row.paymentMethod}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{row.customerType}</TableCell>
                                        <TableCell>{row.paymentType}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {row.amount.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {preview.rows.length > 10 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                                            ... and {preview.rows.length - 10} more rows
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
