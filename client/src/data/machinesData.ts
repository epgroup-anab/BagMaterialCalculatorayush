export interface MachineData {
  name: string;
  category: string;
  description: string;
  handleType: string;
  maxColors: number;
  dailyCapacity: number;
  hourlyCapacity: number;
  speed: number;
  minWidth: number;
  maxWidth: number;
  minGSM: number;
  maxGSM: number;
  supportsPatch?: boolean;
  status: string;
  currentUtilization: number;
  // Performance metrics
  setupTimeMinutes: number;
  efficiency: number;
  operatorCostPerHour: number;
  energyCostPerHour: number;
  maintenanceCostPerDay: number;
  // Scheduling metrics
  scheduledBags: number;
  scheduledHours: number;
  remainingDailyCapacity: number;
  nextMaintenanceDate?: string;
  workingHoursPerDay: number;
}

export type MachinesData = Record<string, MachineData>;

export const MACHINES_DATA: MachinesData = {
  'M1': {
    name: 'M1',
    category: 'GM 5QT FH',
    description: 'Garant Triumph 5QT',
    handleType: 'FLAT HANDLE',
    maxColors: 1,
    dailyCapacity: 82000,
    hourlyCapacity: 5125,
    speed: 100,
    minWidth: 800,
    maxWidth: 1100,
    minGSM: 70,
    maxGSM: 100,
    status: 'available',
    currentUtilization: 65,
    setupTimeMinutes: 30,
    efficiency: 0.92,
    operatorCostPerHour: 18,
    energyCostPerHour: 12,
    maintenanceCostPerDay: 25,
    scheduledBags: 0,
    scheduledHours: 0,
    remainingDailyCapacity: 82000,
    workingHoursPerDay: 16
  },
  'M2': {
    name: 'M2',
    category: 'GM 5QT FH',
    description: 'Garant Triumph 5QT',
    handleType: 'FLAT HANDLE',
    maxColors: 3,
    dailyCapacity: 82000,
    hourlyCapacity: 5125,
    speed: 100,
    minWidth: 800,
    maxWidth: 1100,
    minGSM: 70,
    maxGSM: 100,
    status: 'busy',
    currentUtilization: 85,
    setupTimeMinutes: 30,
    efficiency: 0.92,
    operatorCostPerHour: 18,
    energyCostPerHour: 12,
    maintenanceCostPerDay: 25,
    scheduledBags: 69700,
    scheduledHours: 13.6,
    remainingDailyCapacity: 12300,
    workingHoursPerDay: 16
  },
  'M3': {
    name: 'M3',
    category: 'GM 5QT FH',
    description: 'Garant Triumph 5QT',
    handleType: 'FLAT HANDLE',
    maxColors: 3,
    dailyCapacity: 82000,
    hourlyCapacity: 5125,
    speed: 100,
    minWidth: 800,
    maxWidth: 1100,
    minGSM: 70,
    maxGSM: 100,
    status: 'available',
    currentUtilization: 45,
    setupTimeMinutes: 30,
    efficiency: 0.92,
    operatorCostPerHour: 18,
    energyCostPerHour: 12,
    maintenanceCostPerDay: 25,
    scheduledBags: 36900,
    scheduledHours: 7.2,
    remainingDailyCapacity: 45100,
    workingHoursPerDay: 16
  },
  'M4': {
    name: 'M4',
    category: 'GM 5QT FH',
    description: 'Garant Triumph 5QT',
    handleType: 'FLAT HANDLE',
    maxColors: 1,
    dailyCapacity: 82000,
    hourlyCapacity: 5125,
    speed: 100,
    minWidth: 800,
    maxWidth: 1100,
    minGSM: 70,
    maxGSM: 100,
    status: 'available',
    currentUtilization: 30,
    setupTimeMinutes: 30,
    efficiency: 0.92,
    operatorCostPerHour: 18,
    energyCostPerHour: 12,
    maintenanceCostPerDay: 25,
    scheduledBags: 24600,
    scheduledHours: 4.8,
    remainingDailyCapacity: 57400,
    workingHoursPerDay: 16
  },
  'M5': {
    name: 'M5',
    category: 'GM 5F6 FH',
    description: 'Garant 5F6',
    handleType: 'FLAT HANDLE',
    maxColors: 4,
    dailyCapacity: 82000,
    hourlyCapacity: 5125,
    speed: 100,
    minWidth: 700,
    maxWidth: 1200,
    minGSM: 70,
    maxGSM: 110,
    supportsPatch: true,
    status: 'available',
    currentUtilization: 55,
    setupTimeMinutes: 45,
    efficiency: 0.88,
    operatorCostPerHour: 20,
    energyCostPerHour: 14,
    maintenanceCostPerDay: 30,
    scheduledBags: 45100,
    scheduledHours: 8.8,
    remainingDailyCapacity: 36900,
    workingHoursPerDay: 16
  },
  'M6': {
    name: 'M6',
    category: 'GM 5F6 TH',
    description: 'Garant 5F6',
    handleType: 'TWISTED HANDLE',
    maxColors: 2,
    dailyCapacity: 82000,
    hourlyCapacity: 5125,
    speed: 100,
    minWidth: 700,
    maxWidth: 1200,
    minGSM: 70,
    maxGSM: 110,
    status: 'maintenance',
    currentUtilization: 0,
    setupTimeMinutes: 60,
    efficiency: 0.85,
    operatorCostPerHour: 22,
    energyCostPerHour: 16,
    maintenanceCostPerDay: 35,
    scheduledBags: 0,
    scheduledHours: 0,
    remainingDailyCapacity: 82000,
    nextMaintenanceDate: '2024-01-15',
    workingHoursPerDay: 16
  },
  'NL1': {
    name: 'NL1',
    category: 'NL FH',
    description: 'Newlong',
    handleType: 'FLAT HANDLE',
    maxColors: 2,
    dailyCapacity: 65600,
    hourlyCapacity: 4100,
    speed: 80,
    minWidth: 750,
    maxWidth: 1000,
    minGSM: 75,
    maxGSM: 95,
    status: 'available',
    currentUtilization: 70,
    setupTimeMinutes: 25,
    efficiency: 0.90,
    operatorCostPerHour: 16,
    energyCostPerHour: 10,
    maintenanceCostPerDay: 20,
    scheduledBags: 45920,
    scheduledHours: 11.2,
    remainingDailyCapacity: 19680,
    workingHoursPerDay: 16
  },
  'NL2': {
    name: 'NL2',
    category: 'NL FH',
    description: 'Newlong',
    handleType: 'FLAT HANDLE',
    maxColors: 2,
    dailyCapacity: 65600,
    hourlyCapacity: 4100,
    speed: 80,
    minWidth: 750,
    maxWidth: 1000,
    minGSM: 75,
    maxGSM: 95,
    status: 'available',
    currentUtilization: 40,
    setupTimeMinutes: 25,
    efficiency: 0.90,
    operatorCostPerHour: 16,
    energyCostPerHour: 10,
    maintenanceCostPerDay: 20,
    scheduledBags: 26240,
    scheduledHours: 6.4,
    remainingDailyCapacity: 39360,
    workingHoursPerDay: 16
  }
};

// Convert to format compatible with bulk-upload API
export interface MachineSpec {
  id: string;
  name: string;
  maxWidth: number;
  maxHeight: number;
  maxGusset: number;
  minGsm: number;
  maxGsm: number;
  supportedHandles: string[];
  capacity: number;
  available: boolean;
  nextAvailableTime: Date;
  minWidth?: number;
  // Enhanced scheduling properties
  hourlyCapacity: number;
  scheduledBags: number;
  scheduledHours: number;
  remainingDailyCapacity: number;
  setupTimeMinutes: number;
  efficiency: number;
  operatorCostPerHour: number;
  energyCostPerHour: number;
  maintenanceCostPerDay: number;
  workingHoursPerDay: number;
}

// Enhanced machine analytics interface
export interface MachineAnalytics {
  machineId: string;
  machineName: string;
  totalBagsScheduled: number;
  totalProductionHours: number;
  utilizationPercentage: number;
  remainingCapacity: number;
  estimatedCompletionTime: Date;
  productionCost: number;
  orders: Array<{
    orderId: string;
    bagQuantity: number;
    startTime: Date;
    endTime: Date;
    setupTime: number;
  }>;
}

export function getMachineFleet(): MachineSpec[] {
  const baseTime = new Date();
  
  return Object.entries(MACHINES_DATA).map(([id, machine]) => ({
    id,
    name: machine.name,
    maxWidth: machine.maxWidth,
    maxHeight: 600, // Default max height
    maxGusset: 200, // Default max gusset
    minGsm: machine.minGSM,
    maxGsm: machine.maxGSM,
    supportedHandles: [machine.handleType],
    capacity: machine.dailyCapacity,
    available: machine.status === 'available',
    nextAvailableTime: baseTime,
    minWidth: machine.minWidth,
    // Enhanced scheduling properties
    hourlyCapacity: machine.hourlyCapacity,
    scheduledBags: machine.scheduledBags,
    scheduledHours: machine.scheduledHours,
    remainingDailyCapacity: machine.remainingDailyCapacity,
    setupTimeMinutes: machine.setupTimeMinutes,
    efficiency: machine.efficiency,
    operatorCostPerHour: machine.operatorCostPerHour,
    energyCostPerHour: machine.energyCostPerHour,
    maintenanceCostPerDay: machine.maintenanceCostPerDay,
    workingHoursPerDay: machine.workingHoursPerDay
  }));
}

// Calculate machine analytics for comprehensive reporting
export function calculateMachineAnalytics(machines: MachineSpec[], productionSchedule: any[]): MachineAnalytics[] {
  return machines.map(machine => {
    const machineOrders = productionSchedule.filter(order => order.machineId === machine.id);
    const totalBagsScheduled = machineOrders.reduce((sum, order) => sum + order.bagQuantity, 0);
    const totalProductionHours = machineOrders.reduce((sum, order) => {
      const hours = (order.endTime.getTime() - order.startTime.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);
    
    const utilizationPercentage = (totalProductionHours / machine.workingHoursPerDay) * 100;
    const remainingCapacity = machine.capacity - totalBagsScheduled;
    const productionCost = totalProductionHours * (machine.operatorCostPerHour + machine.energyCostPerHour) + machine.maintenanceCostPerDay;
    
    const estimatedCompletionTime = machineOrders.length > 0 
      ? new Date(Math.max(...machineOrders.map(order => order.endTime.getTime())))
      : new Date();

    return {
      machineId: machine.id,
      machineName: machine.name,
      totalBagsScheduled,
      totalProductionHours,
      utilizationPercentage,
      remainingCapacity,
      estimatedCompletionTime,
      productionCost,
      orders: machineOrders.map(order => ({
        orderId: order.orderId,
        bagQuantity: order.bagQuantity,
        startTime: order.startTime,
        endTime: order.endTime,
        setupTime: machine.setupTimeMinutes
      }))
    };
  });
}

// Production Timeline Interface
export interface ProductionTimelineEvent {
  machineId: string;
  machineName: string;
  orderId: string;
  eventType: 'setup' | 'production' | 'idle';
  startTime: Date;
  endTime: Date;
  bagQuantity?: number;
  status: 'scheduled' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}

// Generate comprehensive production timeline
export function generateProductionTimeline(machines: MachineSpec[], productionSchedule: any[]): ProductionTimelineEvent[] {
  const timeline: ProductionTimelineEvent[] = [];
  const startOfDay = new Date();
  startOfDay.setHours(6, 0, 0, 0); // Assume work starts at 6 AM
  
  machines.forEach(machine => {
    const machineOrders = productionSchedule
      .filter(order => order.machineId === machine.id)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    let currentTime = new Date(startOfDay);
    
    machineOrders.forEach((order, index) => {
      // Add idle time if there's a gap
      if (currentTime < order.startTime) {
        timeline.push({
          machineId: machine.id,
          machineName: machine.name,
          orderId: `IDLE_${machine.id}_${index}`,
          eventType: 'idle',
          startTime: new Date(currentTime),
          endTime: new Date(order.startTime),
          status: 'scheduled',
          priority: 'low'
        });
      }
      
      // Add setup time
      const setupEndTime = new Date(order.startTime.getTime() + machine.setupTimeMinutes * 60 * 1000);
      timeline.push({
        machineId: machine.id,
        machineName: machine.name,
        orderId: order.orderId,
        eventType: 'setup',
        startTime: new Date(order.startTime),
        endTime: setupEndTime,
        status: 'scheduled',
        priority: 'medium'
      });
      
      // Add production time
      timeline.push({
        machineId: machine.id,
        machineName: machine.name,
        orderId: order.orderId,
        eventType: 'production',
        startTime: setupEndTime,
        endTime: new Date(order.endTime),
        bagQuantity: order.bagQuantity,
        status: 'scheduled',
        priority: 'high'
      });
      
      currentTime = new Date(order.endTime);
    });
    
    // Add remaining idle time until end of work day
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(22, 0, 0, 0); // Assume work ends at 10 PM
    
    if (currentTime < endOfDay) {
      timeline.push({
        machineId: machine.id,
        machineName: machine.name,
        orderId: `IDLE_END_${machine.id}`,
        eventType: 'idle',
        startTime: new Date(currentTime),
        endTime: endOfDay,
        status: 'scheduled',
        priority: 'low'
      });
    }
  });
  
  return timeline.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

// Calculate production bottlenecks and optimization suggestions
export function analyzeProductionBottlenecks(machines: MachineSpec[], productionSchedule: any[]) {
  const analytics = calculateMachineAnalytics(machines, productionSchedule);
  const timeline = generateProductionTimeline(machines, productionSchedule);
  
  // Find overutilized machines (>90% utilization)
  const bottlenecks = analytics.filter(machine => machine.utilizationPercentage > 90);
  
  // Find underutilized machines (<50% utilization)
  const underutilized = analytics.filter(machine => machine.utilizationPercentage < 50);
  
  // Calculate load balancing suggestions
  const suggestions = [];
  
  if (bottlenecks.length > 0 && underutilized.length > 0) {
    bottlenecks.forEach(bottleneck => {
      const compatibleMachines = underutilized.filter(under => 
        machines.find(m => m.id === under.machineId)?.supportedHandles
          .some(handle => machines.find(m => m.id === bottleneck.machineId)?.supportedHandles.includes(handle))
      );
      
      if (compatibleMachines.length > 0) {
        suggestions.push({
          type: 'load_balance',
          bottleneckMachine: bottleneck.machineName,
          suggestedMachine: compatibleMachines[0].machineName,
          potentialSavings: `${(bottleneck.utilizationPercentage - 80).toFixed(1)}% utilization reduction`
        });
      }
    });
  }
  
  // Identify setup time optimizations
  const setupOptimizations = analytics
    .filter(machine => machine.orders.length > 1)
    .map(machine => ({
      machineId: machine.machineId,
      machineName: machine.machineName,
      totalSetupTime: machine.orders.length * machine.orders[0].setupTime,
      suggestion: `Consider batching similar orders to reduce setup time from ${machine.orders.length * machine.orders[0].setupTime} to ${Math.ceil(machine.orders.length / 2) * machine.orders[0].setupTime} minutes`
    }));
  
  return {
    bottlenecks,
    underutilized,
    loadBalancingSuggestions: suggestions,
    setupOptimizations,
    timeline,
    summary: {
      totalMachines: machines.length,
      averageUtilization: analytics.reduce((sum, m) => sum + m.utilizationPercentage, 0) / analytics.length,
      bottleneckCount: bottlenecks.length,
      underutilizedCount: underutilized.length,
      optimizationPotential: suggestions.length > 0 ? 'High' : underutilized.length > 0 ? 'Medium' : 'Low'
    }
  };
}

// Advanced load balancing and machine selection
export function optimizeMachineScheduling(machines: MachineSpec[], orders: any[]): { optimizedSchedule: any[], loadBalanceScore: number } {
  // Create a copy of machines to avoid mutation
  const machinesCopy = machines.map(m => ({ ...m, scheduledBags: 0, scheduledHours: 0, remainingDailyCapacity: m.capacity }));
  
  // Sort orders by priority (delivery time, quantity, complexity)
  const prioritizedOrders = orders.map((order, index) => ({
    ...order,
    priority: calculateOrderPriority(order, index),
    originalIndex: index
  })).sort((a, b) => b.priority - a.priority);
  
  const optimizedSchedule = [];
  
  for (const order of prioritizedOrders) {
    const bestMachine = selectOptimalMachine(machinesCopy, order);
    
    if (bestMachine) {
      // Calculate scheduling details
      const setupHours = bestMachine.setupTimeMinutes / 60;
      const baseProductionHours = (order.actualBags || order.orderQty) / bestMachine.hourlyCapacity;
      const adjustedProductionHours = baseProductionHours / bestMachine.efficiency;
      const totalHours = setupHours + adjustedProductionHours;
      
      // Update machine metrics
      bestMachine.scheduledBags += (order.actualBags || order.orderQty);
      bestMachine.scheduledHours += totalHours;
      bestMachine.remainingDailyCapacity = Math.max(0, bestMachine.capacity - bestMachine.scheduledBags);
      
      // Add to schedule
      optimizedSchedule.push({
        orderId: `ORDER_${order.originalIndex + 1}`,
        machineId: bestMachine.id,
        bagQuantity: (order.actualBags || order.orderQty),
        startTime: new Date(bestMachine.nextAvailableTime),
        endTime: new Date(bestMachine.nextAvailableTime.getTime() + totalHours * 60 * 60 * 1000),
        setupTimeMinutes: bestMachine.setupTimeMinutes,
        productionHours: adjustedProductionHours,
        totalHours,
        priority: order.priority
      });
      
      bestMachine.nextAvailableTime = new Date(bestMachine.nextAvailableTime.getTime() + totalHours * 60 * 60 * 1000);
    }
  }
  
  // Calculate load balance score (0-100, where 100 is perfectly balanced)
  const utilizationRates = machinesCopy.map(m => m.scheduledHours / m.workingHoursPerDay);
  const avgUtilization = utilizationRates.reduce((sum, rate) => sum + rate, 0) / utilizationRates.length;
  const variance = utilizationRates.reduce((sum, rate) => sum + Math.pow(rate - avgUtilization, 2), 0) / utilizationRates.length;
  const loadBalanceScore = Math.max(0, 100 - (variance * 1000)); // Scale variance to 0-100
  
  return { optimizedSchedule, loadBalanceScore };
}

function calculateOrderPriority(order: any, index: number): number {
  let priority = 0;
  
  // Delivery urgency (higher priority for shorter delivery times)
  const deliveryDays = order.deliveryDays || 14;
  priority += Math.max(0, (21 - deliveryDays) * 5); // Max 100 points
  
  // Order size (higher priority for larger orders to reduce setup overhead)
  const bagQuantity = order.actualBags || order.orderQty;
  priority += Math.min(50, bagQuantity / 1000); // Max 50 points
  
  // Handle complexity (twisted handles get higher priority for specialized machines)
  if (order.handleType === 'TWISTED HANDLE') {
    priority += 20;
  }
  
  // Order sequence bonus (earlier orders get slight priority)
  priority += Math.max(0, (100 - index) * 0.1); // Max 10 points
  
  return priority;
}

function selectOptimalMachine(machines: MachineSpec[], order: any): MachineSpec | null {
  const bagQuantity = order.actualBags || order.orderQty;
  const specs = {
    width: order.width || 320,
    height: order.height || 380,
    gusset: order.gusset || 160,
    gsm: order.gsm || 90,
    handleType: order.handleType || 'FLAT HANDLE'
  };
  
  // Filter compatible machines
  const compatibleMachines = machines.filter(machine => 
    machine.available &&
    specs.width <= machine.maxWidth &&
    specs.height <= 600 && // Default max height
    specs.gusset <= 200 && // Default max gusset
    specs.gsm >= machine.minGsm &&
    specs.gsm <= machine.maxGsm &&
    machine.supportedHandles.includes(specs.handleType) &&
    machine.remainingDailyCapacity >= bagQuantity
  );
  
  if (compatibleMachines.length === 0) {
    return null;
  }
  
  // Score machines based on multiple factors
  const machineScores = compatibleMachines.map(machine => {
    let score = 0;
    
    // Utilization balance (prefer machines with lower current utilization)
    const currentUtilization = machine.scheduledHours / machine.workingHoursPerDay;
    score += (1 - currentUtilization) * 40; // Max 40 points
    
    // Capacity efficiency (prefer machines where this order uses 60-80% of remaining capacity)
    const capacityUsage = bagQuantity / machine.remainingDailyCapacity;
    if (capacityUsage >= 0.6 && capacityUsage <= 0.8) {
      score += 30; // Optimal capacity usage
    } else if (capacityUsage >= 0.4 && capacityUsage < 0.6) {
      score += 20; // Good capacity usage
    } else if (capacityUsage < 0.4) {
      score += 10; // Underutilization
    }
    
    // Machine efficiency bonus
    score += machine.efficiency * 15; // Max 15 points (assuming max efficiency is 1.0)
    
    // Handle type specialization
    if (specs.handleType === 'TWISTED HANDLE' && machine.id === 'M6') {
      score += 10; // M6 specializes in twisted handles
    } else if (specs.handleType === 'FLAT HANDLE' && ['M1', 'M2', 'M3', 'M4', 'M5'].includes(machine.id)) {
      score += 5; // Other machines are good for flat handles
    }
    
    // Setup time penalty (prefer machines with lower setup time)
    score -= (machine.setupTimeMinutes / 60) * 2; // Small penalty for longer setup
    
    return { machine, score };
  });
  
  // Select the highest scoring machine
  machineScores.sort((a, b) => b.score - a.score);
  return machineScores[0].machine;
}

export default MACHINES_DATA;