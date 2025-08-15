import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Calculator, Package } from "lucide-react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import InventoryCalculator from "@/pages/InventoryCalculator";

function Navigation() {
  const [location] = useLocation();
  
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 items-center">
        <div className="flex items-center space-x-4 lg:space-x-6">
          <div className="flex items-center space-x-2">
            <Calculator className="h-6 w-6 text-blue-600" />
            <h1 className="text-lg font-semibold text-slate-800">Bag Calculator</h1>
          </div>
          <div className="hidden md:flex items-center space-x-1">
            <Link href="/">
              <Button 
                variant={location === "/" ? "default" : "ghost"} 
                size="sm"
                className="h-9 hover:bg-blue-50 hover:text-blue-700"
              >
                Material Calculator
              </Button>
            </Link>
            <Link href="/inventory">
              <Button 
                variant={location === "/inventory" ? "default" : "ghost"}
                size="sm"
                className="h-9 hover:bg-blue-50 hover:text-blue-700"
              >
                <Package className="h-4 w-4 mr-2" />
                Inventory
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function Router() {
  return (
    <>
      <Navigation />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/inventory" component={InventoryCalculator} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
