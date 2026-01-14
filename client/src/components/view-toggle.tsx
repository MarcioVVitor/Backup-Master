import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Table2 } from "lucide-react";

export type ViewMode = "cards" | "table" | "list";

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showTable?: boolean;
}

export function ViewToggle({ viewMode, onViewModeChange, showTable = true }: ViewToggleProps) {
  console.log("[ViewToggle] Rendering - viewMode:", viewMode);
  return (
    <div className="flex items-center border rounded-lg p-1 bg-muted/30" data-testid="view-toggle-container">
      <Button
        variant={viewMode === "cards" ? "secondary" : "ghost"}
        size="sm"
        className="h-8 px-3"
        onClick={() => onViewModeChange("cards")}
        data-testid="view-cards"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      {showTable && (
        <Button
          variant={viewMode === "table" ? "secondary" : "ghost"}
          size="sm"
          className="h-8 px-3"
          onClick={() => onViewModeChange("table")}
          data-testid="view-table"
        >
          <Table2 className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant={viewMode === "list" ? "secondary" : "ghost"}
        size="sm"
        className="h-8 px-3"
        onClick={() => onViewModeChange("list")}
        data-testid="view-list"
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}
