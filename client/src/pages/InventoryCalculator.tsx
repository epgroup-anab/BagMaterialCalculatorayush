import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calculator, Package, TrendingUp, AlertTriangle, CheckCircle, Clock, RefreshCw, Settings, Cpu } from "lucide-react";
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

// Machine specifications database
const MACHINES_DATA = {
  'M1': {
    name: 'M1',
    category: 'GM 5QT FH',
    description: 'Garant Triumph 5QT',
    handleType: 'FLAT HANDLE',
    maxColors: 1,
    dailyCapacity: 82000,
    speed: 100,
    minWidth: 800,
    maxWidth: 1100,
    minGSM: 70,
    maxGSM: 100,
    status: 'available',
    currentUtilization: 65
  },
  'M2': {
    name: 'M2',
    category: 'GM 5QT FH',
    description: 'Garant Triumph 5QT',
    handleType: 'FLAT HANDLE',
    maxColors: 3,
    dailyCapacity: 82000,
    speed: 100,
    minWidth: 800,
    maxWidth: 1100,
    minGSM: 70,
    maxGSM: 100,
    status: 'busy',
    currentUtilization: 85
  },
  'M3': {
    name: 'M3',
    category: 'GM 5QT FH',
    description: 'Garant Triumph 5QT',
    handleType: 'FLAT HANDLE',
    maxColors: 3,
    dailyCapacity: 82000,
    speed: 100,
    minWidth: 800,
    maxWidth: 1100,
    minGSM: 70,
    maxGSM: 100,
    status: 'available',
    currentUtilization: 45
  },
  'M4': {
    name: 'M4',
    category: 'GM 5QT FH',
    description: 'Garant Triumph 5QT',
    handleType: 'FLAT HANDLE',
    maxColors: 1,
    dailyCapacity: 82000,
    speed: 100,
    minWidth: 800,
    maxWidth: 1100,
    minGSM: 70,
    maxGSM: 100,
    status: 'available',
    currentUtilization: 30
  },
  'M5': {
    name: 'M5',
    category: 'GM 5F6 FH',
    description: 'Garant 5F6',
    handleType: 'FLAT HANDLE',
    maxColors: 4,
    dailyCapacity: 82000,
    speed: 100,
    minWidth: 700,
    maxWidth: 1200,
    minGSM: 70,
    maxGSM: 110,
    supportsPatch: true,
    status: 'available',
    currentUtilization: 55
  },
  'M6': {
    name: 'M6',
    category: 'GM 5F6 TH',
    description: 'Garant 5F6',
    handleType: 'TWISTED HANDLE',
    maxColors: 2,
    dailyCapacity: 82000,
    speed: 100,
    minWidth: 700,
    maxWidth: 1200,
    minGSM: 70,
    maxGSM: 110,
    status: 'maintenance',
    currentUtilization: 0
  },
  'NL1': {
    name: 'NL1',
    category: 'NL FH',
    description: 'Newlong',
    handleType: 'FLAT HANDLE',
    maxColors: 2,
    dailyCapacity: 65600,
    speed: 80,
    minWidth: 750,
    maxWidth: 1000,
    minGSM: 75,
    maxGSM: 95,
    status: 'available',
    currentUtilization: 70
  },
  'NL2': {
    name: 'NL2',
    category: 'NL FH',
    description: 'Newlong',
    handleType: 'FLAT HANDLE',
    maxColors: 2,
    dailyCapacity: 65600,
    speed: 80,
    minWidth: 750,
    maxWidth: 1000,
    minGSM: 75,
    maxGSM: 95,
    status: 'available',
    currentUtilization: 40
  }
};

type MachineData = {
  name: string;
  category: string;
  description: string;
  handleType: string;
  maxColors: number;
  dailyCapacity: number;
  speed: number;
  minWidth: number;
  maxWidth: number;
  minGSM: number;
  maxGSM: number;
  supportsPatch?: boolean;
  status: 'available' | 'busy' | 'maintenance';
  currentUtilization: number;
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
  const [stockData, setStockData] = useState<Record<string, number>>({});
  
  // Machine assignment state
  const [machineOrderSpec, setMachineOrderSpec] = useState({
    orderName: "",
    bagWidth: "",
    bagHeight: "",
    bagGusset: "",
    paperGSM: "",
    paperWidth: "",
    handleType: "FLAT HANDLE",
    patchType: "none",
    colors: 0,
    quantity: "",
    deliveryDays: ""
  });
  const [machineAnalysis, setMachineAnalysis] = useState<any>(null);

  // Fetch stock data from QuickBase API with fallback to hardcoded data
  const fetchStockData = async (sapCode: string): Promise<number> => {
    try {
      const response = await fetch(`/api/inventory?sapCode=${sapCode}`);
      if (!response.ok) {
        console.warn(`Failed to fetch stock for ${sapCode}:`, response.status, '- Using fallback data');
        // Return fallback data from INVENTORY_DATA
        return INVENTORY_DATA[sapCode as keyof typeof INVENTORY_DATA]?.currentStock || 0;
      }
      const data = await response.json();
      return data.stock || 0;
    } catch (error) {
      console.error(`Error fetching stock for ${sapCode}:`, error, '- Using fallback data');
      // Return fallback data from INVENTORY_DATA
      return INVENTORY_DATA[sapCode as keyof typeof INVENTORY_DATA]?.currentStock || 0;
    }
  };

  // Load stock data for all materials
  useEffect(() => {
    const loadAllStockData = async () => {
      const stockPromises = Object.keys(INVENTORY_DATA).map(async (sapCode) => {
        const stock = await fetchStockData(sapCode);
        return { sapCode, stock };
      });
      
      const stockResults = await Promise.all(stockPromises);
      const newStockData: Record<string, number> = {};
      stockResults.forEach(({ sapCode, stock }) => {
        newStockData[sapCode] = stock;
      });
      setStockData(newStockData);
    };

    loadAllStockData();
  }, []);

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
      const available = stockData[item.sapCode] ?? 0;
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

  // Machine compatibility and analysis functions
  const checkMachineCompatibility = (machine: MachineData, specs: any) => {
    const reasons = [];
    let compatible = true;

    // Check handle type
    if (specs.handleType !== 'none' && machine.handleType !== specs.handleType) {
      compatible = false;
      reasons.push(`Requires ${specs.handleType} handle, machine has ${machine.handleType}`);
    }

    // Check color capability  
    if (specs.colors > machine.maxColors) {
      compatible = false;
      reasons.push(`Requires ${specs.colors} colors, machine supports max ${machine.maxColors}`);
    }

    // Check paper width
    const paperWidth = parseInt(specs.paperWidth);
    if (paperWidth && (paperWidth < machine.minWidth || paperWidth > machine.maxWidth)) {
      compatible = false;
      reasons.push(`Paper width ${paperWidth}mm outside range (${machine.minWidth}-${machine.maxWidth}mm)`);
    }

    // Check GSM
    const paperGSM = parseInt(specs.paperGSM);
    if (paperGSM && (paperGSM < machine.minGSM || paperGSM > machine.maxGSM)) {
      compatible = false;
      reasons.push(`GSM ${paperGSM} outside range (${machine.minGSM}-${machine.maxGSM})`);
    }

    // Check patch support
    if (specs.patchType === 'double' && !machine.supportsPatch) {
      compatible = false;
      reasons.push('Double patch not supported');
    }

    return { compatible, reasons };
  };

  const calculateMachineProduction = (machine: MachineData, specs: any) => {
    // Color capacity adjustment factors
    const colorFactors: Record<number, number> = {
      0: 1.0,   // No printing
      1: 1.0,   // 1 color
      2: 0.87,  // 2 colors
      3: 1.0,   // 3 colors
      4: 0.33   // 4 colors
    };

    const colorFactor = colorFactors[specs.colors] || 1.0;
    const adjustedCapacity = machine.dailyCapacity * colorFactor;
    
    // Adjust for patch complexity
    let patchFactor = 1.0;
    if (specs.patchType === 'single') patchFactor = 0.95;
    if (specs.patchType === 'double') patchFactor = 0.90;
    
    const finalCapacity = Math.floor(adjustedCapacity * patchFactor);
    const quantity = parseInt(specs.quantity);
    const deliveryDays = parseInt(specs.deliveryDays);
    
    if (!quantity || !deliveryDays) {
      return {
        adjustedCapacity: finalCapacity,
        daysRequired: 0,
        hoursRequired: 0,
        utilization: 0,
        canMeetDeadline: false
      };
    }

    const daysRequired = Math.ceil(quantity / finalCapacity);
    const hoursRequired = parseFloat((quantity / (finalCapacity / 16)).toFixed(1)); // 16 working hours
    const utilization = Math.min((quantity / finalCapacity) * 100, 100);

    return {
      adjustedCapacity: finalCapacity,
      daysRequired,
      hoursRequired,
      utilization,
      canMeetDeadline: daysRequired <= deliveryDays
    };
  };

  const analyzeMachineAssignment = () => {
    if (!machineOrderSpec.quantity || !machineOrderSpec.deliveryDays) {
      return;
    }

    const machineResults = Object.entries(MACHINES_DATA).map(([machineId, machine]) => {
      const compatibility = checkMachineCompatibility(machine as MachineData, machineOrderSpec);
      const production = calculateMachineProduction(machine as MachineData, machineOrderSpec);
      
      return {
        machineId,
        machine,
        compatibility,
        production,
        score: compatibility.compatible ? 
          (production.canMeetDeadline ? 100 - machine.currentUtilization : 50) : 0
      };
    });

    // Sort by compatibility and score
    machineResults.sort((a, b) => {
      if (a.compatibility.compatible && !b.compatibility.compatible) return -1;
      if (!a.compatibility.compatible && b.compatibility.compatible) return 1;
      return b.score - a.score;
    });

    setMachineAnalysis({
      machines: machineResults,
      feasible: machineResults.some(m => m.compatibility.compatible && m.production.canMeetDeadline),
      totalMachines: machineResults.length,
      compatibleMachines: machineResults.filter(m => m.compatibility.compatible).length
    });
  };

  const inventoryStats = Object.entries(INVENTORY_DATA).reduce((acc, [sapCode, item]) => {
    const currentStock = stockData[sapCode] ?? 0;
    const stockStatus = getStockStatus(currentStock, item.minStock);
    acc.totalValue += currentStock * item.price;
    acc.totalItems += 1;
    if (stockStatus.status === 'low') acc.lowStock += 1;
    if (stockStatus.status === 'critical') acc.critical += 1;
    return acc;
  }, { totalValue: 0, totalItems: 0, lowStock: 0, critical: 0 });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b header-gradient">
        <div className="container section-padding">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-semibold tracking-tight mb-4">Inventory Calculator</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Analyze inventory impact and order feasibility for bag production.</p>
          </div>
        </div>
      </header>

      <main className="container section-padding">
        {/* Status Cards */}
        <div className="metric-grid mb-8">
          <Card className="p-6 text-center metric-card-1">
            <div className="text-2xl font-semibold mb-1 text-blue-900">€{inventoryStats.totalValue.toFixed(0)}</div>
            <h4 className="text-sm font-medium text-blue-700">Total Stock Value</h4>
          </Card>
          <Card className="p-6 text-center metric-card-2">
            <div className="text-2xl font-semibold mb-1 text-green-900">{inventoryStats.totalItems}</div>
            <h4 className="text-sm font-medium text-green-700">Materials in Stock</h4>
          </Card>
          <Card className="p-6 text-center metric-card-3">
            <div className="text-2xl font-semibold text-purple-900 mb-1">{inventoryStats.lowStock}</div>
            <h4 className="text-sm font-medium text-purple-700">Low Stock Items</h4>
          </Card>
          <Card className="p-6 text-center metric-card-4">
            <div className="text-2xl font-semibold text-orange-900 mb-1">{inventoryStats.critical}</div>
            <h4 className="text-sm font-medium text-orange-700">Critical Items</h4>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Order Feasibility Analysis</CardTitle>
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
                Analyze Impact
              </Button>

              {analysis && (
                <div className="mt-6">
                  <Alert className={`mb-4 ${analysis.feasible 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {analysis.feasible ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      )}
                      <AlertDescription className={analysis.feasible ? 'text-green-800' : 'text-red-800'}>
                        <div className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full ${analysis.feasible ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <div>
                            <strong className="text-base">{analysis.feasible ? 'Order Feasible' : 'Order Not Feasible'}</strong>
                            <br />
                            <span className="text-sm opacity-80">Total material cost: €{analysis.totalCost.toFixed(2)}</span>
                          </div>
                        </div>
                      </AlertDescription>
                    </div>
                  </Alert>

                  {analysis.warnings.length > 0 && (
                    <Alert className="mb-4 bg-yellow-50 border-yellow-200">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription>
                        <h4 className="font-medium mb-2 text-yellow-800">Warnings</h4>
                        <ul className="space-y-2">
                          {analysis.warnings.map((warning, index) => (
                            <li key={index} className="text-sm flex items-start gap-2 text-yellow-700">
                              <span className="w-1 h-1 bg-yellow-600 rounded-full mt-2 flex-shrink-0"></span>
                              <span>{warning}</span>
                            </li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {analysis.recommendations.length > 0 && (
                    <Alert className="bg-blue-50 border-blue-200">
                      <AlertDescription>
                        <h4 className="font-medium text-blue-800 mb-2">Recommendations</h4>
                        <ul className="space-y-2">
                          {analysis.recommendations.map((rec, index) => (
                            <li key={index} className="text-sm text-blue-700 flex items-start gap-2">
                              <span className="w-1 h-1 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                              <span>{rec}</span>
                            </li>
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
              <CardTitle>Current Inventory Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="materials" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">Materials</TabsTrigger>
                  <TabsTrigger value="predictions" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">Forecast</TabsTrigger>
                  <TabsTrigger value="reorders" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">Reorders</TabsTrigger>
                  <TabsTrigger value="machines" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">🏭 Machines</TabsTrigger>
                </TabsList>

                <TabsContent value="materials" className="mt-4">
                  <div className="max-h-96 overflow-y-auto rounded-lg border border-border/50">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 border-b border-border/60">
                        <tr>
                          <th className="text-left px-2 py-2 font-semibold text-slate-700 text-xs tracking-wide">
                            Material
                          </th>
                          <th className="text-right px-2 py-2 font-semibold text-slate-700 text-xs tracking-wide">
                            Current Stock
                          </th>
                          <th className="text-right px-2 py-2 font-semibold text-slate-700 text-xs tracking-wide">
                            Min Stock
                          </th>
                          <th className="text-center px-2 py-2 font-semibold text-slate-700 text-xs tracking-wide">
                            Stock Level
                          </th>
                          <th className="text-center px-2 py-2 font-semibold text-slate-700 text-xs tracking-wide">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(INVENTORY_DATA).map(([sapCode, item]) => {
                          const currentStock = stockData[sapCode] ?? 0;
                          const stockStatus = getStockStatus(currentStock, item.minStock);
                          const stockRatio = currentStock / item.minStock;
                          const stockPercentage = Math.min(100, stockRatio * 50); // Cap at 100%
                          return (
                            <tr key={sapCode} className="border-b border-border/30 hover:bg-slate-50/50 transition-colors">
                              <td className="px-2 py-2">
                                <div>
                                  <div className="font-medium text-slate-900 text-xs">{item.name}</div>
                                  <div className="text-xs text-slate-500 font-mono mt-1">{sapCode}</div>
                                </div>
                              </td>
                              <td className="px-2 py-2 text-right">
                                <span className={`font-mono font-medium text-xs ${stockStatus.status === 'critical' ? 'text-red-600' : stockStatus.status === 'low' ? 'text-yellow-600' : 'text-green-600'}`}>
                                  {currentStock.toFixed(item.unit === 'PC' ? 0 : 1)}
                                </span>
                                <span className="text-xs text-slate-500 ml-1">{item.unit}</span>
                              </td>
                              <td className="px-2 py-2 text-right">
                                <span className="font-mono text-slate-600 text-xs">
                                  {item.minStock.toFixed(item.unit === 'PC' ? 0 : 1)}
                                </span>
                                <span className="text-xs text-slate-500 ml-1">{item.unit}</span>
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full transition-all duration-300 ${
                                        stockStatus.status === 'critical' ? 'bg-red-500' :
                                        stockStatus.status === 'low' ? 'bg-yellow-500' : 'bg-green-500'
                                      }`}
                                      style={{ width: `${stockPercentage}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs text-slate-500 font-medium min-w-[30px] text-right">
                                    {stockRatio.toFixed(1)}x
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <Badge 
                                  variant={stockStatus.status === 'critical' ? 'destructive' : stockStatus.status === 'low' ? 'secondary' : 'default'}
                                  className={`${stockStatus.status === 'good' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''} font-medium text-xs`}
                                >
                                  {stockStatus.status}
                                </Badge>
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
                    <h4 className="font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Demand Forecast (Next 3 Months)
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>January 2025</span>
                          <span>15,000 bags expected</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-primary h-2 rounded-full" style={{ width: '75%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>February 2025</span>
                          <span>18,000 bags expected</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: '90%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>March 2025</span>
                          <span>12,000 bags expected</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
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
                      .filter(([sapCode, item]) => (stockData[sapCode] ?? 0) <= item.minStock * 1.5)
                      .map(([sapCode, item]) => {
                        const currentStock = stockData[sapCode] ?? 0;
                        const stockStatus = getStockStatus(currentStock, item.minStock);
                        const suggestedOrder = (item.minStock * 2).toFixed(item.unit === 'PC' ? 0 : 1);
                        const cost = (parseFloat(suggestedOrder) * item.price).toFixed(2);
                        return (
                          <Alert key={sapCode} className={stockStatus.status === 'critical' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}>
                            <div className="flex items-center gap-2">
                              <Clock className={`h-4 w-4 ${stockStatus.status === 'critical' ? 'text-red-600' : 'text-yellow-600'}`} />
                            </div>
                            <AlertDescription>
                              <div className="flex justify-between items-start">
                                <div>
                                  <strong className={`text-base ${stockStatus.status === 'critical' ? 'text-red-900' : 'text-yellow-900'}`}>{item.name}</strong>
                                  <div className="text-sm mt-1">
                                    <span className="inline-block mr-4">Current: <span className="font-mono">{currentStock.toFixed(item.unit === 'PC' ? 0 : 1)}{item.unit}</span></span>
                                    <span className="inline-block mr-4">Min: <span className="font-mono">{item.minStock.toFixed(item.unit === 'PC' ? 0 : 1)}{item.unit}</span></span>
                                    <span className="inline-block">Lead time: <span className="font-medium">{item.leadTime} days</span></span>
                                  </div>
                                  <div className="mt-2 text-sm">
                                    <span className="font-medium">Suggested order: </span>
                                    <span className="font-mono bg-background px-2 py-1 rounded border">{suggestedOrder}{item.unit}</span>
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
                    {Object.entries(INVENTORY_DATA).filter(([sapCode, item]) => (stockData[sapCode] ?? 0) <= item.minStock * 1.5).length === 0 && (
                      <Alert className="bg-green-50 border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                            <span className="text-green-800"><strong>All materials are well stocked!</strong> No reorders needed at this time.</span>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="machines" className="mt-4">
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium flex items-center gap-2 mb-4">
                        <Settings className="h-4 w-4" />
                        Machine Assignment Calculator
                      </h4>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                        <div className="space-y-2">
                          <Label>Order Name</Label>
                          <Input
                            value={machineOrderSpec.orderName}
                            onChange={(e) => setMachineOrderSpec(prev => ({...prev, orderName: e.target.value}))}
                            placeholder="e.g. Supermarket A"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Bag Width (mm)</Label>
                          <Input
                            type="number"
                            value={machineOrderSpec.bagWidth}
                            onChange={(e) => setMachineOrderSpec(prev => ({...prev, bagWidth: e.target.value}))}
                            placeholder="320"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Bag Height (mm)</Label>
                          <Input
                            type="number"
                            value={machineOrderSpec.bagHeight}
                            onChange={(e) => setMachineOrderSpec(prev => ({...prev, bagHeight: e.target.value}))}
                            placeholder="220"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Bag Gusset (mm)</Label>
                          <Input
                            type="number"
                            value={machineOrderSpec.bagGusset}
                            onChange={(e) => setMachineOrderSpec(prev => ({...prev, bagGusset: e.target.value}))}
                            placeholder="70"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Paper GSM</Label>
                          <Input
                            type="number"
                            value={machineOrderSpec.paperGSM}
                            onChange={(e) => setMachineOrderSpec(prev => ({...prev, paperGSM: e.target.value}))}
                            placeholder="80"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Paper Width (mm)</Label>
                          <Input
                            type="number"
                            value={machineOrderSpec.paperWidth}
                            onChange={(e) => setMachineOrderSpec(prev => ({...prev, paperWidth: e.target.value}))}
                            placeholder="850"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Handle Type</Label>
                          <Select 
                            value={machineOrderSpec.handleType} 
                            onValueChange={(value) => setMachineOrderSpec(prev => ({...prev, handleType: value}))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FLAT HANDLE">Flat Handle</SelectItem>
                              <SelectItem value="TWISTED HANDLE">Twisted Handle</SelectItem>
                              <SelectItem value="none">No Handle</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Patch Type</Label>
                          <Select 
                            value={machineOrderSpec.patchType} 
                            onValueChange={(value) => setMachineOrderSpec(prev => ({...prev, patchType: value}))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Patch</SelectItem>
                              <SelectItem value="single">Single Patch</SelectItem>
                              <SelectItem value="double">Double Patch</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Colors</Label>
                          <Select 
                            value={machineOrderSpec.colors.toString()} 
                            onValueChange={(value) => setMachineOrderSpec(prev => ({...prev, colors: parseInt(value)}))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">0 Colors</SelectItem>
                              <SelectItem value="1">1 Color</SelectItem>
                              <SelectItem value="2">2 Colors</SelectItem>
                              <SelectItem value="3">3 Colors</SelectItem>
                              <SelectItem value="4">4 Colors</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            value={machineOrderSpec.quantity}
                            onChange={(e) => setMachineOrderSpec(prev => ({...prev, quantity: e.target.value}))}
                            placeholder="10000"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Delivery Days</Label>
                          <Input
                            type="number"
                            value={machineOrderSpec.deliveryDays}
                            onChange={(e) => setMachineOrderSpec(prev => ({...prev, deliveryDays: e.target.value}))}
                            placeholder="7"
                          />
                        </div>
                      </div>

                      <Button 
                        onClick={analyzeMachineAssignment}
                        disabled={!machineOrderSpec.quantity || !machineOrderSpec.deliveryDays}
                        className="w-full mb-6"
                        data-testid="button-analyze-machines"
                      >
                        <Cpu className="h-4 w-4 mr-2" />
                        Analyze Machine Compatibility
                      </Button>

                      {machineAnalysis && (
                        <div className="space-y-4">
                          <Alert className={machineAnalysis.feasible ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                            <AlertDescription>
                              <div className="flex items-center gap-3">
                                <div className={`h-2 w-2 rounded-full ${machineAnalysis.feasible ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <div>
                                  <strong className={`text-base ${machineAnalysis.feasible ? 'text-green-900' : 'text-red-900'}`}>{machineAnalysis.feasible ? 'Order Can Be Produced' : 'No Suitable Machine Available'}</strong>
                                  <br />
                                  <span className={`text-sm ${machineAnalysis.feasible ? 'text-green-700' : 'text-red-700'}`}>
                                    {machineAnalysis.compatibleMachines} out of {machineAnalysis.totalMachines} machines are compatible
                                  </span>
                                </div>
                              </div>
                            </AlertDescription>
                          </Alert>

                          <div className="grid gap-4">
                            {machineAnalysis.machines.map((result: any) => {
                              const machine = result.machine;
                              const isCompatible = result.compatibility.compatible;
                              const canMeetDeadline = result.production.canMeetDeadline;
                              
                              let statusColor = 'border-red-200 bg-red-50';
                              let statusIcon = 'bg-red-500';
                              let statusText = 'Not Compatible';
                              
                              if (isCompatible && canMeetDeadline) {
                                statusColor = 'border-green-200 bg-green-50';
                                statusIcon = 'bg-green-500';
                                statusText = 'Perfect Match';
                              } else if (isCompatible && !canMeetDeadline) {
                                statusColor = 'border-yellow-200 bg-yellow-50';
                                statusIcon = 'bg-yellow-500';
                                statusText = 'Compatible but Slow';
                              }

                              return (
                                <Card key={result.machineId} className={statusColor}>
                                  <CardContent className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                      <div>
                                        <h5 className="font-bold text-lg flex items-center gap-3">
                                          <div className={`h-2 w-2 rounded-full ${statusIcon}`}></div>
                                          {machine.name} - {machine.category}
                                        </h5>
                                        <p className="text-sm text-muted-foreground">{machine.description}</p>
                                        <div className="flex items-center gap-4 mt-2 text-sm">
                                          <Badge variant={machine.status === 'available' ? 'default' : machine.status === 'busy' ? 'secondary' : 'destructive'}>
                                            {machine.status}
                                          </Badge>
                                          <span>Utilization: {machine.currentUtilization}%</span>
                                        </div>
                                      </div>
                                      <Badge variant={isCompatible ? 'default' : 'destructive'} className="whitespace-nowrap">
                                        {statusText}
                                      </Badge>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                                      <div>
                                        <span className="text-muted-foreground">Handle Type:</span>
                                        <div className="font-semibold">{machine.handleType}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Max Colors:</span>
                                        <div className="font-semibold">{machine.maxColors}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Paper Width:</span>
                                        <div className="font-semibold">{machine.minWidth}-{machine.maxWidth}mm</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">GSM Range:</span>
                                        <div className="font-semibold">{machine.minGSM}-{machine.maxGSM}</div>
                                      </div>
                                    </div>

                                    {isCompatible && (
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3 p-3 bg-background/50 rounded border">
                                        <div>
                                          <span className="text-muted-foreground">Daily Capacity:</span>
                                          <div className="font-semibold">{result.production.adjustedCapacity.toLocaleString()}</div>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Days Required:</span>
                                          <div className="font-semibold">{result.production.daysRequired}</div>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Hours Required:</span>
                                          <div className="font-semibold">{result.production.hoursRequired}h</div>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Order Utilization:</span>
                                          <div className="font-semibold">{result.production.utilization.toFixed(1)}%</div>
                                        </div>
                                      </div>
                                    )}

                                    {!isCompatible && result.compatibility.reasons.length > 0 && (
                                      <div className="bg-background/50 p-4 rounded border">
                                        <h6 className="font-medium mb-3 flex items-center gap-2">
                                          <AlertTriangle className="h-4 w-4" />
                                          Compatibility Issues
                                        </h6>
                                        <ul className="text-sm space-y-2">
                                          {result.compatibility.reasons.map((reason: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2">
                                              <span className="w-1 h-1 bg-red-500 rounded-full mt-2 flex-shrink-0"></span>
                                              <span>{reason}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
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
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-border/60">
                    <tr>
                      <th className="text-left px-2 py-2 font-semibold text-slate-700 text-xs tracking-wide">Material</th>
                      <th className="text-right px-2 py-2 font-semibold text-slate-700 text-xs tracking-wide">Required</th>
                      <th className="text-right px-2 py-2 font-semibold text-slate-700 text-xs tracking-wide">Available</th>
                      <th className="text-right px-2 py-2 font-semibold text-slate-700 text-xs tracking-wide">After Order</th>
                      <th className="text-right px-2 py-2 font-semibold text-slate-700 text-xs tracking-wide">Cost</th>
                      <th className="text-center px-2 py-2 font-semibold text-slate-700 text-xs tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.materialRequirements.map((req, index) => {
                      const statusColors = getStockStatus(req.available, req.required);
                      return (
                        <tr key={index} className="border-b border-border/30 hover:bg-slate-50/50 transition-colors">
                          <td className="px-2 py-2">
                            <div>
                              <div className="font-medium text-slate-900 text-xs">{req.name}</div>
                              <div className="text-xs text-slate-500 font-mono mt-1">{req.sapCode}</div>
                            </div>
                          </td>
                          <td className="text-right px-2 py-2">
                            <span className="font-mono font-medium text-blue-600 text-xs">
                              {req.required.toFixed(3)}
                            </span>
                            <span className="text-xs text-slate-500 ml-1">{req.unit}</span>
                          </td>
                          <td className="text-right px-2 py-2">
                            <span className={`font-mono font-medium text-xs ${req.shortage > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {req.available.toFixed(3)}
                            </span>
                            <span className="text-xs text-slate-500 ml-1">{req.unit}</span>
                          </td>
                          <td className="text-right px-2 py-2">
                            {req.shortage > 0 ? (
                              <span className="text-red-600 font-medium flex items-center justify-end gap-2 font-mono text-xs">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                                -{req.shortage.toFixed(3)} {req.unit}
                              </span>
                            ) : (
                              <span className="text-green-600 font-medium flex items-center justify-end gap-2 font-mono text-xs">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                {(req.available - req.required).toFixed(3)} {req.unit}
                              </span>
                            )}
                          </td>
                          <td className="text-right px-2 py-2 font-mono font-semibold text-slate-900 text-xs">
                            €{req.cost.toFixed(2)}
                          </td>
                          <td className="text-center px-2 py-2">
                            <Badge 
                              variant={req.status === 'critical' ? 'destructive' : req.status === 'low' ? 'secondary' : 'default'}
                              className={`${req.status === 'sufficient' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''} font-medium text-xs`}
                            >
                              {req.status}
                            </Badge>
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