import React, { useEffect, useState, useRef } from 'react';

// Preset vendors for different cities to make it realistic worldwide
const VENDOR_TEMPLATES = [
  { name: 'Atheras Organics', type: 'supermarket', icon: '🛒', desc: 'Premium organic grocery supplier', items: [{ id: 'ao-1', name: 'Organic Salad Box', price: 12, weight: 1.2 }, { id: 'ao-2', name: 'Local Olive Oil 1L', price: 18, weight: 0.95 }] },
  { name: 'Neon Pizzeria', type: 'pizza', icon: '🍕', desc: 'Synthesized fire-baked pizzas', items: [{ id: 'np-1', name: 'Electric Pepperoni Pizza', price: 15, weight: 0.8 }, { id: 'np-2', name: 'Double Cheese Synthesizer', price: 13, weight: 0.7 }] },
  { name: 'Hermes Diners', type: 'restaurant', icon: '🍔', desc: 'High-speed gourmet burgers', items: [{ id: 'hd-1', name: 'Quantum Burger & Fries', price: 16, weight: 0.6 }, { id: 'hd-2', name: 'Anti-Matter Soda', price: 4, weight: 0.4 }] },
  { name: 'Krypteia Secure Cars', type: 'rental-car', icon: '🚗', desc: 'Armored automated vehicles', items: [{ id: 'kc-1', name: 'Autonomous Sedan Day Rental', price: 120, weight: 0.0 }, { id: 'kc-2', name: 'Cyber Truck Premium Day Rental', price: 330, weight: 0.0 }] },
  { name: 'Zeus Grand Lodge', type: 'hotel', icon: '🏨', desc: 'Premium glassmorphic lodging', items: [{ id: 'zh-1', name: 'Neon Suite Night Stay', price: 180, weight: 0.0 }, { id: 'zh-2', name: 'Penthouse Operations Suite', price: 450, weight: 0.0 }] }
];

export default function CityMap({ 
  selectedCity, 
  onSelectVendor, 
  onSelectAccounting,
  orderState, 
  routeCoordinates 
}) {
  const [useProcedural, setUseProcedural] = useState(false);
  const mapRef = useRef(null);
  const canvasRef = useRef(null);
  const leafletMapInstance = useRef(null);

  // Initialize coordinates based on selectedCity
  const centerLat = selectedCity?.lat || 37.9756;
  const centerLon = selectedCity?.lon || 23.7294;

  // Generate local vendors close to the city center
  const [vendors] = useState(() => {
    return VENDOR_TEMPLATES.map((t, idx) => {
      // Offset slightly from center
      const angle = (idx * 2 * Math.PI) / VENDOR_TEMPLATES.length;
      const dist = 0.006 + Math.random() * 0.004; // ~1km
      return {
        ...t,
        id: `vendor-${idx}`,
        lat: centerLat + Math.sin(angle) * dist,
        lon: centerLon + Math.cos(angle) * dist
      };
    });
  });

  // Drivers placement
  const [drivers] = useState(() => {
    return Array.from({ length: 4 }).map((_, idx) => {
      const angle = (idx * 2 * Math.PI) / 4 + Math.PI / 4;
      const dist = 0.008;
      return {
        id: `driver-${idx + 1}`,
        name: `Driver Delta-${idx + 1}`,
        lat: centerLat + Math.sin(angle) * dist,
        lon: centerLon + Math.cos(angle) * dist,
        status: 'idle'
      };
    });
  });

  // Accounting office coordinate (placed near center)
  const accountingOffice = {
    name: 'AstranoV Accounting Office',
    lat: centerLat - 0.002,
    lon: centerLon + 0.002,
    icon: '📊'
  };

  // User current location
  const userLocation = {
    lat: centerLat + 0.002,
    lon: centerLon - 0.002
  };

  // 1. Leaflet integration
  useEffect(() => {
    if (useProcedural) return;

    // Wait for Leaflet to be loaded from index.html CDN script
    if (!window.L) {
      console.warn('Leaflet library not found, activating procedural canvas fallback.');
      setUseProcedural(true);
      return;
    }

    const L = window.L;

    // Check if map container exists
    if (!mapRef.current) return;

    // Destroy existing instance if it exists
    if (leafletMapInstance.current) {
      leafletMapInstance.current.remove();
    }

    try {
      // Create Map
      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([centerLat, centerLon], 15);

      leafletMapInstance.current = map;

      // Dark Mode Map Tiles (CartoDB Dark Matter)
      const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      });

      // Handle loading failure (offline check)
      tileLayer.on('tileerror', () => {
        console.warn('Map tiles failed to load (offline). Swapping to offline procedural map.');
        setUseProcedural(true);
      });

      tileLayer.addTo(map);

      // Add Custom Electric Overlays (User, Destination, Vendors, Drivers, Accounting)
      // Standard Leaflet markers can be styled or we can use L.divIcon for modern neon styling
      
      // User Marker
      const userIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div class="beacon" style="background-color: #00f0ff; box-shadow: 0 0 15px #00f0ff;"></div>`,
        iconSize: [20, 20]
      });
      L.marker([userLocation.lat, userLocation.lon], { icon: userIcon }).addTo(map)
        .bindPopup('Your Location');

      // Accounting Office
      const accIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div class="beacon" style="background-color: #ff3b30; box-shadow: 0 0 15px #ff3b30;"><span style="position:absolute;top:-25px;left:-10px;font-size:1rem;">📊</span></div>`,
        iconSize: [20, 20]
      });
      L.marker([accountingOffice.lat, accountingOffice.lon], { icon: accIcon }).addTo(map)
        .on('click', () => onSelectAccounting());

      // Vendors
      vendors.forEach(v => {
        const vIcon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `<div class="beacon" style="background-color: #d4af37; box-shadow: 0 0 15px #d4af37;"><span style="position:absolute;top:-20px;left:-6px;font-size:0.85rem;">${v.icon}</span></div>`,
          iconSize: [20, 20]
        });
        L.marker([v.lat, v.lon], { icon: vIcon }).addTo(map)
          .on('click', () => onSelectVendor(v));
      });

      // Drivers
      drivers.forEach(d => {
        const dIcon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `<div class="beacon" style="background-color: #00ff66; box-shadow: 0 0 15px #00ff66;"><span style="position:absolute;top:-20px;left:-6px;font-size:0.85rem;">🛵</span></div>`,
          iconSize: [16, 16]
        });
        L.marker([d.lat, d.lon], { icon: dIcon }).addTo(map)
          .bindPopup(`Driver Status: ${d.name}`);
      });

      // Route Polyline (if route coordinates available)
      if (routeCoordinates && routeCoordinates.length > 0) {
        const polyline = L.polyline(routeCoordinates, {
          color: '#00f0ff',
          weight: 4,
          opacity: 0.8,
          dashArray: '5, 10'
        }).addTo(map);
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
      }

    } catch (err) {
      console.error('Leaflet initialization error:', err);
      setUseProcedural(true);
    }

    return () => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }
    };
  }, [selectedCity, vendors, drivers, routeCoordinates, useProcedural]);

  // 2. Procedural Canvas Map Fallback (Perfect for offline sandbox simulation)
  useEffect(() => {
    if (!useProcedural) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;

    // Resize canvas
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;

    const width = canvas.width;
    const height = canvas.height;

    // Draw procedural grid
    const draw = () => {
      // Clear with dark color
      ctx.fillStyle = '#030308';
      ctx.fillRect(0, 0, width, height);

      // Draw gridlines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw cyber roads / segments
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 0;

      // Draw radial rings from center
      const centerX = width / 2;
      const centerY = height / 2;
      for (let r = 80; r < Math.max(width, height); r += 120) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw intersecting spoke lines
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + Math.cos(angle) * width, centerY + Math.sin(angle) * height);
        ctx.stroke();
      }

      // Helper to map lat/lon offset to canvas coordinates
      const mapCoords = (lat, lon) => {
        const dLat = lat - centerLat;
        const dLon = lon - centerLon;
        const scale = 35000; // zoom scale factor
        return {
          x: centerX + dLon * scale,
          y: centerY - dLat * scale
        };
      };

      // Draw User location (Electric blue pulse)
      const user = mapCoords(userLocation.lat, userLocation.lon);
      const pulseRadius = 12 + Math.sin(Date.now() / 200) * 4;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(user.x, user.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(user.x, user.y, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw Accounting Office (Red pulse + icon)
      const acc = mapCoords(accountingOffice.lat, accountingOffice.lon);
      ctx.shadowColor = '#ff3b30';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(acc.x, acc.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '12px Outfit';
      ctx.fillText('📊 Ledger', acc.x - 24, acc.y - 14);

      // Draw Vendors (Gold glow + icons)
      vendors.forEach(v => {
        const pos = mapCoords(v.lat, v.lon);
        ctx.shadowColor = '#d4af37';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#d4af37';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '12px Outfit';
        ctx.fillText(`${v.icon} ${v.name}`, pos.x - 20, pos.y - 14);
      });

      // Draw Drivers (Green)
      drivers.forEach(d => {
        const pos = mapCoords(d.lat, d.lon);
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#00ff66';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('🛵 Courier', pos.x - 20, pos.y + 16);
      });

      // Draw Route Line if available
      if (routeCoordinates && routeCoordinates.length > 0) {
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        routeCoordinates.forEach((coord, i) => {
          const pt = mapCoords(coord[0], coord[1]);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.shadowBlur = 0;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    // Handle canvas clicks
    const handleCanvasClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const scale = 35000;
      const getLatLon = (x, y) => {
        const dLon = (x - centerX) / scale;
        const dLat = (centerY - y) / scale;
        return {
          lat: centerLat + dLat,
          lon: centerLon + dLon
        };
      };

      // Check click proximity to items
      // 1. Accounting office click check
      const accPos = mapCoords(accountingOffice.lat, accountingOffice.lon);
      const accDist = Math.hypot(clickX - accPos.x, clickY - accPos.y);
      if (accDist < 20) {
        onSelectAccounting();
        return;
      }

      // 2. Vendors click check
      for (const v of vendors) {
        const pos = mapCoords(v.lat, v.lon);
        const dist = Math.hypot(clickX - pos.x, clickY - pos.y);
        if (dist < 20) {
          onSelectVendor(v);
          return;
        }
      }
    };

    canvas.addEventListener('click', handleCanvasClick);

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [useProcedural, selectedCity, vendors, drivers, routeCoordinates]);

  return (
    <div className="map-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Map Switcher HUD */}
      <div style={{ position: 'absolute', top: 15, left: 15, zIndex: 100, pointerEvents: 'auto' }}>
        <button 
          className="btn-hud" 
          onClick={() => setUseProcedural(!useProcedural)}
          style={{ fontSize: '0.75rem', padding: '6px 12px' }}
        >
          🛰️ {useProcedural ? 'Switch to Satellite Map' : 'Switch to Tactical Neon Grid'}
        </button>
      </div>

      {useProcedural ? (
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      ) : (
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  );
}
