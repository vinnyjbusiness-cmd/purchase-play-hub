import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, Compass } from "lucide-react";

interface TourStep {
  title: string;
  description: string;
  route: string;
  highlight?: string; // CSS selector to highlight
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to VJX!",
    description: "This guided tour will walk you through the key features of the platform. Let's get started!",
    route: "/",
  },
  {
    title: "Adding a Purchase",
    description: "The Purchases page is where you track all supplier ticket buys. Click 'Add Purchase' to create a new entry with supplier, event, quantity, and cost details. Purchases automatically generate inventory items.",
    route: "/purchases",
  },
  {
    title: "Managing Orders",
    description: "Orders track your customer sales. You can update order status, delivery status, and link inventory tickets to each order. Click any order row to open its details and see the profit/loss breakdown.",
    route: "/orders",
  },
  {
    title: "Inventory Management",
    description: "The Inventory page shows all your stock items. Each ticket can be filtered by event, supplier, or status. Items are assignable to orders and can be edited or deleted individually.",
    route: "/inventory",
  },
  {
    title: "Balance Page",
    description: "The Balance page shows what you owe suppliers and what platforms owe you. Click any card to see detailed transaction history and activity heatmaps. You can also upload custom logos for suppliers.",
    route: "/balance",
  },
  {
    title: "To-Do List",
    description: "The To-Do List keeps your team organized. Create tasks with priorities (Low to Urgent), assign them to team members, and mark them complete. Tasks can be grouped by priority or status.",
    route: "/todos",
  },
  {
    title: "Event Timeline",
    description: "The Event Timeline shows all upcoming events chronologically. You can see at a glance what's coming up, how many orders are associated, and the fulfilment progress for each event.",
    route: "/timeline",
  },
  {
    title: "Tour Complete! 🎉",
    description: "You've seen the key features of VJX. You can re-launch this tour anytime from the Team page. Explore the platform and reach out if you need help!",
    route: "/team",
  },
];

interface Props {
  onEnd: () => void;
}

export default function GuidedTour({ onEnd }: Props) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const current = TOUR_STEPS[step];

  useEffect(() => {
    if (current.route && location.pathname !== current.route) {
      navigate(current.route);
    }
  }, [step, current.route, navigate, location.pathname]);

  const next = () => {
    if (step < TOUR_STEPS.length - 1) setStep(step + 1);
    else onEnd();
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm pointer-events-auto" onClick={onEnd} />

      {/* Tour Card */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg pointer-events-auto">
        <div className="rounded-xl border bg-card shadow-2xl p-6 mx-4">
          {/* Progress */}
          <div className="flex items-center gap-1 mb-4">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary flex-shrink-0" />
              <h3 className="font-bold text-lg">{current.title}</h3>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={onEnd}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mb-5">
            {current.description}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Step {step + 1} of {TOUR_STEPS.length}
            </span>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" onClick={prev}>
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
                </Button>
              )}
              <Button size="sm" onClick={next}>
                {step < TOUR_STEPS.length - 1 ? (
                  <>Next <ChevronRight className="h-3.5 w-3.5 ml-1" /></>
                ) : (
                  "Finish Tour"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
