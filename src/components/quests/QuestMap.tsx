import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { QuestNode } from "@/pages/QuestsPage";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

// Use the Mapbox public token (this is a publishable key, safe for client-side)
mapboxgl.accessToken = "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";

interface QuestMapProps {
  nodes: QuestNode[];
  userLocation: { lat: number; lng: number } | null;
  onNodeSelect: (node: QuestNode) => void;
  discoveredNodes: string[];
  isLoading: boolean;
}

const rarityColors: Record<string, string> = {
  common: "#6b7280",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

const rarityGlow: Record<string, string> = {
  common: "0 0 10px rgba(107, 114, 128, 0.5)",
  rare: "0 0 15px rgba(59, 130, 246, 0.6)",
  epic: "0 0 20px rgba(168, 85, 247, 0.7)",
  legendary: "0 0 25px rgba(245, 158, 11, 0.8)",
};

const QuestMap = ({ nodes, userLocation, onNodeSelect, discoveredNodes, isLoading }: QuestMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: userLocation ? [userLocation.lng, userLocation.lat] : [-71.0589, 42.3601],
      zoom: 13,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update user location marker
  useEffect(() => {
    if (!map.current || !mapLoaded || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    } else {
      const el = document.createElement("div");
      el.className = "user-marker";
      el.innerHTML = `
        <div class="relative">
          <div class="w-6 h-6 bg-primary rounded-full border-2 border-white flex items-center justify-center animate-pulse">
            <div class="w-2 h-2 bg-white rounded-full"></div>
          </div>
          <div class="absolute inset-0 w-6 h-6 bg-primary/30 rounded-full animate-ping"></div>
        </div>
      `;

      userMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map.current);
    }
  }, [userLocation, mapLoaded]);

  // Update node markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    nodes.forEach((node) => {
      const lat = node.latitude || node.location?.latitude;
      const lng = node.longitude || node.location?.longitude;

      if (!lat || !lng) return;

      const isDiscovered = discoveredNodes.includes(node.id);
      const color = node.color || rarityColors[node.rarity] || "#00d4ff";
      const glow = rarityGlow[node.rarity] || "0 0 10px rgba(0, 212, 255, 0.5)";

      const el = document.createElement("div");
      el.className = "quest-node-marker cursor-pointer transition-transform hover:scale-110";
      el.style.cssText = `
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, ${color}, ${color}99);
        border: 3px solid ${isDiscovered ? "#10b981" : "#ffffff"};
        border-radius: 50%;
        box-shadow: ${glow};
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      `;

      // Add node type icon
      const iconMap: Record<string, string> = {
        vending: "☕",
        arcade: "🎮",
        claw: "🎯",
        partner: "🤝",
        event: "🎉",
        virtual: "🌐",
      };

      el.innerHTML = `
        <span style="font-size: 18px;">${iconMap[node.node_type] || "📍"}</span>
        ${node.rarity === "legendary" ? `
          <div style="
            position: absolute;
            top: -5px;
            right: -5px;
            width: 16px;
            height: 16px;
            background: linear-gradient(135deg, #f59e0b, #f97316);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
          ">⭐</div>
        ` : ""}
        ${node.rarity === "epic" ? `
          <div style="
            position: absolute;
            top: -5px;
            right: -5px;
            width: 16px;
            height: 16px;
            background: linear-gradient(135deg, #a855f7, #7c3aed);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
          ">💎</div>
        ` : ""}
      `;

      el.addEventListener("click", () => onNodeSelect(node));

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([Number(lng), Number(lat)])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [nodes, discoveredNodes, mapLoaded, onNodeSelect]);

  const centerOnUser = () => {
    if (map.current && userLocation) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 15,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full min-h-[calc(100vh-8rem)] bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 animate-pulse mx-auto mb-4 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading quest map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-8rem)]">
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Map Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
        <Button
          onClick={centerOnUser}
          size="icon"
          className="w-12 h-12 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-lg hover:bg-card"
          disabled={!userLocation}
        >
          <Compass className="w-6 h-6 text-primary" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 bg-card/90 backdrop-blur-sm rounded-xl p-4 border border-border shadow-lg z-10">
        <p className="text-xs font-semibold text-foreground mb-2">Node Rarity</p>
        <div className="space-y-1">
          {Object.entries(rarityColors).map(([rarity, color]) => (
            <div key={rarity} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-muted-foreground capitalize">{rarity}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Node Count */}
      <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-border shadow-lg z-10">
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{nodes.length}</span> nodes nearby
        </p>
      </div>
    </div>
  );
};

export default QuestMap;
