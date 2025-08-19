import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Cpu, AlertTriangle } from "lucide-react";

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

export default function Machines() {
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

  const machineStats = Object.entries(MACHINES_DATA).reduce((acc, [_, machine]) => {
    acc.totalMachines += 1;
    if (machine.status === 'available') acc.available += 1;
    if (machine.status === 'busy') acc.busy += 1;
    if (machine.status === 'maintenance') acc.maintenance += 1;
    acc.totalUtilization += machine.currentUtilization;
    return acc;
  }, { totalMachines: 0, available: 0, busy: 0, maintenance: 0, totalUtilization: 0 });

  const avgUtilization = Math.round(machineStats.totalUtilization / machineStats.totalMachines);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b header-gradient">
        <div className="container section-padding">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-semibold tracking-tight mb-4">Machine Management</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Analyze machine compatibility and production capacity for orders.</p>
          </div>
        </div>
      </header>

      <main className="container section-padding">
        {/* Status Cards */}
        <div className="metric-grid mb-8">
          <Card className="p-6 text-center metric-card-1">
            <div className="text-2xl font-semibold mb-1 text-blue-900">{machineStats.totalMachines}</div>
            <h4 className="text-sm font-medium text-blue-700">Total Machines</h4>
          </Card>
          <Card className="p-6 text-center metric-card-2">
            <div className="text-2xl font-semibold mb-1 text-green-900">{machineStats.available}</div>
            <h4 className="text-sm font-medium text-green-700">Available</h4>
          </Card>
          <Card className="p-6 text-center metric-card-3">
            <div className="text-2xl font-semibold text-purple-900 mb-1">{machineStats.busy}</div>
            <h4 className="text-sm font-medium text-purple-700">Busy</h4>
          </Card>
          <Card className="p-6 text-center metric-card-4">
            <div className="text-2xl font-semibold text-orange-900 mb-1">{avgUtilization}%</div>
            <h4 className="text-sm font-medium text-orange-700">Avg Utilization</h4>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Machine Assignment Calculator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Machine Assignment Calculator
              </CardTitle>
              <CardDescription>
                Enter order specifications to find the best machine for production
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                    <SelectContent className="bg-white">
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
                    <SelectContent className="bg-white">
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
                    <SelectContent className="bg-white">
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
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}