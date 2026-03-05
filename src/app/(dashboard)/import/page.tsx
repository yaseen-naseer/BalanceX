'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Upload,
    FileSpreadsheet,
    CheckCircle2,
    Trash2,
    Loader2,
    CalendarIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ParsedRow {
    siteName: string;
    paymentMethod: string;
    customerType: string;
    paymentType: string;
    amount: number;
}

interface ImportPreview {
    filename: string;
    date: string;
    rows: ParsedRow[];
    totals: {
        cash: number;
        transfer: number;
        total: number;
    };
}

export default function ImportPage() {
    const router = useRouter();
    const [isDragging, setIsDragging] = useState(false);
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const parseFile = useCallback(async (file: File) => {
        try {
            // Dynamic import of xlsx library
            const XLSX = await import('xlsx');
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as (string | number)[][];

            // Parse the telco report format
            const headers = jsonData.find((row) =>
                row.some((cell) => typeof cell === 'string' && cell.toLowerCase().includes('payment method'))
            );

            if (!headers) {
                toast.error('Could not find expected columns in the file');
                return;
            }

            const headerIndex = jsonData.indexOf(headers);
            const dataRows = jsonData.slice(headerIndex + 1).filter((row) => row.length > 0 && row[0]);

            // Map columns
            const siteNameIdx = headers.findIndex((h) =>
                typeof h === 'string' && h.toLowerCase().includes('site')
            );
            const paymentMethodIdx = headers.findIndex((h) =>
                typeof h === 'string' && h.toLowerCase().includes('payment method')
            );
            const customerTypeIdx = headers.findIndex((h) =>
                typeof h === 'string' && h.toLowerCase().includes('customer type')
            );
            const paymentTypeIdx = headers.findIndex((h) =>
                typeof h === 'string' && h.toLowerCase().includes('payment type')
            );
            const amountIdx = headers.findIndex((h) =>
                typeof h === 'string' && (h.toLowerCase().includes('amount') && !h.toLowerCase().includes('forex'))
            );

            const parsedRows: ParsedRow[] = dataRows.map((row) => ({
                siteName: String(row[siteNameIdx] || ''),
                paymentMethod: String(row[paymentMethodIdx] || ''),
                customerType: String(row[customerTypeIdx] || 'Consumer'),
                paymentType: String(row[paymentTypeIdx] || ''),
                amount: parseFloat(String(row[amountIdx])) || 0,
            })).filter((r) => r.amount > 0);

            // Calculate totals
            let totalCash = 0;
            let totalTransfer = 0;

            parsedRows.forEach((row) => {
                const isCash = row.paymentMethod.toLowerCase().includes('cash');
                if (isCash) {
                    totalCash += row.amount;
                } else {
                    totalTransfer += row.amount;
                }
            });

            setPreview({
                filename: file.name,
                date: format(selectedDate, 'yyyy-MM-dd'),
                rows: parsedRows,
                totals: {
                    cash: totalCash,
                    transfer: totalTransfer,
                    total: totalCash + totalTransfer,
                },
            });

            toast.success(`Parsed ${parsedRows.length} rows from ${file.name}`);
        } catch (error) {
            console.error('Error parsing file:', error);
            toast.error('Failed to parse file. Please check the format.');
        }
    }, [selectedDate]);

    const handleImport = useCallback(async () => {
        if (!preview) return;

        setIsImporting(true);
        try {
            const response = await fetch('/api/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: format(selectedDate, 'yyyy-MM-dd'),
                    rows: preview.rows,
                    totals: preview.totals,
                }),
            });

            const result = await response.json();

            if (result.success) {
                toast.success(result.message || 'Data imported successfully');
                setPreview(null);
                // Navigate to daily entry for the imported date
                router.push(`/daily-entry?date=${format(selectedDate, 'yyyy-MM-dd')}`);
            } else {
                toast.error(result.error || 'Failed to import data');
            }
        } catch (error) {
            console.error('Error importing:', error);
            toast.error('Failed to import data');
        } finally {
            setIsImporting(false);
        }
    }, [preview, selectedDate, router]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        const validFile = files.find((f) =>
            f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
        );

        if (validFile) {
            parseFile(validFile);
        } else {
            toast.error('Please upload a CSV or Excel file');
        }
    }, [parseFile]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            parseFile(file);
        }
    };

    return (
        <div className="flex flex-col">
            <Header title="Import Telco Report" subtitle="Upload and reconcile system-generated reports" />

            <div className="flex-1 space-y-6 p-6">
                {/* Date Selector */}
                <Card>
                    <CardHeader>
                        <CardTitle>Select Date</CardTitle>
                        <CardDescription>
                            Choose the date for which you want to import the report
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <CalendarIcon className="h-4 w-4" />
                                    {format(selectedDate, 'EEEE, dd MMMM yyyy')}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={(date) => date && setSelectedDate(date)}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </CardContent>
                </Card>

                {/* Upload Zone */}
                <Card>
                    <CardHeader>
                        <CardTitle>Upload Report</CardTitle>
                        <CardDescription>
                            Upload a Cashier Office Site Report (CSV or Excel format)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            className={cn(
                                'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors',
                                isDragging
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted-foreground/25 hover:border-primary/50'
                            )}
                        >
                            <Upload className={cn(
                                'mb-4 h-12 w-12',
                                isDragging ? 'text-primary' : 'text-muted-foreground'
                            )} />
                            <p className="mb-2 text-lg font-medium">
                                Drop your file here or click to browse
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Supports CSV, XLS, and XLSX files
                            </p>
                            <Input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileSelect}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Preview */}
                {preview && (
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
                                    <Button variant="outline" onClick={() => setPreview(null)} disabled={isImporting}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Discard
                                    </Button>
                                    <Button onClick={handleImport} disabled={isImporting}>
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
                )}

                {/* Empty State */}
                {!preview && (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                            <FileSpreadsheet className="mb-4 h-12 w-12 text-muted-foreground" />
                            <h3 className="mb-2 text-lg font-medium">No report uploaded yet</h3>
                            <p className="text-sm text-muted-foreground">
                                Upload a Cashier Office Site Report to compare with your manual entry
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
