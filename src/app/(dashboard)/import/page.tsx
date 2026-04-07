'use client';

import { useState, useCallback } from 'react';
import { useApiClient } from '@/hooks/use-api-client';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Upload,
    FileSpreadsheet,
    CalendarIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ImportPreview, type ImportPreviewData, type ParsedRow } from '@/components/import/import-preview';

export default function ImportPage() {
    const api = useApiClient();
    const router = useRouter();
    const [isDragging, setIsDragging] = useState(false);
    const [preview, setPreview] = useState<ImportPreviewData | null>(null);
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
            const result = await api.post('/api/import', {
                date: format(selectedDate, 'yyyy-MM-dd'),
                rows: preview.rows,
                totals: preview.totals,
            });

            const resAny = result as unknown as Record<string, unknown>;
            if (result.success) {
                toast.success((resAny.message as string) || 'Data imported successfully');
                setPreview(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                    <ImportPreview
                        preview={preview}
                        selectedDate={selectedDate}
                        isImporting={isImporting}
                        onDiscard={() => setPreview(null)}
                        onImport={handleImport}
                    />
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
