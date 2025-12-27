import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Globe, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Location {
  id: string;
  name: string | null;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  location_category: string | null;
}

interface LocationsMapProps {
  locations: Location[];
}

const MAPBOX_TOKEN_KEY = 'vendx_mapbox_token';

const LocationsMap = ({ locations }: LocationsMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>(() => {
    return localStorage.getItem(MAPBOX_TOKEN_KEY) || '';
  });
  const [tokenInput, setTokenInput] = useState('');
  const [mapError, setMapError] = useState(false);

  // Filter locations with valid coordinates
  const validLocations = locations.filter(
    (loc) => 
      loc.latitude !== null && 
      loc.longitude !== null &&
      loc.latitude >= -90 && loc.latitude <= 90 &&
      loc.longitude >= -180 && loc.longitude <= 180
  );

  const handleSaveToken = () => {
    if (tokenInput.trim()) {
      localStorage.setItem(MAPBOX_TOKEN_KEY, tokenInput.trim());
      setMapboxToken(tokenInput.trim());
      setMapError(false);
    }
  };

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    try {
      mapboxgl.accessToken = mapboxToken;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        projection: 'globe',
        zoom: validLocations.length > 0 ? 3 : 1.5,
        center: validLocations.length > 0 
          ? [validLocations[0].longitude!, validLocations[0].latitude!]
          : [-98.5795, 39.8283], // Default to US center
        pitch: 20,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        'top-right'
      );

      map.current.on('style.load', () => {
        map.current?.setFog({
          color: 'rgb(10, 10, 20)',
          'high-color': 'rgb(30, 30, 60)',
          'horizon-blend': 0.1,
        });
      });

      map.current.on('error', () => {
        setMapError(true);
      });

      // Add markers for each valid location
      validLocations.forEach((location) => {
        const el = document.createElement('div');
        el.className = 'location-marker';
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.borderRadius = '50%';
        el.style.cursor = 'pointer';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        
        // Color based on category
        if (location.location_category === 'arcade') {
          el.style.backgroundColor = '#a855f7';
        } else if (location.location_category === 'mixed') {
          el.style.backgroundColor = '#22c55e';
        } else {
          el.style.backgroundColor = '#3b82f6';
        }

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 8px; min-width: 150px;">
            <h3 style="font-weight: bold; margin-bottom: 4px; color: #000;">${location.name || location.city}</h3>
            <p style="color: #666; font-size: 12px; margin: 0;">${location.city}, ${location.country}</p>
            <p style="color: #666; font-size: 11px; margin-top: 4px; text-transform: capitalize;">
              ${location.location_category || 'Vending'} • ${location.status}
            </p>
          </div>
        `);

        new mapboxgl.Marker(el)
          .setLngLat([location.longitude!, location.latitude!])
          .setPopup(popup)
          .addTo(map.current!);
      });

      // Fit bounds to show all markers if multiple locations
      if (validLocations.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        validLocations.forEach((loc) => {
          bounds.extend([loc.longitude!, loc.latitude!]);
        });
        map.current.fitBounds(bounds, { padding: 50, maxZoom: 10 });
      }

    } catch (error) {
      console.error('Map initialization error:', error);
      setMapError(true);
    }

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, validLocations]);

  // No token set - show input
  if (!mapboxToken || mapError) {
    return (
      <div className="h-[400px] bg-card/50 border border-border/50 rounded-xl flex flex-col items-center justify-center p-8">
        <Globe className="w-12 h-12 text-muted-foreground/50 mb-4" />
        {mapError && (
          <div className="flex items-center gap-2 text-destructive mb-4">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Invalid token. Please try again.</span>
          </div>
        )}
        <p className="text-muted-foreground text-center mb-4 max-w-md">
          Enter your Mapbox public token to enable the interactive map.
          Get one free at <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">mapbox.com</a>
        </p>
        <div className="flex gap-2 w-full max-w-sm">
          <Input
            type="text"
            placeholder="pk.eyJ1..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="bg-background"
          />
          <Button onClick={handleSaveToken}>Save</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] rounded-xl overflow-hidden border border-border/50">
      <div ref={mapContainer} className="absolute inset-0" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent to-background/10 rounded-xl" />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 text-xs">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-muted-foreground">Vending</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="text-muted-foreground">Arcade</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-muted-foreground">Mixed</span>
        </div>
      </div>
    </div>
  );
};

export default LocationsMap;
