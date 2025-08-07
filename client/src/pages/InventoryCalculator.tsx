import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calculator, Package, TrendingUp, AlertTriangle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { SKU_DATA, type SKUData } from "@/data/skuData";

// Inventory data (current stock levels)
const INVENTORY_DATA = {
  // Paper materials
  "1003696": { name: "Virgin Kraft 80-90 GSM", currentStock: 2500, unit: "KG", minStock: 500, price: 1.2, leadTime: 7 },
  "1003697": { name: "Virgin Kraft 90 GSM", currentStock: 1800, unit: "KG", minStock: 400, price: 1.25, leadTime: 7 },
  "1003771": { name: "Virgin Kraft 85 GSM", currentStock: 800, unit: "KG", minStock: 300, price: 1.15, leadTime: 7 },
  "1003988": { name: "Virgin Kraft 75 GSM", currentStock: 600, unit: "KG", minStock: 200, price: 1.1, leadTime: 7 },
  "1004016": { name: "Virgin/Recycled Kraft 50 GSM", currentStock: 1200, unit: "KG", minStock: 300, price: 1.0, leadTime: 7 },
  "1004017": { name: "Recycled Kraft 100 GSM", currentStock: 900, unit: "KG", minStock: 250, price: 1.3, leadTime: 7 },
  "1004061": { name: "Paper Special Grade", currentStock: 400, unit: "KG", minStock: 150, price: 1.35, leadTime: 10 },
  
  // Adhesives
  "1004557": { name: "Cold Melt Adhesive", currentStock: 150, unit: "KG", minStock: 30, price: 8.5, leadTime: 5 },
  "1004555": { name: "Hot Melt Adhesive", currentStock: 120, unit: "KG", minStock: 25, price: 9.2, leadTime: 5 },
  
  // Handles
  "1003688": { name: "Flat Paper Handle", currentStock: 80, unit: "KG", minStock: 20, price: 3.5, leadTime: 10 },
  "1003930": { name: "Flat Paper Handle (Alternative)", currentStock: 65, unit: "KG", minStock: 15, price: 3.2, leadTime: 10 },
  "1003967": { name: "Twisted Paper Handle", currentStock: 25, unit: "KG", minStock: 10, price: 12.5, leadTime: 14 },
  
  // Patches
  "1003695": { name: "Handle Patch for Flat Handles", currentStock: 30, unit: "KG", minStock: 8, price: 4.8, leadTime: 12 },
  "1003823": { name: "Handle Patch (Alternative)", currentStock: 22, unit: "KG", minStock: 6, price: 4.5, leadTime: 12 },
  "1003948": { name: "Handle Patch for Twisted Handles", currentStock: 15, unit: "KG", minStock: 5, price: 5.2, leadTime: 12 },
  
  // Cartons
  "1003530": { name: "Standard Carton Box", currentStock: 2000, unit: "PC", minStock: 500, price: 0.15, leadTime: 3 },
  "1004232": { name: "Small Carton Box", currentStock: 1500, unit: "PC", minStock: 300, price: 0.12, leadTime: 3 },
  "1004289": { name: "Medium Carton Box", currentStock: 1000, unit: "PC", minStock: 200, price: 0.18, leadTime: 3 },
  "1004308": { name: "Large Carton Box", currentStock: 800, unit: "PC", minStock: 150, price: 0.22, leadTime: 3 }
};

type MaterialRequirement = {
  sapCode: string;
  name: string;
  required: number;
  available: number;
  shortage: number;
  unit: string;
  status: 'sufficient' | 'low' | 'critical';
  cost: number;
};

type InventoryAnalysis = {
  feasible: boolean;
  totalCost: number;
  materialRequirements: MaterialRequirement[];
  warnings: string[];
  recommendations: string[];
};

export default function InventoryCalculator() {
  const [inputMethod, setInputMethod] = useState<'specs' | 'existing'>('existing');
  const [existingSku, setExistingSku] = useState('');
  const [orderQty, setOrderQty] = useState(5000);
  const [deliveryDate, setDeliveryDate] = useState('');
  
  // Custom specs
  const [width, setWidth] = useState<number | ''>('');
  const [gusset, setGusset] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [gsm, setGsm] = useState<number | ''>('');
  const [handleType, setHandleType] = useState('FLAT HANDLE');
  const [paperGrade, setPaperGrade] = useState('VIRGIN');
  
  const [analysis, setAnalysis] = useState<InventoryAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState('materials');

  // Set default delivery date to 2 weeks from now
  useEffect(() => {
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
    setDeliveryDate(twoWeeksFromNow.toISOString().split('T')[0]);
  }, []);

  // Load existing SKU data when selected
  useEffect(() => {
    if (existingSku && inputMethod === 'existing') {
      const selectedSku = SKU_DATA.find(item => item.sku === existingSku);
      if (selectedSku) {
        const dims = selectedSku.dimensions.split('×');
        setWidth(parseInt(dims[0]));
        setGusset(parseInt(dims[1]));
        setHeight(parseInt(dims[2]));
        setGsm(parseInt(selectedSku.gsm));
        setHandleType(selectedSku.handle_type);
        setPaperGrade(selectedSku.paper_grade);
      }
    }
  }, [existingSku, inputMethod]);

  const calculateInventoryImpact = () => {
    if (!orderQty || orderQty <= 0) {
      alert('Please enter a valid order quantity');
      return;
    }

    let bomItems: Array<{ type: string; sapCode: string; quantity: number; unit: string; }> = [];
    
    if (inputMethod === 'existing' && existingSku) {
      const selectedSku = SKU_DATA.find(item => item.sku === existingSku);
      if (selectedSku) {
        bomItems = selectedSku.bom.filter(item => item.quantity != null && item.quantity > 0).map(item => ({
          type: item.type,
          sapCode: item.sapCode,
          quantity: item.quantity!,
          unit: item.unit
        }));
      }
    } else {
      // Generate BOM for custom bag (simplified version)
      if (!width || !gusset || !height || !gsm) {
        alert('Please fill in all dimension and GSM fields');
        return;
      }
      
      // Calculate paper requirement
      const widthCm = Number(width) / 10;
      const gussetCm = Number(gusset) / 10;
      const heightCm = Number(height) / 10;
      const totalArea = 2 * (widthCm * heightCm) + 2 * (gussetCm * heightCm) + (widthCm * gussetCm) + (widthCm + gussetCm) * 2;
      const paperWeight = (totalArea * Number(gsm)) / 1000000; // Convert to kg
      
      bomItems = [
        { type: "PAPER", sapCode: "1003696", quantity: paperWeight, unit: "KG" },
        { type: "COLD GLUE", sapCode: "1004557", quantity: 0.0018, unit: "KG" }
      ];
      
      if (handleType === "FLAT HANDLE") {
        bomItems.push(
          { type: "HANDLE", sapCode: "1003688", quantity: 0.0052, unit: "KG" },
          { type: "PATCH", sapCode: "1003695", quantity: 0.0012, unit: "KG" },
          { type: "HOT GLUE", sapCode: "1004555", quantity: 0.0001, unit: "KG" }
        );
      } else if (handleType === "TWISTED HANDLE") {
        bomItems.push(
          { type: "HANDLE", sapCode: "1003967", quantity: 0.7665, unit: "KG" },
          { type: "PATCH", sapCode: "1003948", quantity: 0.0036, unit: "KG" },
          { type: "HOT GLUE", sapCode: "1004555", quantity: 0.0011, unit: "KG" }
        );
      }
      
      bomItems.push({ type: "CARTON", sapCode: "1003530", quantity: 0.004, unit: "PC" });
    }

    // Calculate material requirements
    const materialRequirements: MaterialRequirement[] = [];
    let totalCost = 0;
    let feasible = true;
    const warnings: string[] = [];
    const recommendations: string[] = [];

    bomItems.forEach(item => {
      const inventoryItem = INVENTORY_DATA[item.sapCode as keyof typeof INVENTORY_DATA];
      if (!inventoryItem) return;

      const required = item.quantity * orderQty;
      const available = inventoryItem.currentStock;
      const shortage = Math.max(0, required - available);
      const cost = required * inventoryItem.price;
      
      let status: 'sufficient' | 'low' | 'critical' = 'sufficient';
      if (shortage > 0) {
        status = 'critical';
        feasible = false;
        warnings.push(`Insufficient ${inventoryItem.name}: need ${required.toFixed(3)}${item.unit}, have ${available.toFixed(3)}${item.unit}`);
        recommendations.push(`Order ${shortage.toFixed(3)}${item.unit} of ${inventoryItem.name} (lead time: ${inventoryItem.leadTime} days)`);
      } else if (available - required < inventoryItem.minStock) {
        status = 'low';
        warnings.push(`${inventoryItem.name} will fall below minimum stock after order`);
        recommendations.push(`Consider reordering ${inventoryItem.name} to maintain safety stock`);
      }

      materialRequirements.push({
        sapCode: item.sapCode,
        name: inventoryItem.name,
        required,
        available,
        shortage,
        unit: item.unit,
        status,
        cost
      });

      totalCost += cost;
    });

    // Check delivery date feasibility
    if (deliveryDate) {
      const deliveryDateObj = new Date(deliveryDate);
      const today = new Date();
      const daysUntilDelivery = Math.ceil((deliveryDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      const maxLeadTime = Math.max(...materialRequirements
        .filter(req => req.shortage > 0)
        .map(req => INVENTORY_DATA[req.sapCode as keyof typeof INVENTORY_DATA]?.leadTime || 0));
      
      if (maxLeadTime > daysUntilDelivery) {
        feasible = false;
        warnings.push(`Delivery date not achievable. Need ${maxLeadTime} days for material procurement, but only ${daysUntilDelivery} days available.`);
        recommendations.push(`Consider moving delivery date to at least ${maxLeadTime} days from now.`);
      }
    }

    setAnalysis({
      feasible,
      totalCost,
      materialRequirements,
      warnings,
      recommendations
    });
  };

  const getStockStatus = (current: number, min: number) => {
    const ratio = current / min;
    if (ratio <= 1) return { 
      status: 'critical' as const, 
      color: 'bg-red-500', 
      textColor: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      icon: '🚨'
    };
    if (ratio <= 2) return { 
      status: 'low' as const, 
      color: 'bg-yellow-500', 
      textColor: 'text-yellow-700',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      icon: '⚠️'
    };
    return { 
      status: 'good' as const, 
      color: 'bg-green-500', 
      textColor: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      icon: '✅'
    };
  };

  const inventoryStats = Object.values(INVENTORY_DATA).reduce((acc, item) => {
    const stockStatus = getStockStatus(item.currentStock, item.minStock);
    acc.totalValue += item.currentStock * item.price;
    acc.totalItems += 1;
    if (stockStatus.status === 'low') acc.lowStock += 1;
    if (stockStatus.status === 'critical') acc.critical += 1;
    return acc;
  }, { totalValue: 0, totalItems: 0, lowStock: 0, critical: 0 });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-primary text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">📊 Smart Inventory Calculator</h1>
            <p className="text-primary-100 text-lg">Analyze inventory impact and order feasibility for bag production</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-lg">💰</span>
                <h4 className="text-sm opacity-90">Total Stock Value</h4>
              </div>
              <div className="text-2xl font-bold">€{inventoryStats.totalValue.toFixed(0)}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-lg">📦</span>
                <h4 className="text-sm opacity-90">Materials in Stock</h4>
              </div>
              <div className="text-2xl font-bold">{inventoryStats.totalItems}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-lg">⚠️</span>
                <h4 className="text-sm opacity-90">Low Stock Items</h4>
              </div>
              <div className="text-2xl font-bold">{inventoryStats.lowStock}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-lg">🚨</span>
                <h4 className="text-sm opacity-90">Critical Items</h4>
              </div>
              <div className="text-2xl font-bold">{inventoryStats.critical}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Order Feasibility Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label>Input Method</Label>
                  <Select value={inputMethod} onValueChange={(value: 'specs' | 'existing') => setInputMethod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="specs">Enter Specifications</SelectItem>
                      <SelectItem value="existing">Use Existing SKU</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {inputMethod === 'existing' && (
                  <div className="space-y-2">
                    <Label>Select SKU</Label>
                    <Select value={existingSku} onValueChange={setExistingSku}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose SKU..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SKU_DATA.map(item => (
                          <SelectItem key={item.sku} value={item.sku}>
                            {item.sku} - {item.name.substring(0, 30)}...
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Order Quantity</Label>
                  <Input
                    type="number"
                    value={orderQty}
                    onChange={(e) => setOrderQty(Number(e.target.value))}
                    placeholder="e.g. 5000"
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Delivery Date Needed</Label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
              </div>

              {inputMethod === 'specs' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <div className="space-y-2">
                    <Label>Width (mm)</Label>
                    <Input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(e.target.value ? Number(e.target.value) : '')}
                      placeholder="320"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gusset (mm)</Label>
                    <Input
                      type="number"
                      value={gusset}
                      onChange={(e) => setGusset(e.target.value ? Number(e.target.value) : '')}
                      placeholder="160"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Height (mm)</Label>
                    <Input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(e.target.value ? Number(e.target.value) : '')}
                      placeholder="380"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>GSM</Label>
                    <Input
                      type="number"
                      value={gsm}
                      onChange={(e) => setGsm(e.target.value ? Number(e.target.value) : '')}
                      placeholder="90"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Handle Type</Label>
                    <Select value={handleType} onValueChange={setHandleType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FLAT HANDLE">Flat Handle</SelectItem>
                        <SelectItem value="TWISTED HANDLE">Twisted Handle</SelectItem>
                        <SelectItem value="SQR BOTTOM">Square Bottom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Paper Grade</Label>
                    <Select value={paperGrade} onValueChange={setPaperGrade}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VIRGIN">Virgin Kraft</SelectItem>
                        <SelectItem value="RECYCLED">Recycled Kraft</SelectItem>
                        <SelectItem value="FIBREFORM">Fibreform</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <Button onClick={calculateInventoryImpact} className="w-full">
                <Calculator className="w-4 h-4 mr-2" />
                Analyze Inventory Impact
              </Button>

              {analysis && (
                <div className="mt-6">
                  <Alert className={`mb-4 border-2 ${analysis.feasible 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex items-center gap-2">
                      {analysis.feasible ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      )}
                      <AlertDescription className={analysis.feasible ? 'text-green-800' : 'text-red-800'}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{analysis.feasible ? '✅' : '❌'}</span>
                          <div>
                            <strong>{analysis.feasible ? 'Order Feasible' : 'Order Not Feasible'}</strong>
                            <br />
                            <span className="text-sm">Total material cost: €{analysis.totalCost.toFixed(2)}</span>
                          </div>
                        </div>
                      </AlertDescription>
                    </div>
                  </Alert>

                  {analysis.warnings.length > 0 && (
                    <Alert className="mb-4 border-yellow-200 bg-yellow-50">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription>
                        <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                          <span>⚠️</span> Warnings:
                        </h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {analysis.warnings.map((warning, index) => (
                            <li key={index} className="text-sm text-yellow-700">{warning}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {analysis.recommendations.length > 0 && (
                    <Alert className="border-blue-200 bg-blue-50">
                      <AlertDescription>
                        <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                          <span>💡</span> Recommendations:
                        </h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {analysis.recommendations.map((rec, index) => (
                            <li key={index} className="text-sm text-blue-700">{rec}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inventory Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Current Inventory Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="materials">Materials</TabsTrigger>
                  <TabsTrigger value="predictions">Forecast</TabsTrigger>
                  <TabsTrigger value="reorders">Reorders</TabsTrigger>
                </TabsList>

                <TabsContent value="materials" className="mt-4">
                  <div className="max-h-96 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-3">Material</th>
                          <th className="text-left p-3">Current Stock</th>
                          <th className="text-left p-3">Min Stock</th>
                          <th className="text-left p-3">Stock Level</th>
                          <th className="text-left p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(INVENTORY_DATA).map(([sapCode, item]) => {
                          const stockStatus = getStockStatus(item.currentStock, item.minStock);
                          const stockRatio = item.currentStock / item.minStock;
                          const stockPercentage = Math.min(100, stockRatio * 50); // Cap at 100%
                          return (
                            <tr key={sapCode} className={`border-b hover:${stockStatus.bgColor}/30 transition-colors`}>
                              <td className="p-3">
                                <div>
                                  <div className="font-medium">{item.name}</div>
                                  <div className="text-xs text-muted-foreground">{sapCode}</div>
                                </div>
                              </td>
                              <td className="p-3 font-mono">
                                <span className={stockStatus.textColor}>
                                  {item.currentStock.toFixed(item.unit === 'PC' ? 0 : 1)} {item.unit}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-muted-foreground">
                                {item.minStock.toFixed(item.unit === 'PC' ? 0 : 1)} {item.unit}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full ${stockStatus.color} transition-all`}
                                      style={{ width: `${stockPercentage}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {stockRatio.toFixed(1)}x
                                  </span>
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{stockStatus.icon}</span>
                                  <Badge 
                                    variant={stockStatus.status === 'critical' ? 'destructive' : stockStatus.status === 'low' ? 'secondary' : 'default'}
                                    className={stockStatus.status === 'good' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}
                                  >
                                    {stockStatus.status}
                                  </Badge>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="predictions" className="mt-4">
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Demand Forecast (Next 3 Months)
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>January 2025</span>
                          <span>15,000 bags expected</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>February 2025</span>
                          <span>18,000 bags expected</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: '90%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>March 2025</span>
                          <span>12,000 bags expected</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '60%' }}></div>
                        </div>
                      </div>
                    </div>
                    <Alert>
                      <TrendingUp className="h-4 w-4" />
                      <AlertDescription>
                        Based on historical data from the same period last year, adjusted for current trends.
                      </AlertDescription>
                    </Alert>
                  </div>
                </TabsContent>

                <TabsContent value="reorders" className="mt-4">
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Reorder Suggestions
                    </h4>
                    {Object.entries(INVENTORY_DATA)
                      .filter(([_, item]) => item.currentStock <= item.minStock * 1.5)
                      .map(([sapCode, item]) => {
                        const stockStatus = getStockStatus(item.currentStock, item.minStock);
                        const suggestedOrder = (item.minStock * 2).toFixed(item.unit === 'PC' ? 0 : 1);
                        const cost = (parseFloat(suggestedOrder) * item.price).toFixed(2);
                        return (
                          <Alert key={sapCode} className={`border-2 ${stockStatus.borderColor} ${stockStatus.bgColor}`}>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{stockStatus.icon}</span>
                              <Clock className="h-4 w-4" />
                            </div>
                            <AlertDescription className={stockStatus.textColor}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <strong className="text-base">{item.name}</strong>
                                  <div className="text-sm mt-1">
                                    <span className="inline-block mr-4">Current: <span className="font-mono">{item.currentStock.toFixed(item.unit === 'PC' ? 0 : 1)}{item.unit}</span></span>
                                    <span className="inline-block mr-4">Min: <span className="font-mono">{item.minStock.toFixed(item.unit === 'PC' ? 0 : 1)}{item.unit}</span></span>
                                    <span className="inline-block">Lead time: <span className="font-semibold">{item.leadTime} days</span></span>
                                  </div>
                                  <div className="mt-2 text-sm">
                                    <span className="font-semibold">Suggested order: </span>
                                    <span className="font-mono bg-white px-2 py-1 rounded">{suggestedOrder}{item.unit}</span>
                                    <span className="ml-2 text-muted-foreground">(Cost: €{cost})</span>
                                  </div>
                                </div>
                                <Badge variant={stockStatus.status === 'critical' ? 'destructive' : 'secondary'}>
                                  {stockStatus.status.toUpperCase()}
                                </Badge>
                              </div>
                            </AlertDescription>
                          </Alert>
                        );
                      })}
                    {Object.entries(INVENTORY_DATA).filter(([_, item]) => item.currentStock <= item.minStock * 1.5).length === 0 && (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          <div className="flex items-center gap-2">
                            <span>✅</span>
                            <span><strong>All materials are well stocked!</strong> No reorders needed at this time.</span>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Material Analysis */}
        {analysis && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Detailed Material Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3">Material</th>
                      <th className="text-right p-3">Required</th>
                      <th className="text-right p-3">Available</th>
                      <th className="text-right p-3">After Order</th>
                      <th className="text-right p-3">Cost</th>
                      <th className="text-center p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.materialRequirements.map((req, index) => {
                      const statusColors = getStockStatus(req.available, req.required);
                      return (
                        <tr key={index} className={`border-b hover:${statusColors.bgColor}/30 transition-colors`}>
                          <td className="p-3">
                            <div>
                              <div className="font-medium">{req.name}</div>
                              <div className="text-xs text-muted-foreground">{req.sapCode}</div>
                            </div>
                          </td>
                          <td className="text-right p-3 font-mono">
                            <span className="text-blue-700 font-semibold">
                              {req.required.toFixed(3)} {req.unit}
                            </span>
                          </td>
                          <td className="text-right p-3 font-mono">
                            <span className={req.shortage > 0 ? 'text-red-600' : 'text-green-600'}>
                              {req.available.toFixed(3)} {req.unit}
                            </span>
                          </td>
                          <td className="text-right p-3 font-mono">
                            {req.shortage > 0 ? (
                              <span className="text-red-600 font-semibold flex items-center justify-end gap-1">
                                <span>🚨</span>
                                -{req.shortage.toFixed(3)} {req.unit}
                              </span>
                            ) : (
                              <span className="text-green-600 font-semibold flex items-center justify-end gap-1">
                                <span>✅</span>
                                {(req.available - req.required).toFixed(3)} {req.unit}
                              </span>
                            )}
                          </td>
                          <td className="text-right p-3 font-mono font-semibold">
                            €{req.cost.toFixed(2)}
                          </td>
                          <td className="text-center p-3">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-sm">
                                {req.status === 'critical' ? '🚨' : req.status === 'low' ? '⚠️' : '✅'}
                              </span>
                              <Badge 
                                variant={req.status === 'critical' ? 'destructive' : req.status === 'low' ? 'secondary' : 'default'}
                                className={req.status === 'sufficient' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}
                              >
                                {req.status}
                              </Badge>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}