import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, Trash2, Package, Factory, TrendingUp, Weight } from "lucide-react";
import { SKU_DATA, type SKUData } from "@/data/skuData";

const MATERIAL_DATABASE = {
  PAPER: {
    VIRGIN: {
      "50": { sapCode: "1004016", description: "Virgin Kraft 50 GSM" },
      "70": { sapCode: "1004359", description: "Virgin Kraft 70 GSM" },
      "75": { sapCode: "1003988", description: "Virgin Kraft 75 GSM" },
      "80": { sapCode: "1003696", description: "Virgin Kraft 80 GSM" },
      "85": { sapCode: "1003771", description: "Virgin Kraft 85 GSM" },
      "90": { sapCode: "1003696", description: "Virgin Kraft 90 GSM" },
      "100": { sapCode: "1004286", description: "Virgin Kraft 100 GSM" },
      "120": { sapCode: "1004369", description: "Virgin Kraft 120 GSM" },
      "150": { sapCode: "1003833", description: "Virgin Kraft 150 GSM" }
    },
    RECYCLED: {
      "50": { sapCode: "1004016", description: "Recycled Kraft 50 GSM" },
      "70": { sapCode: "1004359", description: "Recycled Kraft 70 GSM" },
      "80": { sapCode: "1003696", description: "Recycled Kraft 80 GSM" },
      "85": { sapCode: "1003696", description: "Recycled Kraft 85 GSM" },
      "90": { sapCode: "1003696", description: "Recycled Kraft 90 GSM" },
      "100": { sapCode: "1004017", description: "Recycled Kraft 100 GSM" }
    },
    FIBREFORM: {
      "150": { sapCode: "1003998", description: "Fibreform 150 GSM" }
    }
  },
  GLUE: {
    COLD: { sapCode: "1004557", description: "Cold Melt Adhesive" },
    HOT: { sapCode: "1004555", description: "Hot Melt Adhesive" }
  },
  HANDLE: {
    FLAT: { sapCode: "1003688", description: "Flat Paper Handle" },
    FLAT_ALT: { sapCode: "1003930", description: "Flat Paper Handle (Alternative)" },
    TWISTED: { sapCode: "1003967", description: "Twisted Paper Handle" }
  },
  PATCH: {
    FLAT: { sapCode: "1003695", description: "Handle Patch for Flat Handles" },
    FLAT_ALT: { sapCode: "1003823", description: "Handle Patch (Alternative)" },
    TWISTED: { sapCode: "1003948", description: "Handle Patch for Twisted Handles" }
  },
  CARTON: {
    STANDARD: { sapCode: "1003530", description: "Standard Carton Box" },
    SMALL: { sapCode: "1004232", description: "Small Carton Box" },
    MEDIUM: { sapCode: "1004289", description: "Medium Carton Box" },
    LARGE: { sapCode: "1004308", description: "Large Carton Box" }
  }
} as const;

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

export default function Home() {
  const [inputMethod, setInputMethod] = useState<'specs' | 'existing'>('specs');
  const [existingSku, setExistingSku] = useState('');
  const [orderQty, setOrderQty] = useState(1000);
  const [bagName, setBagName] = useState('');
  const [width, setWidth] = useState<number | ''>('');
  const [gusset, setGusset] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [gsm, setGsm] = useState<number | ''>('');
  const [handleType, setHandleType] = useState('FLAT HANDLE');
  const [paperGrade, setPaperGrade] = useState('VIRGIN');
  const [certification, setCertification] = useState('FSC');
  
  const [results, setResults] = useState<{
    specs: BagSpecs;
    bom: BOMItem[];
    steps: string[];
    isExistingSku: boolean;
  } | null>(null);

  // Load existing SKU data when selected
  useEffect(() => {
    if (existingSku && inputMethod === 'existing') {
      const selectedSku = SKU_DATA.find(item => item.sku === existingSku);
      if (selectedSku) {
        const dims = selectedSku.dimensions.split('×');
        setBagName(selectedSku.name);
        setWidth(parseInt(dims[0]));
        setGusset(parseInt(dims[1]));
        setHeight(parseInt(dims[2]));
        setGsm(parseInt(selectedSku.gsm));
        setHandleType(selectedSku.handle_type);
        setPaperGrade(selectedSku.paper_grade);
        setCertification(selectedSku.cert);
      }
    }
  }, [existingSku, inputMethod]);

  const generateBOM = (specs: BagSpecs): { bom: BOMItem[]; steps: string[] } => {
    const bom: BOMItem[] = [];
    const steps: string[] = [];
    
    // Calculate bag surface area for paper quantity
    const widthCm = specs.width / 10; // Convert mm to cm
    const gussetCm = specs.gusset / 10;
    const heightCm = specs.height / 10;
    
    // Calculate paper area (front + back + gusset + bottom + overlap)
    const frontBack = 2 * (widthCm * heightCm);
    const gussetArea = 2 * (gussetCm * heightCm);
    const bottomArea = widthCm * gussetCm;
    const overlapArea = (widthCm + gussetCm) * 2; // Seam allowance
    const totalArea = frontBack + gussetArea + bottomArea + overlapArea;
    
    // Paper weight calculation
    const paperWeightPerCm2 = specs.gsm / 1000; // Convert GSM to g/cm²
    const paperWeight = (totalArea * paperWeightPerCm2) / 1000; // Convert to kg
    
    // Get paper SAP code
    const paperGradeData = MATERIAL_DATABASE.PAPER[specs.paperGrade as keyof typeof MATERIAL_DATABASE.PAPER];
    const gsmStr = specs.gsm.toString();
    const paperInfo = (paperGradeData as any)?.[gsmStr] || (paperGradeData as any)?.["90"]; // Default to 90 GSM
    
    if (paperInfo) {
      bom.push({
        type: "PAPER",
        sapCode: paperInfo.sapCode,
        description: paperInfo.description,
        quantity: paperWeight,
        unit: "KG"
      });
      steps.push(`Paper: ${totalArea.toFixed(0)}cm² × ${specs.gsm}g/m² = ${paperWeight.toFixed(6)}kg`);
    }

    // Cold glue (always needed for bag construction)
    const coldGlueQty = 0.0018; // Base amount per bag
    bom.push({
      type: "COLD GLUE",
      sapCode: MATERIAL_DATABASE.GLUE.COLD.sapCode,
      description: MATERIAL_DATABASE.GLUE.COLD.description,
      quantity: coldGlueQty,
      unit: "KG"
    });
    steps.push(`Cold Glue: Standard amount for bag construction = ${coldGlueQty}kg`);

    // Handle and related materials
    if (specs.handleType === "FLAT HANDLE") {
      const handleWeight = 0.0052; // Standard flat handle weight
      const patchWeight = 0.0012; // Handle reinforcement patch
      const hotGlueQty = 0.0001; // For handle attachment
      
      bom.push({
        type: "HANDLE",
        sapCode: MATERIAL_DATABASE.HANDLE.FLAT.sapCode,
        description: MATERIAL_DATABASE.HANDLE.FLAT.description,
        quantity: handleWeight,
        unit: "KG"
      });
      
      bom.push({
        type: "PATCH",
        sapCode: MATERIAL_DATABASE.PATCH.FLAT.sapCode,
        description: MATERIAL_DATABASE.PATCH.FLAT.description,
        quantity: patchWeight,
        unit: "KG"
      });
      
      bom.push({
        type: "HOT GLUE",
        sapCode: MATERIAL_DATABASE.GLUE.HOT.sapCode,
        description: MATERIAL_DATABASE.GLUE.HOT.description,
        quantity: hotGlueQty,
        unit: "KG"
      });
      
      steps.push(`Flat Handle: ${handleWeight}kg + Patch: ${patchWeight}kg + Hot Glue: ${hotGlueQty}kg`);
      
    } else if (specs.handleType === "TWISTED HANDLE") {
      const handleWeight = 0.7665; // Twisted handles are much heavier (rope-like)
      const patchWeight = 0.0036; // Stronger patch for twisted handles
      const hotGlueQty = 0.0011; // More glue for twisted handle attachment
      
      bom.push({
        type: "HANDLE",
        sapCode: MATERIAL_DATABASE.HANDLE.TWISTED.sapCode,
        description: MATERIAL_DATABASE.HANDLE.TWISTED.description,
        quantity: handleWeight,
        unit: "KG"
      });
      
      bom.push({
        type: "PATCH",
        sapCode: MATERIAL_DATABASE.PATCH.TWISTED.sapCode,
        description: MATERIAL_DATABASE.PATCH.TWISTED.description,
        quantity: patchWeight,
        unit: "KG"
      });
      
      bom.push({
        type: "HOT GLUE",
        sapCode: MATERIAL_DATABASE.GLUE.HOT.sapCode,
        description: MATERIAL_DATABASE.GLUE.HOT.description,
        quantity: hotGlueQty,
        unit: "KG"
      });
      
      steps.push(`Twisted Handle: ${handleWeight}kg + Patch: ${patchWeight}kg + Hot Glue: ${hotGlueQty}kg`);
    }
    // SQR BOTTOM doesn't need handles

    // Carton (packaging)
    const cartonQty = 0.004; // Standard carton per bag
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

  const calculateMaterials = () => {
    if (!orderQty || orderQty <= 0) {
      alert('Please enter a valid order quantity');
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

      // Use existing SKU data
      const dims = selectedSku.dimensions.split('×');
      specs = {
        name: selectedSku.name,
        sku: selectedSku.sku,
        width: parseInt(dims[0]),
        gusset: parseInt(dims[1]), 
        height: parseInt(dims[2]),
        gsm: parseInt(selectedSku.gsm),
        handleType: selectedSku.handle_type,
        paperGrade: selectedSku.paper_grade,
        certification: selectedSku.cert,
        bagWeight: parseFloat(selectedSku.bag_weight)
      };

      // Use existing BOM
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
      // Handle custom specifications
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

      // Generate BOM for custom bag
      const result = generateBOM(specs);
      bom = result.bom;
      steps = result.steps;
    }

    setResults({ specs, bom, steps, isExistingSku });
  };

  const clearForm = () => {
    setBagName('');
    setWidth('');
    setGusset('');
    setHeight('');
    setGsm('');
    setOrderQty(1000);
    setHandleType('FLAT HANDLE');
    setPaperGrade('VIRGIN');
    setCertification('FSC');
    setExistingSku('');
    setResults(null);
  };

  const totalMaterialWeight = results?.bom.reduce((sum, item) => 
    item.unit === 'KG' ? sum + item.quantity : sum, 0) || 0;

  const estimatedBagWeight = results?.isExistingSku && results.specs.bagWeight 
    ? results.specs.bagWeight 
    : (totalMaterialWeight + 0.005);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-primary text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">🧠 Smart Bag Material Calculator</h1>
            <p className="text-primary-100 text-lg">Automatically calculates raw material requirements based on bag specifications</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Bag Specification Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>🎯</span>
              Bag Specifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <div className="space-y-2">
                <Label htmlFor="inputMethod">Input Method</Label>
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
                  <Label htmlFor="existingSku">Select SKU</Label>
                  <Select value={existingSku} onValueChange={setExistingSku}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an existing SKU..." />
                    </SelectTrigger>
                    <SelectContent>
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
                <Input 
                  id="orderQty"
                  type="number" 
                  placeholder="e.g. 1000" 
                  min="1" 
                  value={orderQty}
                  onChange={(e) => setOrderQty(parseInt(e.target.value) || 0)}
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
                    <SelectContent>
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
                    <SelectContent>
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
                    <SelectContent>
                      <SelectItem value="FSC">FSC</SelectItem>
                      <SelectItem value="PEFC">PEFC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
              <Button onClick={calculateMaterials} className="inline-flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Calculate Materials
              </Button>
              <Button variant="secondary" onClick={clearForm} className="inline-flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>📊</span>
                Generated Bill of Materials
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Specifications Display */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4 bg-muted rounded-lg mb-6">
                {results.isExistingSku && results.specs.sku && (
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">SKU</div>
                    <div className="font-semibold">{results.specs.sku}</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Dimensions</div>
                  <div className="font-semibold">{results.specs.width}×{results.specs.gusset}×{results.specs.height}mm</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">GSM</div>
                  <div className="font-semibold">{results.specs.gsm}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Handle Type</div>
                  <div className="font-semibold">{results.specs.handleType}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Paper Grade</div>
                  <div className="font-semibold">{results.specs.paperGrade}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Certification</div>
                  <div className="font-semibold">{results.specs.certification}</div>
                </div>
              </div>

              {/* BOM Table */}
              <div className="emerald-bg-50 emerald-border-200 border-2 rounded-lg p-4 mb-6">
                <div className="flex items-center mb-3">
                  <span className="mr-2">📋</span>
                  <h4 className="font-semibold emerald-text-800">
                    {results.isExistingSku ? 'Existing SKU BOM' : 'Auto-Generated BOM'}
                  </h4>
                </div>
                <p className="emerald-text-700 text-sm mb-4">
                  {results.isExistingSku ? 'Materials from production database:' : 'Materials automatically calculated based on bag specifications:'}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="emerald-bg-100">
                        <th className="px-4 py-3 text-left text-xs font-medium emerald-text-800 uppercase tracking-wider">Material Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium emerald-text-800 uppercase tracking-wider">SAP Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium emerald-text-800 uppercase tracking-wider">Description</th>
                        <th className="px-4 py-3 text-right text-xs font-medium emerald-text-800 uppercase tracking-wider">Qty per Bag</th>
                        <th className="px-4 py-3 text-left text-xs font-medium emerald-text-800 uppercase tracking-wider">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-emerald-200">
                      {results.bom.map((item, index) => (
                        <tr key={index} className="hover:bg-emerald-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.type}</td>
                          <td className="px-4 py-3 text-sm text-slate-700 font-mono">{item.sapCode}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{item.description}</td>
                          <td className="px-4 py-3 text-sm text-slate-900 text-right font-mono">{item.quantity.toFixed(6)}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Calculation Steps */}
              <div className="bg-muted rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-primary mb-3 flex items-center">
                  <span className="mr-2">📋</span>
                  {results.isExistingSku ? 'SKU Information' : 'Calculation Logic'}
                </h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {results.steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ul>
              </div>
              
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="gradient-summary-blue text-white p-5 rounded-xl">
                  <h4 className="text-blue-100 text-sm font-medium">Order Quantity</h4>
                  <div className="text-2xl font-bold mt-2">{orderQty.toLocaleString()}</div>
                </div>
                <div className="gradient-summary-emerald text-white p-5 rounded-xl">
                  <h4 className="text-emerald-100 text-sm font-medium">Material Weight/Bag</h4>
                  <div className="text-2xl font-bold mt-2">{totalMaterialWeight.toFixed(6)} kg</div>
                </div>
                <div className="gradient-summary-amber text-white p-5 rounded-xl">
                  <h4 className="text-amber-100 text-sm font-medium">Total Material Weight</h4>
                  <div className="text-2xl font-bold mt-2">{(totalMaterialWeight * orderQty).toFixed(3)} kg</div>
                </div>
                <div className="gradient-summary-purple text-white p-5 rounded-xl">
                  <h4 className="text-purple-100 text-sm font-medium">Estimated Bag Weight</h4>
                  <div className="text-2xl font-bold mt-2">{estimatedBagWeight.toFixed(4)} kg</div>
                </div>
              </div>

              {/* Detailed Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <Package className="mr-2 w-5 h-5" />
                    Per Bag Requirements
                  </h3>
                  <div className="overflow-x-auto bg-card border border-border rounded-lg">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Material</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SAP Code</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Quantity</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {results.bom.map((item, index) => (
                          <tr key={index} className="hover:bg-muted/50 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium">{item.type}</td>
                            <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{item.sapCode}</td>
                            <td className="px-4 py-3 text-sm text-right font-mono">{item.quantity.toFixed(item.unit === 'PC' ? 3 : 6)}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <Factory className="mr-2 w-5 h-5" />
                    Total Order Requirements
                  </h3>
                  <div className="overflow-x-auto bg-card border border-border rounded-lg">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Material</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SAP Code</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {results.bom.map((item, index) => {
                          const totalQty = item.quantity * orderQty;
                          return (
                            <tr key={index} className="hover:bg-muted/50 transition-colors">
                              <td className="px-4 py-3 text-sm font-medium">{item.type}</td>
                              <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{item.sapCode}</td>
                              <td className="px-4 py-3 text-sm text-right font-mono">{totalQty.toFixed(item.unit === 'PC' ? 0 : 3)}</td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{item.unit}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="emerald-bg-50 emerald-border-200 border rounded-lg p-4">
                <div className="flex items-center">
                  <span className="mr-2">✅</span>
                  <span className="font-semibold emerald-text-800">Smart Calculation Complete!</span>
                </div>
                <p className="emerald-text-700 text-sm mt-1">All materials and quantities have been automatically calculated based on your bag specifications and industry standards.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-secondary text-secondary-foreground py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm">&copy; 2024 Smart Bag Material Calculator. Professional material calculation system.</p>
        </div>
      </footer>
    </div>
  );
}
