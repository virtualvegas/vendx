/**
 * Route Optimization Utility
 * Implements nearest neighbor algorithm for optimizing stop order
 * based on geographic distance between locations
 */

interface LocationCoords {
  id: string;
  latitude: number | null;
  longitude: number | null;
}

interface StopWithLocation {
  id: string;
  stop_order: number;
  inventory_priority_score?: number | null;
  low_inventory_flagged?: boolean | null;
  location?: {
    id: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

/**
 * Calculate Haversine distance between two points in kilometers
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate distance matrix between all stops
 */
function buildDistanceMatrix(stops: StopWithLocation[]): number[][] {
  const n = stops.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(Infinity));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 0;
        continue;
      }

      const loc1 = stops[i].location;
      const loc2 = stops[j].location;

      if (loc1?.latitude && loc1?.longitude && loc2?.latitude && loc2?.longitude) {
        matrix[i][j] = haversineDistance(
          loc1.latitude,
          loc1.longitude,
          loc2.latitude,
          loc2.longitude
        );
      } else {
        // If no coordinates, use a default large distance
        matrix[i][j] = 1000;
      }
    }
  }

  return matrix;
}

/**
 * Nearest Neighbor Algorithm for route optimization
 * Starts from the first stop and always visits the nearest unvisited stop
 */
function nearestNeighborTSP(distanceMatrix: number[][], startIndex: number = 0): number[] {
  const n = distanceMatrix.length;
  if (n === 0) return [];
  if (n === 1) return [0];

  const visited = new Set<number>();
  const order: number[] = [];
  let current = startIndex;

  while (order.length < n) {
    order.push(current);
    visited.add(current);

    let nearestDist = Infinity;
    let nearestIdx = -1;

    for (let i = 0; i < n; i++) {
      if (!visited.has(i) && distanceMatrix[current][i] < nearestDist) {
        nearestDist = distanceMatrix[current][i];
        nearestIdx = i;
      }
    }

    if (nearestIdx !== -1) {
      current = nearestIdx;
    }
  }

  return order;
}

/**
 * Calculate total route distance
 */
export function calculateTotalDistance(stops: StopWithLocation[]): number {
  if (stops.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const loc1 = stops[i].location;
    const loc2 = stops[i + 1].location;

    if (loc1?.latitude && loc1?.longitude && loc2?.latitude && loc2?.longitude) {
      total += haversineDistance(
        loc1.latitude,
        loc1.longitude,
        loc2.latitude,
        loc2.longitude
      );
    }
  }

  return Math.round(total * 10) / 10; // Round to 1 decimal
}

/**
 * Optimize route order based on shortest travel distance
 * Returns the optimized order of stop IDs with their new order numbers
 */
export function optimizeRouteOrder(
  stops: StopWithLocation[]
): { id: string; newOrder: number }[] {
  if (stops.length < 2) {
    return stops.map((s, idx) => ({ id: s.id, newOrder: idx }));
  }

  // Separate low-inventory / high-priority stops to be bubbled to the top
  const priorityStops = stops.filter(
    (s) => s.low_inventory_flagged || (s.inventory_priority_score || 0) >= 60
  );
  const normalStops = stops.filter(
    (s) => !(s.low_inventory_flagged || (s.inventory_priority_score || 0) >= 60)
  );

  // Sort priority group by score descending (most critical first)
  priorityStops.sort(
    (a, b) => (b.inventory_priority_score || 0) - (a.inventory_priority_score || 0)
  );

  // Optimize the normal group geographically (nearest neighbor)
  let optimizedNormal: StopWithLocation[] = [];
  if (normalStops.length >= 2) {
    const matrix = buildDistanceMatrix(normalStops);
    const order = nearestNeighborTSP(matrix);
    optimizedNormal = order.map((idx) => normalStops[idx]);
  } else {
    optimizedNormal = normalStops;
  }

  // Combine: priority stops first, then geographically optimized normal stops
  const finalOrder = [...priorityStops, ...optimizedNormal];

  return finalOrder.map((stop, newIdx) => ({
    id: stop.id,
    newOrder: newIdx,
  }));
}

/**
 * Calculate estimated travel time in minutes
 * Assumes average speed of 30 km/h for urban driving
 */
export function estimateTravelTime(distanceKm: number): number {
  const avgSpeedKmh = 30;
  return Math.round((distanceKm / avgSpeedKmh) * 60);
}

/**
 * Get next service date based on frequency
 */
export function getNextServiceDate(
  lastServiceDate: Date | null,
  frequencyDays: number
): Date {
  const baseDate = lastServiceDate || new Date();
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + frequencyDays);

  // Skip weekends
  const dayOfWeek = nextDate.getDay();
  if (dayOfWeek === 0) nextDate.setDate(nextDate.getDate() + 1);
  if (dayOfWeek === 6) nextDate.setDate(nextDate.getDate() + 2);

  return nextDate;
}

/**
 * Check if zone is due for service
 */
export function isZoneDueForService(
  lastServiceDate: Date | null,
  frequencyDays: number
): boolean {
  if (!lastServiceDate) return true;
  
  const now = new Date();
  const diffMs = now.getTime() - new Date(lastServiceDate).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  return diffDays >= frequencyDays;
}
