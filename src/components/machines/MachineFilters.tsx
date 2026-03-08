import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { MACHINE_TYPES, MACHINE_STATUSES, MachineLocation } from "@/lib/machineUtils";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface MachineFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  typeFilter?: string;
  onTypeChange?: (value: string) => void;
  locationFilter?: string;
  onLocationChange?: (value: string) => void;
  locations?: MachineLocation[];
  availableTypes?: string[];
  showTypeFilter?: boolean;
  showLocationFilter?: boolean;
  className?: string;
}

export const MachineFilters = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  typeFilter = "all",
  onTypeChange,
  locationFilter = "all",
  onLocationChange,
  locations = [],
  availableTypes,
  showTypeFilter = true,
  showLocationFilter = false,
  className,
}: MachineFiltersProps) => {
  const displayTypes = availableTypes 
    ? MACHINE_TYPES.filter(t => availableTypes.includes(t.value))
    : MACHINE_TYPES;

  return (
    <div className={`flex flex-col sm:flex-row gap-4 ${className}`}>
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or code..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <div className="w-full sm:w-[150px]">
        <SearchableSelect
          options={[
            { value: "all", label: "All Status" },
            ...MACHINE_STATUSES.map(s => ({ value: s.value, label: s.label })),
          ]}
          value={statusFilter}
          onValueChange={onStatusChange}
          placeholder="Status"
          searchPlaceholder="Search status..."
        />
      </div>

      {showTypeFilter && onTypeChange && (
        <div className="w-full sm:w-[150px]">
          <SearchableSelect
            options={[
              { value: "all", label: "All Types" },
              ...displayTypes.map(t => ({ value: t.value, label: t.label })),
            ]}
            value={typeFilter}
            onValueChange={onTypeChange}
            placeholder="Type"
            searchPlaceholder="Search type..."
          />
        </div>
      )}

      {showLocationFilter && onLocationChange && (
        <div className="w-full sm:w-[200px]">
          <SearchableSelect
            options={[
              { value: "all", label: "All Locations" },
              ...locations.map(loc => ({
                value: loc.id,
                label: loc.name || `${loc.city}, ${loc.country}`,
              })),
            ]}
            value={locationFilter}
            onValueChange={onLocationChange}
            placeholder="Location"
            searchPlaceholder="Search locations..."
          />
        </div>
      )}
    </div>
  );
};
