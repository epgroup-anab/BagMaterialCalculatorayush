import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { SKU_DATA } from '../data/skuData';

interface MachineScheduleData {
  date: string;
  shift: string;
  machines: {
    [key: string]: string;
  };
}

interface DaySchedule {
  [shift: string]: {
    [machine: string]: string;
  };
}

const MachineCalendar: React.FC = () => {
  const [scheduleData, setScheduleData] = useState<MachineScheduleData[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const expandedSectionRef = useRef<HTMLDivElement>(null);

  const machines = ['MC GM-1', 'MC GM-2', 'MC GM-3', 'MC GM-4', 'MC GM-5', 'MC GM-6', 'MC NL-1', 'MC NL-2'];

  // Handle date selection with auto-scroll
  const handleDateSelection = (date: Date, isSelected: boolean) => {
    const newSelectedDate = isSelected ? null : date;
    setSelectedDate(newSelectedDate);
    
    // If a date is being selected (not deselected), scroll to expanded section
    if (newSelectedDate && expandedSectionRef.current) {
      // Small delay to ensure the expanded section is rendered
      setTimeout(() => {
        expandedSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }, 100);
    }
  };


  // Parse date string from CSV format "01, Saturday, Feb 2025" to proper date
  const parseCsvDate = (dateStr: string): Date | null => {
    try {
      const cleanDateStr = dateStr.replace(/"/g, '').trim();
      const parts = cleanDateStr.split(', ');
      
      if (parts.length !== 3) return null;
      
      const day = parseInt(parts[0]);
      const monthYearStr = parts[2];
      
      const [monthName, yearStr] = monthYearStr.split(' ');
      const year = parseInt(yearStr);
      
      const monthMap: { [key: string]: number } = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      
      const month = monthMap[monthName];
      if (month === undefined) return null;
      
      return new Date(year, month, day);
    } catch (error) {
      console.error('Error parsing date:', dateStr, error);
      return null;
    }
  };

  // Get bag name from SAP code
  const getBagName = (sapCode: string): string => {
    if (sapCode === 'NO PLANNING' || sapCode === 'NO JOBS' || sapCode === 'SIZE CHANGEOVER') {
      return sapCode;
    }
    
    const sku = SKU_DATA.find(item => item.sku === sapCode);
    return sku ? sku.name : sapCode;
  };

  // Fetch schedule data from API
  useEffect(() => {
    const fetchScheduleData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/schedule-csv');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch schedule data: ${response.status}`);
        }
        
        const apiData = await response.json();
        
        if (!apiData.success || !apiData.data) {
          throw new Error('Invalid API response format');
        }
        
        // Transform API data to component format
        const parsed: MachineScheduleData[] = [];
        
        Object.entries(apiData.data).forEach(([dateKey, dayData]: [string, any]) => {
          Object.entries(dayData.shifts).forEach(([shift, machines]: [string, any]) => {
            const machineAssignments: { [key: string]: string } = {};
            
            Object.entries(machines).forEach(([machineId, machineData]: [string, any]) => {
              // Convert machine IDs back to CSV format for compatibility
              const csvMachineKey = `MC ${machineId}`;
              machineAssignments[csvMachineKey] = (machineData as any).productCode || 'NO PLANNING';
            });
            
            parsed.push({
              date: dayData.dateString, // Use the formatted date string from API
              shift,
              machines: machineAssignments
            });
          });
        });
        
        console.log('Parsed schedule data from API:', parsed.slice(0, 5)); // Debug log
        setScheduleData(parsed);
      } catch (error) {
        console.error('Error fetching schedule data:', error);
        // Show user-friendly error message
        alert('Unable to load schedule data. Please try refreshing the page or contact support.');
      } finally {
        setLoading(false);
      }
    };

    fetchScheduleData();
  }, []);

  // Get calendar days for current month
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const currentCalendarDate = new Date(startDate);
    
    while (currentCalendarDate <= lastDay || currentCalendarDate.getDay() !== 0 || days.length < 42) {
      days.push(new Date(currentCalendarDate));
      currentCalendarDate.setDate(currentCalendarDate.getDate() + 1);
      
      if (days.length >= 42) break;
    }
    
    return days;
  };

  // Get schedule data for a specific date
  const getScheduleForDate = (date: Date): DaySchedule => {
    const daySchedule: DaySchedule = {};
    
    const relevantSchedules = scheduleData.filter(item => {
      // Try parsing the date string - it might be already formatted from API
      let scheduleDate: Date | null = null;
      
      if (item.date.includes(',')) {
        // CSV format: "03, Monday, Feb 2025"
        scheduleDate = parseCsvDate(item.date);
      } else {
        // Already formatted date string from API
        scheduleDate = new Date(item.date);
      }
      
      return scheduleDate && scheduleDate.toDateString() === date.toDateString();
    });
    
    relevantSchedules.forEach(schedule => {
      daySchedule[schedule.shift] = schedule.machines;
    });
    
    return daySchedule;
  };

  // Get unique active products for a date (excluding NO PLANNING, NO JOBS)
  const getActiveProductsForDate = (date: Date): string[] => {
    const daySchedule = getScheduleForDate(date);
    const products = new Set<string>();
    
    Object.values(daySchedule).forEach(shiftSchedule => {
      Object.values(shiftSchedule).forEach(assignment => {
        if (assignment !== 'NO PLANNING' && assignment !== 'NO JOBS' && assignment !== 'SIZE CHANGEOVER') {
          products.add(assignment);
        }
      });
    });
    
    return Array.from(products);
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const navigateMonth = (direction: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const calendarDays = getCalendarDays();
  const currentMonth = currentDate.getMonth();

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Machine Planning Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-64">
            <div className="text-lg">Loading schedule data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Machine Planning Calendar
          </CardTitle>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <Button variant="outline" size="sm" onClick={() => navigateMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Total entries: {scheduleData.length}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
              <div key={day} className="p-2 text-center font-medium text-sm text-muted-foreground border-b">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, index) => {
              const isCurrentMonth = date.getMonth() === currentMonth;
              const daySchedule = getScheduleForDate(date);
              const hasSchedule = Object.keys(daySchedule).length > 0;
              const activeProducts = getActiveProductsForDate(date);
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              
              return (
                <div
                  key={index}
                  className={`min-h-[120px] border rounded-lg p-2 cursor-pointer transition-all duration-200 ${
                    !isCurrentMonth ? 'bg-gray-50 text-muted-foreground opacity-60' : 'bg-white'
                  } ${hasSchedule ? 'border-blue-300' : 'border-gray-200'} ${
                    isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:shadow-md hover:border-blue-400'
                  }`}
                  onClick={() => handleDateSelection(date, isSelected)}
                >
                  {/* Date number */}
                  <div className="font-semibold text-sm mb-2 text-gray-700">{date.getDate()}</div>
                  
                  {/* Compact schedule preview */}
                  <div className="space-y-1">
                    {hasSchedule ? (
                      <>
                        {/* Show active products count and first few */}
                        {activeProducts.length > 0 ? (
                          <>
                            <div className="text-xs font-medium text-blue-700">
                              {activeProducts.length} product{activeProducts.length > 1 ? 's' : ''}
                            </div>
                            {activeProducts.slice(0, 2).map((product, idx) => {
                              const bagName = getBagName(product);
                              const truncatedName = bagName.length > 20 ? bagName.substring(0, 20) + '...' : bagName;
                              return (
                                <div 
                                  key={idx}
                                  className="text-xs bg-blue-50 text-blue-800 px-1 py-0.5 rounded"
                                  title={`${product}: ${bagName}`}
                                >
                                  <div className="font-mono text-xs">{product}</div>
                                  <div className="text-xs truncate leading-tight">{truncatedName}</div>
                                </div>
                              );
                            })}
                            {activeProducts.length > 2 && (
                              <div className="text-xs text-blue-600 font-medium">
                                +{activeProducts.length - 2} more
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-xs text-gray-500 bg-gray-100 px-1 py-0.5 rounded">
                            No Planning
                          </div>
                        )}
                        
                        {/* Show shift indicators */}
                        <div className="flex gap-1 mt-2">
                          {Object.keys(daySchedule).map(shift => (
                            <div 
                              key={shift}
                              className={`w-2 h-2 rounded-full ${
                                shift === 'SHIFT-1' ? 'bg-blue-400' :
                                shift === 'SHIFT-2' ? 'bg-green-400' :
                                'bg-orange-400'
                              }`}
                              title={shift}
                            ></div>
                          ))}
                        </div>
                      </>
                    ) : (
                      isCurrentMonth && (
                        <div className="text-gray-400 text-xs">No data</div>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Expanded view for selected date */}
          {selectedDate && (
            <div ref={expandedSectionRef} className="mt-6 border-t pt-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 text-blue-800">
                  {selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </h3>
                
                {(() => {
                  const daySchedule = getScheduleForDate(selectedDate);
                  
                  if (Object.keys(daySchedule).length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-lg mb-2">📅</div>
                        <p>No schedule data available for this date</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {Object.entries(daySchedule).map(([shift, machineAssignments]) => (
                        <div key={shift} className="bg-white rounded-lg border p-4">
                          {/* Shift header */}
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold mb-3 ${
                            shift === 'SHIFT-1' ? 'bg-blue-100 text-blue-700' :
                            shift === 'SHIFT-2' ? 'bg-green-100 text-green-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {shift}
                          </div>
                          
                          {/* Machine assignments grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {Object.entries(machineAssignments)
                              .filter(([machine, sapCode]) => sapCode && sapCode.trim() !== '')
                              .map(([machine, sapCode]) => {
                              if (sapCode === 'NO PLANNING') {
                                return (
                                  <div key={machine} className="bg-gray-100 border rounded-lg p-3">
                                    <div className="font-mono text-sm font-semibold text-gray-700 mb-1">
                                      {machine.replace('MC ', '')}
                                    </div>
                                    <div className="text-gray-500 text-sm">No Planning</div>
                                  </div>
                                );
                              } else if (sapCode === 'NO JOBS') {
                                return (
                                  <div key={machine} className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <div className="font-mono text-sm font-semibold text-red-700 mb-1">
                                      {machine.replace('MC ', '')}
                                    </div>
                                    <div className="text-red-600 text-sm">No Jobs</div>
                                  </div>
                                );
                              } else if (sapCode === 'SIZE CHANGEOVER') {
                                return (
                                  <div key={machine} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                    <div className="font-mono text-sm font-semibold text-yellow-700 mb-1">
                                      {machine.replace('MC ', '')}
                                    </div>
                                    <div className="text-yellow-600 text-sm">Size Changeover</div>
                                  </div>
                                );
                              } else {
                                const bagName = getBagName(sapCode);
                                return (
                                  <div 
                                    key={machine} 
                                    className={`border rounded-lg p-3 ${
                                      shift === 'SHIFT-1' ? 'bg-blue-50 border-blue-200' :
                                      shift === 'SHIFT-2' ? 'bg-green-50 border-green-200' :
                                      'bg-orange-50 border-orange-200'
                                    }`}
                                  >
                                    <div className={`font-mono text-sm font-semibold mb-1 ${
                                      shift === 'SHIFT-1' ? 'text-blue-800' :
                                      shift === 'SHIFT-2' ? 'text-green-800' :
                                      'text-orange-800'
                                    }`}>
                                      {machine.replace('MC ', '')}
                                    </div>
                                    <div className="font-mono text-sm font-bold text-gray-800 mb-1">
                                      {sapCode}
                                    </div>
                                    <div className={`text-sm leading-tight ${
                                      shift === 'SHIFT-1' ? 'text-blue-700' :
                                      shift === 'SHIFT-2' ? 'text-green-700' :
                                      'text-orange-700'
                                    }`}>
                                      {bagName}
                                    </div>
                                  </div>
                                );
                              }
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MachineCalendar;