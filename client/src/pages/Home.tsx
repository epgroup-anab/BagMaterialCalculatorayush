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
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b header-gradient">
        <div className="container section-padding">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl mb-4">Material Calculator</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Calculate precise raw material requirements for bag production based on specifications and industry standards.</p>
          </div>
        </div>
      </header>

      <main className="container section-padding">
        {/* Bag Specification Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Bag Specifications</CardTitle>
            <CardDescription>
              Enter your bag specifications or select an existing SKU to calculate material requirements.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
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
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4 pt-6 border-t-2 border-gradient-to-r from-blue-200 to-purple-200">
              <Button 
                onClick={calculateMaterials}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 border-2 border-blue-300"
              >
                <Calculator className="w-5 h-5 mr-2" />
                Calculate Materials
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

        {/* Results */}
        {results && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Bill of Materials</CardTitle>
              <CardDescription>
                Detailed breakdown of all materials required for production.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Specifications Display */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4 bg-muted/50 rounded-lg mb-6">
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
              <div className="border-2 rounded-lg p-6 mb-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 shadow-lg">
                <div className="flex items-center mb-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 rounded-lg">
                  <Factory className="h-5 w-5 mr-3 text-white" />
                  <h4 className="font-bold text-lg">
                    {results.isExistingSku ? 'Production BOM' : 'Calculated BOM'}
                  </h4>
                </div>
                <p className="text-sm mb-4 text-green-800 font-medium bg-white/50 p-3 rounded-md">
                  {results.isExistingSku ? 'Materials from production database' : 'Materials calculated based on specifications'}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full shadow-md rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                        <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Material Type</th>
                        <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">SAP Code</th>
                        <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Description</th>
                        <th className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wider">Qty per Bag</th>
                        <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-cyan-200">
                      {results.bom.map((item, index) => (
                        <tr key={index} className="hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-100 transition-all duration-300 border-b border-cyan-100">
                          <td className="px-6 py-4 text-sm font-bold text-slate-800 bg-gradient-to-r from-cyan-100 to-sky-200">{item.type}</td>
                          <td className="px-6 py-4 text-sm font-mono font-medium text-slate-600 bg-blue-50">{item.sapCode}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">{item.description}</td>
                          <td className="px-6 py-4 text-sm text-right font-mono font-bold text-slate-800 bg-gradient-to-r from-lime-100 to-emerald-200">{item.quantity.toFixed(6)}</td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-600">{item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Calculation Steps */}
              <div className="bg-muted/50 rounded-lg p-6 mb-6">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <Weight className="h-4 w-4" />
                  {results.isExistingSku ? 'SKU Information' : 'Calculation Details'}
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {results.steps.map((step, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-foreground rounded-full mt-2 flex-shrink-0"></span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Summary Cards */}
              <div className="metric-grid mb-8">
                <Card className="p-6 text-center bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center justify-center mb-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 rounded-full w-16 h-16 mx-auto">
                    <Package className="h-8 w-8" />
                  </div>
                  <div className="text-3xl font-bold mb-2 text-blue-900 bg-white/50 py-2 px-4 rounded-lg">{orderQty.toLocaleString()}</div>
                  <h4 className="text-lg font-bold text-blue-800 bg-blue-200 py-1 px-3 rounded-full">Order Quantity</h4>
                  <p className="text-sm text-blue-700 mt-2 font-medium">units</p>
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
                  <div className="text-3xl font-bold mb-2 text-purple-900 bg-white/50 py-2 px-4 rounded-lg">{(totalMaterialWeight * orderQty).toFixed(2)}</div>
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

              {/* Detailed Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200 shadow-lg">
                  <h3 className="text-xl font-bold mb-4 flex items-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 rounded-lg shadow-md">
                    <Package className="mr-3 w-6 h-6" />
                    Materials Per Bag
                  </h3>
                  <div className="overflow-x-auto rounded-lg border-2 border-blue-300 shadow-lg">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-cyan-500 to-blue-500">
                        <tr>
                          <th className="px-6 py-4 text-left font-bold text-white text-sm tracking-wide uppercase">Material</th>
                          <th className="px-6 py-4 text-left font-bold text-white text-sm tracking-wide uppercase">SAP Code</th>
                          <th className="px-6 py-4 text-right font-bold text-white text-sm tracking-wide uppercase">Quantity</th>
                          <th className="px-6 py-4 text-left font-bold text-white text-sm tracking-wide uppercase">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cyan-200 bg-white">
                        {results.bom.map((item, index) => (
                          <tr key={index} className="hover:bg-gradient-to-r hover:from-cyan-50 hover:to-sky-100 transition-all duration-300">
                            <td className="px-6 py-4 text-sm font-bold text-slate-800 bg-gradient-to-r from-cyan-100 to-sky-200">{item.type}</td>
                            <td className="px-6 py-4 text-sm font-mono font-medium text-slate-600 bg-blue-50">{item.sapCode}</td>
                            <td className="px-6 py-4 text-sm text-right font-mono font-bold text-slate-800 bg-gradient-to-r from-lime-100 to-emerald-200">{item.quantity.toFixed(item.unit === 'PC' ? 3 : 6)}</td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-600">{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border-2 border-purple-200 shadow-lg">
                  <h3 className="text-xl font-bold mb-4 flex items-center bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-3 rounded-lg shadow-md">
                    <Factory className="mr-3 w-6 h-6" />
                    Factory Total Requirements
                  </h3>
                  <div className="overflow-x-auto rounded-lg border-2 border-purple-300 shadow-lg">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-sky-500 to-indigo-600">
                        <tr>
                          <th className="px-6 py-4 text-left font-bold text-white text-sm tracking-wide uppercase">Material</th>
                          <th className="px-6 py-4 text-left font-bold text-white text-sm tracking-wide uppercase">SAP Code</th>
                          <th className="px-6 py-4 text-right font-bold text-white text-sm tracking-wide uppercase">Total Qty</th>
                          <th className="px-6 py-4 text-left font-bold text-white text-sm tracking-wide uppercase">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sky-200 bg-white">
                        {results.bom.map((item, index) => {
                          const totalQty = item.quantity * orderQty;
                          return (
                            <tr key={index} className="hover:bg-gradient-to-r hover:from-sky-50 hover:to-cyan-100 transition-all duration-300">
                              <td className="px-6 py-4 text-sm font-bold text-slate-800 bg-gradient-to-r from-sky-100 to-cyan-200">{item.type}</td>
                              <td className="px-6 py-4 text-sm font-mono font-medium text-slate-600 bg-blue-50">{item.sapCode}</td>
                              <td className="px-6 py-4 text-sm text-right font-mono font-bold text-slate-800 bg-gradient-to-r from-lime-100 to-emerald-200">{totalQty.toFixed(item.unit === 'PC' ? 0 : 3)}</td>
                              <td className="px-6 py-4 text-sm font-medium text-slate-600">{item.unit}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="font-medium text-green-900">Calculation Complete</span>
                </div>
                <p className="text-sm text-green-700">All materials and quantities have been calculated based on specifications and industry standards.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/40 py-8 mt-16">
        <div className="container text-center">
          <p className="text-sm text-muted-foreground">&copy; 2025 Bag Material Calculator. Professional material calculation system.</p>
        </div>
      </footer>
    </div>
  );
}
