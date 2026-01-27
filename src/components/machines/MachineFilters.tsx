import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter } from "lucide-react";
import { MACHINE_TYPES, MACHINE_STATUSES, MachineLocation } from "@/lib/machineUtils";

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
  // Use available types if provided, otherwise use all machine types
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
      
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-full sm:w-[150px]">
          <Filter className="w-4 h-4 mr-2 shrink-0" />
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          {MACHINE_STATUSES.map(status => (
            <SelectItem key={status.value} value={status.value}>
              {status.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showTypeFilter && onTypeChange && (
        <Select value={typeFilter} onValueChange={onTypeChange}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {displayTypes.map(type => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showLocationFilter && onLocationChange && (
        <Select value={locationFilter} onValueChange={onLocationChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map(loc => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name || `${loc.city}, ${loc.country}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};
