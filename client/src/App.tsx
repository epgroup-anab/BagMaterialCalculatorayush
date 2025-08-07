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
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-primary">Smart Bag Calculator</h1>
            </div>
            <div className="flex space-x-4">
              <Link href="/">
                <Button 
                  variant={location === "/" ? "default" : "ghost"} 
                  className="flex items-center gap-2"
                >
                  <Calculator className="h-4 w-4" />
                  Material Calculator
                </Button>
              </Link>
              <Link href="/inventory">
                <Button 
                  variant={location === "/inventory" ? "default" : "ghost"}
                  className="flex items-center gap-2"
                >
                  <Package className="h-4 w-4" />
                  Inventory Calculator
                </Button>
              </Link>
            </div>
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
