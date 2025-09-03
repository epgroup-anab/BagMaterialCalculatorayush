import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calculator, Package, TrendingUp, AlertTriangle, CheckCircle, Clock, RefreshCw, Factory, Weight, Settings, Cpu, Trash2 } from "lucide-react";
import { SKU_DATA, type SKUData } from "@/data/skuData";
import { MACHINES_DATA } from "@/data/machinesData";
import { MATERIAL_DATABASE } from "@/data/materialDatabase";



type BOMItem = {
  type: string;
  sapCode: string;
  description: string;
  quantity: number;
  unit: string;
};

type BagSpecs = {
  name: string;
  sku?: string;
  width: number;
  gusset: number;
  height: number;
  gsm: number;
  handleType: string;
  paperGrade: string;
  certification: string;
  bagWeight?: number;
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

export default function CombinedCalculator() {
  // Form state
  const [inputMethod, setInputMethod] = useState<'specs' | 'existing'>('specs');
  const [existingSku, setExistingSku] = useState('');
  const [orderQty, setOrderQty] = useState(1000);
  const [orderUnit, setOrderUnit] = useState<'bags' | 'cartons'>('cartons');
  const [bagName, setBagName] = useState('');
  const [width, setWidth] = useState<number | ''>('');
  const [gusset, setGusset] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [gsm, setGsm] = useState<number | ''>('');
  const [handleType, setHandleType] = useState('FLAT HANDLE');
  const [paperGrade, setPaperGrade] = useState('VIRGIN');
  const [certification, setCertification] = useState('FSC');
  const [deliveryDays, setDeliveryDays] = useState(14);
  const [colors, setColors] = useState(0);

  // Results state
  const [materialResults, setMaterialResults] = useState<{
    specs: BagSpecs;
    bom: BOMItem[];
    steps: string[];
    isExistingSku: boolean;
  } | null>(null);

  const [inventoryResults, setInventoryResults] = useState<InventoryAnalysis | null>(null);
  const [machineResults, setMachineResults] = useState<any>(null);
  const [stockData, setStockData] = useState<Record<string, number>>({});
  const [stockDataLoading, setStockDataLoading] = useState(true);

  const fetchStockData = async (sapCode: string): Promise<number> => {
    try {
      const response = await fetch(`/api/inventory?sapCode=${sapCode}`);
      if (!response.ok) {
        console.warn(`Failed to fetch stock for ${sapCode}:`, response.status);
        return 0;
      }
      const data = await response.json();
      return data.stock || 0;
    } catch (error) {
      console.error(`Error fetching stock for ${sapCode}:`, error);
      return 0;
    }
  };

  // Load stock data from QuickBase API
  useEffect(() => {
    const loadAllStockData = async () => {
      setStockDataLoading(true);
      try {
        // Get all SAP codes from material database
        const allSapCodes = new Set<string>();
        
        // Collect SAP codes from material database
        Object.values(MATERIAL_DATABASE.PAPER.VIRGIN).forEach(item => allSapCodes.add(item.sapCode));
        Object.values(MATERIAL_DATABASE.PAPER.RECYCLED).forEach(item => allSapCodes.add(item.sapCode));
        Object.values(MATERIAL_DATABASE.PAPER.FIBREFORM).forEach(item => allSapCodes.add(item.sapCode));
        allSapCodes.add(MATERIAL_DATABASE.GLUE.COLD.sapCode);
        allSapCodes.add(MATERIAL_DATABASE.GLUE.HOT.sapCode);
        allSapCodes.add(MATERIAL_DATABASE.HANDLE.FLAT.sapCode);
        allSapCodes.add(MATERIAL_DATABASE.HANDLE.TWISTED.sapCode);
        allSapCodes.add(MATERIAL_DATABASE.PATCH.FLAT.sapCode);
        allSapCodes.add(MATERIAL_DATABASE.PATCH.TWISTED.sapCode);
        Object.values(MATERIAL_DATABASE.CARTON).forEach(item => allSapCodes.add(item.sapCode));
        
        const stockPromises = Array.from(allSapCodes).map(async (sapCode) => {
          const stock = await fetchStockData(sapCode);
          return { sapCode, stock };
        });
        
        const stockResults = await Promise.all(stockPromises);
        const newStockData: Record<string, number> = {};
        stockResults.forEach(({ sapCode, stock }) => {
          newStockData[sapCode] = stock;
        });
        setStockData(newStockData);
      } catch (error) {
        console.error('Error loading stock data:', error);
        // In case of complete failure, set empty stock data
        setStockData({});
      } finally {
        setStockDataLoading(false);
      }
    };

    loadAllStockData();
  }, []);

  // Load existing SKU data when selected
  useEffect(() => {
    if (existingSku && inputMethod === 'existing') {
      const selectedSku = SKU_DATA.find(item => item.sku === existingSku);
      if (selectedSku) {
        const dims = selectedSku.dimensions.split('×');
        setBagName(selectedSku.name);
        setWidth(parseInt(dims[0]) * 10);
        setGusset(parseInt(dims[1]) * 10);
        setHeight(parseInt(dims[2]) * 10);
        setGsm(parseInt(selectedSku.gsm));
        setHandleType(selectedSku.handle_type);
        setPaperGrade(selectedSku.paper_grade);
        setCertification(selectedSku.cert);
      }
    }
  }, [existingSku, inputMethod]);

  // Helper function to calculate actual number of bags
  const calculateActualBags = (qty: number, unit: 'bags' | 'cartons'): number => {
    return unit === 'cartons' ? qty * 250 : qty;
  };

  // Material calculation logic (from Home.tsx)
  const generateBOM = (specs: BagSpecs): { bom: BOMItem[]; steps: string[] } => {
    const bom: BOMItem[] = [];
    const steps: string[] = [];
    
    const widthMm = specs.width;
    const gussetMm = specs.gusset;
    const heightMm = specs.height;
    
    const frontBack = 2 * (widthMm * heightMm);
    const gussetArea = 2 * (gussetMm * heightMm);
    const bottomArea = widthMm * gussetMm;
    const overlapArea = (widthMm + gussetMm) * 2;
    const totalAreaMm2 = frontBack + gussetArea + bottomArea + overlapArea;
    
    const paperWeightPerMm2 = specs.gsm / 1000000;
    const paperWeight = (totalAreaMm2 * paperWeightPerMm2) / 1000;
    
    const paperGradeData = MATERIAL_DATABASE.PAPER[specs.paperGrade as keyof typeof MATERIAL_DATABASE.PAPER];
    const gsmStr = specs.gsm.toString();
    const paperInfo = (paperGradeData as any)?.[gsmStr] || (paperGradeData as any)?.["90"];
    
    if (paperInfo) {
      bom.push({
        type: "PAPER",
        sapCode: paperInfo.sapCode,
        description: paperInfo.description,
        quantity: paperWeight,
        unit: "KG"
      });
      steps.push(`Paper: ${totalAreaMm2.toFixed(0)}mm² × ${specs.gsm}g/m² = ${paperWeight.toFixed(6)}kg`);
    }

    const coldGlueQty = 0.0018;
    bom.push({
      type: "COLD GLUE",
      sapCode: MATERIAL_DATABASE.GLUE.COLD.sapCode,
      description: MATERIAL_DATABASE.GLUE.COLD.description,
      quantity: coldGlueQty,
      unit: "KG"
    });
    steps.push(`Cold Glue: Standard amount for bag construction = ${coldGlueQty}kg`);

    if (specs.handleType === "FLAT HANDLE") {
      const handleWeight = 0.0052;
      const patchWeight = 0.0012;
      const hotGlueQty = 0.0001;
      
      bom.push(
        {
          type: "HANDLE",
          sapCode: MATERIAL_DATABASE.HANDLE.FLAT.sapCode,
          description: MATERIAL_DATABASE.HANDLE.FLAT.description,
          quantity: handleWeight,
          unit: "KG"
        },
        {
          type: "PATCH",
          sapCode: MATERIAL_DATABASE.PATCH.FLAT.sapCode,
          description: MATERIAL_DATABASE.PATCH.FLAT.description,
          quantity: patchWeight,
          unit: "KG"
        },
        {
          type: "HOT GLUE",
          sapCode: MATERIAL_DATABASE.GLUE.HOT.sapCode,
          description: MATERIAL_DATABASE.GLUE.HOT.description,
          quantity: hotGlueQty,
          unit: "KG"
        }
      );
      
      steps.push(`Flat Handle: ${handleWeight}kg + Patch: ${patchWeight}kg + Hot Glue: ${hotGlueQty}kg`);
      
    } else if (specs.handleType === "TWISTED HANDLE") {
      const handleWeight = 0.7665;
      const patchWeight = 0.0036;
      const hotGlueQty = 0.0011;
      
      bom.push(
        {
          type: "HANDLE",
          sapCode: MATERIAL_DATABASE.HANDLE.TWISTED.sapCode,
          description: MATERIAL_DATABASE.HANDLE.TWISTED.description,
          quantity: handleWeight,
          unit: "KG"
        },
        {
          type: "PATCH",
          sapCode: MATERIAL_DATABASE.PATCH.TWISTED.sapCode,
          description: MATERIAL_DATABASE.PATCH.TWISTED.description,
          quantity: patchWeight,
          unit: "KG"
        },
        {
          type: "HOT GLUE",
          sapCode: MATERIAL_DATABASE.GLUE.HOT.sapCode,
          description: MATERIAL_DATABASE.GLUE.HOT.description,
          quantity: hotGlueQty,
          unit: "KG"
        }
      );
      
      steps.push(`Twisted Handle: ${handleWeight}kg + Patch: ${patchWeight}kg + Hot Glue: ${hotGlueQty}kg`);
    }

    const cartonQty = 0.004;
    bom.push({
      type: "CARTON",
      sapCode: MATERIAL_DATABASE.CARTON.STANDARD.sapCode,
      description: MATERIAL_DATABASE.CARTON.STANDARD.description,
      quantity: cartonQty,
      unit: "PC"
    });
    steps.push(`Carton: Standard packaging = ${cartonQty} pieces`);

    return { bom, steps };
  };

  // Inventory analysis logic (from InventoryCalculator.tsx)
  const calculateInventoryImpact = (bomItems: BOMItem[]) => {
    const actualBags = calculateActualBags(orderQty, orderUnit);
    const materialRequirements: MaterialRequirement[] = [];
    let totalCost = 0;
    let feasible = true;
    const warnings: string[] = [];
    const recommendations: string[] = [];

    bomItems.forEach(item => {
      const currentStock = stockData[item.sapCode] || 0;
      const required = Math.round((item.quantity * actualBags) * 1000) / 1000;
      const available = currentStock;
      const shortage = Math.max(0, Math.round((required - available) * 1000) / 1000);
      const estimatedPrice = 10; // Default price since we don't have inventory data
      const cost = required * estimatedPrice;
      
      let status: 'sufficient' | 'low' | 'critical' = 'sufficient';
      if (shortage > 0) {
        status = 'critical';
        feasible = false;
        warnings.push(`Insufficient ${item.description}: need ${required.toFixed(3)}${item.unit}, have ${available.toFixed(3)}${item.unit}`);
        recommendations.push(`Order ${shortage.toFixed(3)}${item.unit} of ${item.description}`);
      } else if (available > 0 && available - required < 100) { // Generic minimum threshold
        status = 'low';
        warnings.push(`${item.description} will fall below minimum stock after order`);
        recommendations.push(`Consider reordering ${item.description} to maintain safety stock`);
      }

      materialRequirements.push({
        sapCode: item.sapCode,
        name: item.description,
        required,
        available,
        shortage,
        unit: item.unit,
        status,
        cost
      });

      totalCost += cost;
    });

    return {
      feasible,
      totalCost,
      materialRequirements,
      warnings,
      recommendations
    };
  };

  // Machine analysis logic (from Machines.tsx)
  const analyzeMachines = () => {
    const actualBags = calculateActualBags(orderQty, orderUnit);
    const machineResults = Object.entries(MACHINES_DATA).map(([machineId, machine]) => {
      const compatibility = checkMachineCompatibility(machine as any, {
        handleType,
        colors,
        paperWidth: width ? (Number(width) + Number(gusset)) * 2 + 3 : 0,
        paperGSM: gsm,
        patchType: 'none'
      });
      
      const production = calculateMachineProduction(machine as any, {
        colors,
        patchType: 'none',
        quantity: actualBags.toString(),
        deliveryDays: deliveryDays.toString()
      });
      
      return {
        machineId,
        machine,
        compatibility,
        production,
        score: compatibility.compatible ? 
          (production.canMeetDeadline ? 100 - (machine.currentUtilization || 0) : 50) : 0
      };
    });

    machineResults.sort((a, b) => {
      if (a.compatibility.compatible && !b.compatibility.compatible) return -1;
      if (!a.compatibility.compatible && b.compatibility.compatible) return 1;
      return b.score - a.score;
    });

    return {
      machines: machineResults,
      feasible: machineResults.some(m => m.compatibility.compatible && m.production.canMeetDeadline),
      totalMachines: machineResults.length,
      compatibleMachines: machineResults.filter(m => m.compatibility.compatible).length
    };
  };

  const checkMachineCompatibility = (machine: any, specs: any) => {
    const reasons = [];
    let compatible = true;

    if (specs.handleType !== 'none' && machine.handleType !== specs.handleType) {
      compatible = false;
      reasons.push(`Requires ${specs.handleType} handle, machine has ${machine.handleType}`);
    }

    if (specs.colors > machine.maxColors) {
      compatible = false;
      reasons.push(`Requires ${specs.colors} colors, machine supports max ${machine.maxColors}`);
    }

    const paperWidth = parseInt(specs.paperWidth);
    if (paperWidth && (paperWidth < machine.minWidth || paperWidth > machine.maxWidth)) {
      compatible = false;
      reasons.push(`Paper width ${paperWidth}mm outside range (${machine.minWidth}-${machine.maxWidth}mm)`);
    }

    const paperGSM = parseInt(specs.paperGSM);
    if (paperGSM && (paperGSM < machine.minGSM || paperGSM > machine.maxGSM)) {
      compatible = false;
      reasons.push(`GSM ${paperGSM} outside range (${machine.minGSM}-${machine.maxGSM})`);
    }

    return { compatible, reasons };
  };

  const calculateMachineProduction = (machine: any, specs: any) => {
    const colorFactors: Record<number, number> = {
      0: 1.0, 1: 1.0, 2: 0.87, 3: 1.0, 4: 0.33
    };

    const colorFactor = colorFactors[specs.colors] || 1.0;
    const adjustedCapacity = machine.dailyCapacity * colorFactor;
    const finalCapacity = Math.floor(adjustedCapacity);
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
    const hoursRequired = parseFloat((quantity / (finalCapacity / 16)).toFixed(1));
    const utilization = Math.min((quantity / finalCapacity) * 100, 100);

    return {
      adjustedCapacity: finalCapacity,
      daysRequired,
      hoursRequired,
      utilization,
      canMeetDeadline: daysRequired <= deliveryDays
    };
  };

  // Combined calculation function
  const calculateAll = () => {
    if (!orderQty || orderQty <= 0) {
      alert('Please enter a valid order quantity');
      return;
    }

    if (stockDataLoading) {
      alert('Stock data is still loading. Please wait a moment and try again.');
      return;
    }

    let specs: BagSpecs;
    let bom: BOMItem[];
    let steps: string[];
    let isExistingSku = false;

    if (inputMethod === 'existing') {
      if (!existingSku) {
        alert('Please select an existing SKU');
        return;
      }

      const selectedSku = SKU_DATA.find(item => item.sku === existingSku);
      if (!selectedSku) {
        alert('SKU data not found');
        return;
      }

      const dims = selectedSku.dimensions.split('×');
      specs = {
        name: selectedSku.name,
        sku: selectedSku.sku,
        width: parseInt(dims[0]) * 10,
        gusset: parseInt(dims[1]) * 10, 
        height: parseInt(dims[2]) * 10,
        gsm: parseInt(selectedSku.gsm),
        handleType: selectedSku.handle_type,
        paperGrade: selectedSku.paper_grade,
        certification: selectedSku.cert,
        bagWeight: parseFloat(selectedSku.bag_weight)
      };

      bom = selectedSku.bom.filter(item => item.quantity != null && item.quantity > 0).map(item => ({
        type: item.type,
        sapCode: item.sapCode,
        description: `${item.type} - ${item.sapCode}`,
        quantity: item.quantity!,
        unit: item.unit
      }));

      steps = [`Using existing SKU: ${selectedSku.sku}`, `BOM sourced from production data`, `Total materials: ${bom.length} items`];
      isExistingSku = true;

    } else {
      if (!width || !gusset || !height || !gsm) {
        alert('Please fill in all dimension and GSM fields');
        return;
      }

      specs = {
        name: bagName || 'Custom Bag',
        width: Number(width),
        gusset: Number(gusset),
        height: Number(height),
        gsm: Number(gsm),
        handleType,
        paperGrade,
        certification
      };

      const result = generateBOM(specs);
      bom = result.bom;
      steps = result.steps;
    }

    // Calculate all three analyses
    setMaterialResults({ specs, bom, steps, isExistingSku });
    setInventoryResults(calculateInventoryImpact(bom));
    setMachineResults(analyzeMachines());
  };

  const clearForm = () => {
    setBagName('');
    setWidth('');
    setGusset('');
    setHeight('');
    setGsm('');
    setOrderQty(1000);
    setOrderUnit('cartons');
    setHandleType('FLAT HANDLE');
    setPaperGrade('VIRGIN');
    setCertification('FSC');
    setExistingSku('');
    setDeliveryDays(14);
    setColors(0);
    setMaterialResults(null);
    setInventoryResults(null);
    setMachineResults(null);
  };

  const totalMaterialWeight = materialResults?.bom.reduce((sum, item) => 
    item.unit === 'KG' ? sum + item.quantity : sum, 0) || 0;

  const estimatedBagWeight = materialResults?.isExistingSku && materialResults.specs.bagWeight 
    ? materialResults.specs.bagWeight 
    : (totalMaterialWeight + 0.005);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b header-gradient">
        <div className="container section-padding">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl mb-4">Complete Order Analysis</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Calculate materials, analyze inventory impact, and find optimal machines in one place
            </p>
          </div>
        </div>
      </header>

      <main className="container section-padding">
        {/* Input Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Order Specifications</CardTitle>
            <CardDescription>
              Enter your order details to get complete analysis across materials, inventory, and machine capacity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="space-y-2">
                <Label htmlFor="inputMethod">Input Method</Label>
                <Select value={inputMethod} onValueChange={(value: 'specs' | 'existing') => setInputMethod(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="specs">Enter Specifications</SelectItem>
                    <SelectItem value="existing">Use Existing SKU</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {inputMethod === 'existing' && (
                <div className="space-y-2">
                  <Label htmlFor="existingSku">Select SKU</Label>
                  <Select value={existingSku} onValueChange={setExistingSku}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an existing SKU..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {SKU_DATA.map(item => (
                        <SelectItem key={item.sku} value={item.sku}>
                          {item.sku} - {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="orderQty">Order Quantity</Label>
                <div className="flex gap-2">
                  <Input 
                    id="orderQty"
                    type="number" 
                    placeholder="e.g. 1000" 
                    min="1" 
                    value={orderQty}
                    onChange={(e) => setOrderQty(parseInt(e.target.value) || 0)}
                    className="flex-1"
                  />
                  <Select value={orderUnit} onValueChange={(value: 'bags' | 'cartons') => setOrderUnit(value)}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="bags">Bags</SelectItem>
                      <SelectItem value="cartons">Cartons</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {orderUnit === 'cartons' && (
                  <p className="text-xs text-muted-foreground">
                    {orderQty} cartons = {calculateActualBags(orderQty, orderUnit).toLocaleString()} bags (250 bags per carton)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryDays">Delivery Days</Label>
                <Input 
                  id="deliveryDays"
                  type="number" 
                  placeholder="e.g. 14" 
                  min="1" 
                  value={deliveryDays}
                  onChange={(e) => setDeliveryDays(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className={`transition-opacity duration-200 ${inputMethod === 'existing' ? 'opacity-50' : 'opacity-100'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="bagName">Bag Name</Label>
                  <Input 
                    id="bagName"
                    placeholder="e.g. Custom Kraft Bag" 
                    value={bagName}
                    onChange={(e) => setBagName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="width">Width (mm)</Label>
                  <Input 
                    id="width"
                    type="number" 
                    placeholder="e.g. 320" 
                    min="100" 
                    max="500" 
                    value={width}
                    onChange={(e) => setWidth(e.target.value ? parseInt(e.target.value) : '')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="gusset">Gusset (mm)</Label>
                  <Input 
                    id="gusset"
                    type="number" 
                    placeholder="e.g. 160" 
                    min="80" 
                    max="250" 
                    value={gusset}
                    onChange={(e) => setGusset(e.target.value ? parseInt(e.target.value) : '')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="height">Height (mm)</Label>
                  <Input 
                    id="height"
                    type="number" 
                    placeholder="e.g. 380" 
                    min="200" 
                    max="500" 
                    value={height}
                    onChange={(e) => setHeight(e.target.value ? parseInt(e.target.value) : '')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="gsm">GSM</Label>
                  <Input 
                    id="gsm"
                    type="number" 
                    placeholder="e.g. 90" 
                    min="50" 
                    max="200" 
                    value={gsm}
                    onChange={(e) => setGsm(e.target.value ? parseInt(e.target.value) : '')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="handleType">Handle Type</Label>
                  <Select value={handleType} onValueChange={setHandleType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="FLAT HANDLE">Flat Handle</SelectItem>
                      <SelectItem value="TWISTED HANDLE">Twisted Handle</SelectItem>
                      <SelectItem value="SQR BOTTOM">Square Bottom (No Handle)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="paperGrade">Paper Grade</Label>
                  <Select value={paperGrade} onValueChange={setPaperGrade}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="VIRGIN">Virgin Kraft</SelectItem>
                      <SelectItem value="RECYCLED">Recycled Kraft</SelectItem>
                      <SelectItem value="FIBREFORM">Fibreform (Heavy Duty)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="certification">Certification</Label>
                  <Select value={certification} onValueChange={setCertification}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="FSC">FSC</SelectItem>
                      <SelectItem value="PEFC">PEFC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="colors">Colors</Label>
                  <Select value={colors.toString()} onValueChange={(value) => setColors(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="0">0 Colors</SelectItem>
                      <SelectItem value="1">1 Color</SelectItem>
                      <SelectItem value="2">2 Colors</SelectItem>
                      <SelectItem value="3">3 Colors</SelectItem>
                      <SelectItem value="4">4 Colors</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4 pt-6 border-t-2 border-gradient-to-r from-blue-200 to-purple-200">
              <Button 
                onClick={calculateAll}
                disabled={stockDataLoading}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 border-2 border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {stockDataLoading ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Loading Stock Data...
                  </>
                ) : (
                  <>
                    <Calculator className="w-5 h-5 mr-2" />
                    Calculate Everything
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={clearForm}
                className="bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 text-red-700 font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 border-2 border-red-300 hover:border-red-400"
              >
                <Trash2 className="w-5 h-5 mr-2" />
                Clear Form
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results - All sections displayed sequentially */}
        {materialResults && inventoryResults && machineResults && (
          <div className="space-y-8">
            {/* Summary Section */}
            <Card className={`${
              materialResults && inventoryResults.feasible && machineResults.feasible 
                ? 'border-green-200 bg-green-50' 
                : 'border-red-200 bg-red-50'
            }`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {materialResults && inventoryResults.feasible && machineResults.feasible ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  Order Feasibility Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className={`text-2xl font-bold mb-2 ${materialResults ? 'text-green-900' : 'text-red-900'}`}>
                      {materialResults ? '✓' : '✗'}
                    </div>
                    <h4 className="font-medium mb-1">Materials Calculated</h4>
                    <p className="text-sm text-muted-foreground">
                      {materialResults ? 'BOM generated successfully' : 'Material calculation pending'}
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <div className={`text-2xl font-bold mb-2 ${inventoryResults?.feasible ? 'text-green-900' : 'text-red-900'}`}>
                      {inventoryResults?.feasible ? '✓' : '✗'}
                    </div>
                    <h4 className="font-medium mb-1">Inventory Available</h4>
                    <p className="text-sm text-muted-foreground">
                      {inventoryResults?.feasible ? 'All materials in stock' : 'Insufficient inventory'}
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <div className={`text-2xl font-bold mb-2 ${machineResults?.feasible ? 'text-green-900' : 'text-red-900'}`}>
                      {machineResults?.feasible ? '✓' : '✗'}
                    </div>
                    <h4 className="font-medium mb-1">Machine Available</h4>
                    <p className="text-sm text-muted-foreground">
                      {machineResults?.feasible ? 'Compatible machines found' : 'No suitable machines'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-background rounded-lg">
                  <h5 className="font-medium mb-3">Key Metrics</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Order Quantity:</span>
                      <div className="font-bold">
                        {calculateActualBags(orderQty, orderUnit).toLocaleString()} bags
                        {orderUnit === 'cartons' && <span className="text-sm text-muted-foreground ml-1">({orderQty} cartons)</span>}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Cost:</span>
                      <div className="font-bold">€{inventoryResults?.totalCost.toFixed(2) || '0.00'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Delivery Time:</span>
                      <div className="font-bold">{deliveryDays} days</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bag Weight:</span>
                      <div className="font-bold">{estimatedBagWeight.toFixed(4)} kg</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Materials BOM Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Bill of Materials
                </CardTitle>
                <CardDescription>Detailed breakdown of all materials required for production.</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Bag Specifications Display */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4 bg-muted/50 rounded-lg mb-6">
                  {materialResults.isExistingSku && materialResults.specs.sku && (
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-1">SKU</div>
                      <div className="font-semibold">{materialResults.specs.sku}</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Dimensions</div>
                    <div className="font-semibold">{materialResults.specs.width}×{materialResults.specs.gusset}×{materialResults.specs.height}mm</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">GSM</div>
                    <div className="font-semibold">{materialResults.specs.gsm}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Handle Type</div>
                    <div className="font-semibold">{materialResults.specs.handleType}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Paper Grade</div>
                    <div className="font-semibold">{materialResults.specs.paperGrade}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Certification</div>
                    <div className="font-semibold">{materialResults.specs.certification}</div>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="metric-grid mb-6">
                  <Card className="p-6 text-center bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                    <div className="flex items-center justify-center mb-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 rounded-full w-16 h-16 mx-auto">
                      <Package className="h-8 w-8" />
                    </div>
                    <div className="text-3xl font-bold mb-2 text-blue-900 bg-white/50 py-2 px-4 rounded-lg">{calculateActualBags(orderQty, orderUnit).toLocaleString()}</div>
                    <h4 className="text-lg font-bold text-blue-800 bg-blue-200 py-1 px-3 rounded-full">Order Quantity</h4>
                    <p className="text-sm text-blue-700 mt-2 font-medium">
                      bags {orderUnit === 'cartons' && `(${orderQty} cartons)`}
                    </p>
                  </Card>
                  <Card className="p-6 text-center bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                    <div className="flex items-center justify-center mb-3 bg-gradient-to-r from-green-600 to-green-700 text-white p-3 rounded-full w-16 h-16 mx-auto">
                      <Weight className="h-8 w-8" />
                    </div>
                    <div className="text-3xl font-bold mb-2 text-green-900 bg-white/50 py-2 px-4 rounded-lg">{totalMaterialWeight.toFixed(4)}</div>
                    <h4 className="text-lg font-bold text-green-800 bg-green-200 py-1 px-3 rounded-full">Material per Bag</h4>
                    <p className="text-sm text-green-700 mt-2 font-medium">kg</p>
                  </Card>
                  <Card className="p-6 text-center bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                    <div className="flex items-center justify-center mb-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white p-3 rounded-full w-16 h-16 mx-auto">
                      <Factory className="h-8 w-8" />
                    </div>
                    <div className="text-3xl font-bold mb-2 text-purple-900 bg-white/50 py-2 px-4 rounded-lg">{(totalMaterialWeight * calculateActualBags(orderQty, orderUnit)).toFixed(2)}</div>
                    <h4 className="text-lg font-bold text-purple-800 bg-purple-200 py-1 px-3 rounded-full">Total Material Weight</h4>
                    <p className="text-sm text-purple-700 mt-2 font-medium">kg</p>
                  </Card>
                  <Card className="p-6 text-center bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-300 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                    <div className="flex items-center justify-center mb-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white p-3 rounded-full w-16 h-16 mx-auto">
                      <TrendingUp className="h-8 w-8" />
                    </div>
                    <div className="text-3xl font-bold mb-2 text-orange-900 bg-white/50 py-2 px-4 rounded-lg">{estimatedBagWeight.toFixed(4)}</div>
                    <h4 className="text-lg font-bold text-orange-800 bg-orange-200 py-1 px-3 rounded-full">Estimated Bag Weight</h4>
                    <p className="text-sm text-orange-700 mt-2 font-medium">kg</p>
                  </Card>
                </div>

                {/* BOM Table */}
                <div className="border-2 rounded-lg p-6 mb-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 shadow-lg">
                  <div className="flex items-center mb-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 rounded-lg">
                    <Factory className="h-5 w-5 mr-3 text-white" />
                    <h4 className="font-bold text-lg">
                      {materialResults.isExistingSku ? 'Production BOM' : 'Calculated BOM'}
                    </h4>
                  </div>
                  <p className="text-sm mb-4 text-green-800 font-medium bg-white/50 p-3 rounded-md">
                    {materialResults.isExistingSku ? 'Materials from production database' : 'Materials calculated based on specifications'}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full shadow-md rounded-lg overflow-hidden">
                      <thead>
                        <tr className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Material Type</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">SAP Code</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Description</th>
                          <th className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wider">Qty per Bag</th>
                          <th className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wider">Total Qty</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-cyan-200">
                        {materialResults.bom.map((item, index) => (
                          <tr key={index} className="hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-100 transition-all duration-300 border-b border-cyan-100">
                            <td className="px-6 py-4 text-sm font-bold text-slate-800 bg-gradient-to-r from-cyan-100 to-sky-200">{item.type}</td>
                            <td className="px-6 py-4 text-sm font-mono font-medium text-slate-600 bg-blue-50">{item.sapCode}</td>
                            <td className="px-6 py-4 text-sm text-slate-700">{item.description}</td>
                            <td className="px-6 py-4 text-sm text-right font-mono font-bold text-slate-800 bg-gradient-to-r from-lime-100 to-emerald-200">{item.quantity.toFixed(6)}</td>
                            <td className="px-6 py-4 text-sm text-right font-mono font-bold text-slate-800 bg-gradient-to-r from-yellow-100 to-amber-200">
                              {(item.quantity * calculateActualBags(orderQty, orderUnit)).toFixed(item.unit === 'PC' ? 0 : 3)}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-600">{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Calculation Steps */}
                <div className="bg-muted/50 rounded-lg p-6">
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <Weight className="h-4 w-4" />
                    {materialResults.isExistingSku ? 'SKU Information' : 'Calculation Details'}
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {materialResults.steps.map((step, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-foreground rounded-full mt-2 flex-shrink-0"></span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Inventory Impact Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Inventory Impact Analysis
                  {stockDataLoading && (
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                  )}
                </CardTitle>
                <CardDescription>
                  Check if current inventory can support this order.
                  {!stockDataLoading && (
                    <span className="text-xs text-green-600 ml-2">
                      ✓ Real-time data from QuickBase
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className={`mb-6 ${inventoryResults.feasible 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {inventoryResults.feasible ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    )}
                    <AlertDescription className={inventoryResults.feasible ? 'text-green-800' : 'text-red-800'}>
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${inventoryResults.feasible ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <div>
                          <strong className="text-base">
                            {inventoryResults.feasible ? 'Inventory Sufficient' : 'Insufficient Inventory'}
                          </strong>
                          <br />
                          <span className="text-sm opacity-80">
                            Total material cost: €{inventoryResults.totalCost.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </AlertDescription>
                  </div>
                </Alert>

                {inventoryResults.warnings.length > 0 && (
                  <Alert className="mb-4 bg-yellow-50 border-yellow-200">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription>
                      <h4 className="font-medium mb-2 text-yellow-800">Warnings</h4>
                      <ul className="space-y-2">
                        {inventoryResults.warnings.map((warning, index) => (
                          <li key={index} className="text-sm flex items-start gap-2 text-yellow-700">
                            <span className="w-1 h-1 bg-yellow-600 rounded-full mt-2 flex-shrink-0"></span>
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {inventoryResults.recommendations.length > 0 && (
                  <Alert className="bg-blue-50 border-blue-200 mb-6">
                    <AlertDescription>
                      <h4 className="font-medium text-blue-800 mb-2">Recommendations</h4>
                      <ul className="space-y-2">
                        {inventoryResults.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm text-blue-700 flex items-start gap-2">
                            <span className="w-1 h-1 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Detailed Material Analysis Table */}
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
                      {inventoryResults.materialRequirements.map((req, index) => (
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Machine Compatibility Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Machine Compatibility Analysis
                </CardTitle>
                <CardDescription>Find the best machines for this order.</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className={machineResults.feasible ? 'bg-green-50 border-green-200 mb-6' : 'bg-red-50 border-red-200 mb-6'}>
                  <AlertDescription>
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${machineResults.feasible ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <div>
                        <strong className={`text-base ${machineResults.feasible ? 'text-green-900' : 'text-red-900'}`}>
                          {machineResults.feasible ? 'Compatible Machines Found' : 'No Compatible Machines'}
                        </strong>
                        <br />
                        <span className={`text-sm ${machineResults.feasible ? 'text-green-700' : 'text-red-700'}`}>
                          {machineResults.compatibleMachines} out of {machineResults.totalMachines} machines are compatible
                        </span>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4">
                  {machineResults.machines.map((result: any) => {
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
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}