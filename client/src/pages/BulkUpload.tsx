import { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, Download, FileText, Package, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";

interface BulkOrderResult {
  id: string;
  bagName: string;
  sku?: string;
  orderQty: number;
  orderUnit: string;
  actualBags?: number;
  totalCost?: number;
  feasible: boolean;
  error?: string;
}

interface BulkUploadResponse {
  id: string;
  message: string;
  summary: {
    totalOrders: number;
    feasibleOrders: number;
    totalCost: number;
  };
  orders: BulkOrderResult[];
}

export default function BulkUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<BulkUploadResponse | null>(null);
  const [error, setError] = useState<string>('');

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  }, []);

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result: BulkUploadResponse = await response.json();
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleExport = () => {
    if (!results?.id) return;
    window.open(`/api/bulk-orders/${results.id}/export/html`, '_blank');
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b header-gradient">
        <div className="container section-padding">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl mb-4">Bulk Order Upload</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Upload CSV or Excel files containing multiple orders for batch processing and analysis
            </p>
          </div>
        </div>
      </header>

      <main className="container section-padding">
        {/* Upload Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>File Upload</CardTitle>
            <CardDescription>
              Upload a CSV or Excel file with your bulk orders. Required columns: bagName, orderQty, width, gusset, height, gsm
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">Choose File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="cursor-pointer"
                />
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {error && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-4">
                <Button 
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload & Process
                    </>
                  )}
                </Button>

                {results && (
                  <Button 
                    variant="outline"
                    onClick={handleExport}
                    className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View Report
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {results && (
          <div className="space-y-6">
            {/* Summary */}
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Processing Complete
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-900 mb-2">
                      {results.summary.totalOrders}
                    </div>
                    <h4 className="font-medium mb-1">Total Orders</h4>
                    <p className="text-sm text-muted-foreground">
                      Orders processed from file
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-900 mb-2">
                      {results.summary.feasibleOrders}
                    </div>
                    <h4 className="font-medium mb-1">Feasible Orders</h4>
                    <p className="text-sm text-muted-foreground">
                      Orders with sufficient inventory
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-900 mb-2">
                      €{results.summary.totalCost.toFixed(2)}
                    </div>
                    <h4 className="font-medium mb-1">Total Cost</h4>
                    <p className="text-sm text-muted-foreground">
                      Estimated material cost
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <Progress 
                    value={(results.summary.feasibleOrders / results.summary.totalOrders) * 100} 
                    className="h-3"
                  />
                  <p className="text-center text-sm text-muted-foreground mt-2">
                    {((results.summary.feasibleOrders / results.summary.totalOrders) * 100).toFixed(1)}% of orders are feasible
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Results Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order Details
                </CardTitle>
                <CardDescription>
                  Detailed analysis results for each order
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                        <th className="text-left px-4 py-3 font-semibold">Bag Name</th>
                        <th className="text-left px-4 py-3 font-semibold">SKU</th>
                        <th className="text-right px-4 py-3 font-semibold">Quantity</th>
                        <th className="text-right px-4 py-3 font-semibold">Bags</th>
                        <th className="text-center px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.orders.map((order, index) => (
                        <tr key={index} className="border-b hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium">{order.bagName}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {order.sku || 'Custom'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {order.orderQty} {order.orderUnit}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold">
                            {order.actualBags?.toLocaleString() || order.orderQty.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge 
                              variant={order.feasible ? 'default' : 'destructive'}
                              className={order.feasible ? 'bg-green-100 text-green-700' : ''}
                            >
                              {order.error ? 'Error' : order.feasible ? 'Feasible' : 'Not Feasible'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sample Format Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Sample File Format</CardTitle>
            <CardDescription>
              Your CSV or Excel file should include these columns (case sensitive):
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <div className="font-bold text-slate-700 mb-2">Required columns:</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-600">
                <div>• bagName</div>
                <div>• orderQty</div>
                <div>• width</div>
                <div>• gusset</div>
                <div>• height</div>
                <div>• gsm</div>
              </div>
              <div className="font-bold text-slate-700 mt-4 mb-2">Optional columns:</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-600">
                <div>• sku</div>
                <div>• orderUnit</div>
                <div>• handleType</div>
                <div>• paperGrade</div>
                <div>• certification</div>
                <div>• deliveryDays</div>
                <div>• colors</div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="font-medium text-blue-800 mb-2">Example CSV format:</h5>
              <pre className="text-xs text-blue-700 overflow-x-auto">
{`bagName,orderQty,orderUnit,width,gusset,height,gsm,handleType,paperGrade
Custom Kraft Bag,1000,cartons,320,160,380,90,FLAT HANDLE,VIRGIN
Shopping Bag,500,cartons,280,140,350,80,FLAT HANDLE,RECYCLED
Gift Bag,250,bags,200,120,300,100,TWISTED HANDLE,VIRGIN`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}