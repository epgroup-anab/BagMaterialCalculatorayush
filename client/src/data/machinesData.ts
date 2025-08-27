export interface MachineData {
  name: string;
  category: string;
  description: string;
  handleType: string;
  maxWidth: number;
  maxGusset: number;
  maxHeight: number;
  minWidth: number;
  minGusset: number;
  minHeight: number;
  maxGSM: number;
  minGSM: number;
  handlesPerKg: number;
  efficiency: number;
  bagsPerHour: number;
  setupTime: number;
  operatorCost: number;
  energyCost: number;
  maintenance: number;
  status: string;
  utilization?: number;
  currentUtilization?: number;
}

export type MachinesData = Record<string, MachineData>;

export const MACHINES_DATA: MachinesData = {
  'M1': {
    name: 'M1',
    category: 'GM 5QT FH',
    description: 'Garant Triumph 5QT',
    handleType: 'FLAT HANDLE',
    maxWidth: 500,
    maxGusset: 180,
    maxHeight: 500,
    minWidth: 180,
    minGusset: 80,
    minHeight: 200,
    maxGSM: 120,
    minGSM: 70,
    handlesPerKg: 285,
    efficiency: 0.85,
    bagsPerHour: 4500,
    setupTime: 30,
    operatorCost: 15,
    energyCost: 8.5,
    maintenance: 2.1,
    status: 'available'
  },
  'M2': {
    name: 'M2',
    category: 'GM 5QT FH',
    description: 'Garant Triumph 5QT',
    handleType: 'FLAT HANDLE',
    maxWidth: 500,
    maxGusset: 180,
    maxHeight: 500,
    minWidth: 180,
    minGusset: 80,
    minHeight: 200,
    maxGSM: 120,
    minGSM: 70,
    handlesPerKg: 285,
    efficiency: 0.85,
    bagsPerHour: 4500,
    setupTime: 30,
    operatorCost: 15,
    energyCost: 8.5,
    maintenance: 2.1,
    status: 'available'
  },
  'M3': {
    name: 'M3',
    category: 'GM 5QT TH',
    description: 'Garant Triumph 5QT',
    handleType: 'TWISTED HANDLE',
    maxWidth: 480,
    maxGusset: 170,
    maxHeight: 480,
    minWidth: 160,
    minGusset: 70,
    minHeight: 180,
    maxGSM: 110,
    minGSM: 75,
    handlesPerKg: 80,
    efficiency: 0.82,
    bagsPerHour: 3800,
    setupTime: 45,
    operatorCost: 18,
    energyCost: 9.2,
    maintenance: 2.5,
    status: 'available'
  },
  'M4': {
    name: 'M4',
    category: 'GM 5QT TH',
    description: 'Garant Triumph 5QT',
    handleType: 'TWISTED HANDLE',
    maxWidth: 480,
    maxGusset: 170,
    maxHeight: 480,
    minWidth: 160,
    minGusset: 70,
    minHeight: 180,
    maxGSM: 110,
    minGSM: 75,
    handlesPerKg: 80,
    efficiency: 0.82,
    bagsPerHour: 3800,
    setupTime: 45,
    operatorCost: 18,
    energyCost: 9.2,
    maintenance: 2.5,
    status: 'available'
  }
};