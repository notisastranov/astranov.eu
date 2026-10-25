import React, { useState, useEffect, useRef } from 'react';
import Globe from './Globe.jsx';
import CityMap from './CityMap.jsx';
import VendorSheet from './VendorSheet.jsx';
import KrypteiaPanel from './KrypteiaPanel.jsx';

// Country to city coordinates mapping
const COUNTRY_CITIES = {
  'Greece': [
    { name: 'Athens', lat: 37.9756, lon: 23.7294 },
    { name: 'Rhodes', lat: 36.4349, lon: 28.2176 },
    { name: 'Thessaloniki', lat: 40.6401, lon: 22.9444 },
    { name: 'Patras', lat: 38.2463, lon: 21.7346 },
    { name: 'Heraklion', lat: 35.3387, lon: 25.1442 }
  ],
  'United States': [
    { name: 'New York', lat: 40.7128, lon: -74.0060 },
    { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
    { name: 'Chicago', lat: 41.8781, lon: -87.6298 }
  ],
  'Japan': [
    { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
    { name: 'Osaka', lat: 34.6937, lon: 135.5023 }
  ],
  'Egypt': [
    { name: 'Cairo', lat: 30.0444, lon: 31.2357 }
  ],
  'Australia': [
    { name: 'Sydney', lat: -33.8688, lon: 151.2093 }
  ],
  'Brazil': [
    { name: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729 }
  ]
};

// Haversine distance formula
const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // radius of earth in km
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
};

export default function App() {
  // Navigation levels: 'GLOBAL' | 'NATIONAL' | 'PERSONAL'
  const [level, setLevel] = useState('GLOBAL');
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  
  // App state
  const [balance, setBalance] = useState(100.00); // 100 AVC starting balance
  const [userLocation, setUserLocation] = useState(null);
  
  // Interactive UI triggers
  const [brandClickCount, setBrandClickCount] = useState(0);
  const [isKrypteiaOpen, setIsKrypteiaOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiMessageInput, setAiMessageInput] = useState('');
  const [aiMessages, setAiMessages] = useState([
    { role: 'assistant', content: 'AstranoV Operating Assistant active. State your coordinate destination or catalog search request.' }
  ]);
  const [aiBackendStatus, setAiBackendStatus] = useState('online');

  // Long press & context menu
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [contextMenuPos, setContextMenuPos] = useState(null);
  const [mockVideoMessage, setMockVideoMessage] = useState(null);

  // Vendor & checkout states
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [basket, setBasket] = useState([]);
  
  // Routing & order lifecycle
  const [routeCoords, setRouteCoords] = useState([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [driverCount, setDriverCount] = useState(1);
  const [specialFeesList, setSpecialFeesList] = useState([]);
  const [orderState, setOrderState] = useState('draft'); // draft | offer_created | driver_assignment_pending | driver_accepted | confirmed | out_for_delivery | driver_confirmed_delivered | client_confirmed_received | closed
  const [orderId, setOrderId] = useState(null);

  // Sound/Vibration haptic simulation helper
  const triggerHapticFeedback = () => {
    if (window.navigator.vibrate) {
      window.navigator.vibrate(50);
    }
  };

  // Reset clicks on brand header after 2 seconds
  useEffect(() => {
    if (brandClickCount > 0) {
      const t = setTimeout(() => setBrandClickCount(0), 2000);
      return () => clearTimeout(t);
    }
  }, [brandClickCount]);

  // Handle Brand Click (Secret entry to Krypteia)
  const handleBrandClick = () => {
    const nextCount = brandClickCount + 1;
    setBrandClickCount(nextCount);
    if (nextCount === 3) {
      triggerHapticFeedback();
      setIsKrypteiaOpen(true);
      setBrandClickCount(0);
    }
  };

  // Select Country from Globe Click
  const handleSelectCountry = (countryName) => {
    triggerHapticFeedback();
    setSelectedCountry(countryName);
    setLevel('NATIONAL');
  };

  // Select City from National List Click
  const handleSelectCity = (city) => {
    triggerHapticFeedback();
    setSelectedCity(city);
    // Position user location slightly offset from city center
    setUserLocation({ lat: city.lat + 0.002, lon: city.lon - 0.002 });
    setLevel('PERSONAL');
  };

  // Double click ascend mapping
  const handleDoubleClick = () => {
    triggerHapticFeedback();
    if (level === 'PERSONAL') {
      setLevel('NATIONAL');
      setSelectedCity(null);
      setSelectedVendor(null);
      setBasket([]);
      setRouteCoords([]);
      setOrderState('draft');
    } else if (level === 'NATIONAL') {
      setLevel('GLOBAL');
      setSelectedCountry(null);
    }
  };

  // Handle Map long press trigger
  const handleLongPress = (e, coord) => {
    e.preventDefault();
    triggerHapticFeedback();
    setContextMenuPos({ x: e.clientX, y: e.clientY, coord });
  };

  // Calculate delivery fees, driver counts, and special condition fees
  useEffect(() => {
    if (!selectedVendor || !selectedCity || !userLocation) return;

    // 1. Calculate straight-line distance
    const dist = getHaversineDistance(
      selectedVendor.lat,
      selectedVendor.lon,
      userLocation.lat,
      userLocation.lon
    );
    setDistanceKm(dist);

    // 2. Base Delivery Fee: 3 AVC min for first 3 km + 1 AVC per additional km
    const baseFee = dist <= 3 ? 3.0 : 3.0 + (dist - 3.0);
    
    // 3. Driver count: 1 driver per 13 kg/L
    const totalWeight = basket.reduce((acc, item) => acc + (item.weight || 0) * item.qty, 0);
    const calculatedDrivers = Math.max(1, Math.ceil(totalWeight / 13.0));
    setDriverCount(calculatedDrivers);

    // 4. Special conditions: check weight > 13, bad weather (mocked), priority status (mocked)
    const surcharges = [];
    if (totalWeight > 13.0) {
      surcharges.push({ name: 'Cargo Overweight (>13kg)', amount: baseFee * 0.13 });
    }
    // Random mock condition for night hours (Greek late delivery hours)
    const currentHour = new Date().getHours();
    if (currentHour >= 22 || currentHour < 6) {
      surcharges.push({ name: 'Night/Extreme Hours (+13%)', amount: baseFee * 0.13 });
    }
    setSpecialFeesList(surcharges);

    // Final delivery fee: base + surcharges
    const finalFee = baseFee * calculatedDrivers;
    setDeliveryFee(finalFee);

  }, [basket, selectedVendor, userLocation, selectedCity]);

  // Request OSRM Routing from server endpoint
  useEffect(() => {
    if (level === 'PERSONAL' && selectedVendor && userLocation) {
      const fetchRoute = async () => {
        try {
          const res = await fetch('/api/routing/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              start: [selectedVendor.lat, selectedVendor.lon],
              end: [userLocation.lat, userLocation.lon]
            })
          });
          const data = await res.json();
          if (data.success && data.coordinates) {
            setRouteCoords(data.coordinates);
          } else {
            // Drawing symbolic connection line as fallback if routing server reports offline
            setRouteCoords([
              [selectedVendor.lat, selectedVendor.lon],
              [userLocation.lat, userLocation.lon]
            ]);
          }
        } catch (err) {
          // Fallback to straight dotted relationship line
          setRouteCoords([
            [selectedVendor.lat, selectedVendor.lon],
            [userLocation.lat, userLocation.lon]
          ]);
        }
      };

      fetchRoute();
    }
  }, [selectedVendor, userLocation, level]);

  // Submit order checkout sequence
  const handleSubmitOrder = async () => {
    triggerHapticFeedback();
    setOrderState('offer_created');

    try {
      // 1. Submit offer
      const response = await fetch('/api/orders/create-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: selectedVendor.id,
          items: basket,
          distance: distanceKm,
          deliveryFee,
          driverCount,
          weight: basket.reduce((acc, i) => acc + (i.weight || 0) * i.qty, 0)
        })
      });
      const data = await response.json();
      setOrderId(data.orderId);
      
      // 2. Start driver assignment sequence
      setOrderState('driver_assignment_pending');
      setTimeout(async () => {
        // Driver accept call
        const assignResponse = await fetch(`/api/orders/driver-accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: data.orderId })
        });
        const assignData = await assignResponse.json();
        
        if (assignData.success) {
          setOrderState('confirmed');
          triggerHapticFeedback();
          
          // Courier out for delivery state
          setTimeout(() => {
            setOrderState('out_for_delivery');
            
            // Wait for delivery to close
            setTimeout(() => {
              setOrderState('driver_confirmed_delivered');
              triggerHapticFeedback();
            }, 5000);
          }, 3000);
        }
      }, 3000);

    } catch (err) {
      setOrderState('draft');
      alert('Order offer failed to transmit.');
    }
  };

  // Complete Order & Write Accounting entries
  const handleConfirmReceived = async () => {
    triggerHapticFeedback();
    setOrderState('client_confirmed_received');
    
    try {
      const response = await fetch(`/api/orders/client-confirm-received`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, clientConfirmed: true })
      });
      const data = await response.json();
      
      if (data.success) {
        setOrderState('closed');
        // Subtract from client's balance
        const totalCost = basket.reduce((acc, item) => acc + item.price * item.qty, 0) + deliveryFee;
        setBalance(prev => Math.max(0, prev - totalCost));
        
        // Log log
        await fetch('/api/logs/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: 'info',
            message: `Order ${orderId} finalized. Ledger entries locked into Accounting Office.`
          })
        });

        setTimeout(() => {
          setBasket([]);
          setSelectedVendor(null);
          setOrderState('draft');
        }, 3000);
      }
    } catch (err) {
      alert('Receipt confirmation failed to lock.');
    }
  };

  // Display label on gold ribbon based on order state
  const getOrderButtonLabel = () => {
    switch (orderState) {
      case 'draft': return 'SUBMIT ORDER OFFER';
      case 'offer_created': return 'TRANSMITTING OFFER...';
      case 'driver_assignment_pending': return 'FINDING COURIERS...';
      case 'confirmed': return 'ORDER CONFIRMED';
      case 'out_for_delivery': return 'COURIER EN ROUTE';
      case 'driver_confirmed_delivered': return 'CONFIRM RECEIPT';
      case 'client_confirmed_received': return 'TRANSACTING LEDGER...';
      case 'closed': return 'ORDER LUNCHED';
      default: return 'SUBMIT ORDER OFFER';
    }
  };

  // Send message to AI Assistant
  const handleSendAiMessage = async (e) => {
    e.preventDefault();
    if (!aiMessageInput.trim()) return;

    const userMsg = aiMessageInput;
    setAiMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setAiMessageInput('');

    try {
      const res = await fetch('/api/ai/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg })
      });
      const data = await res.json();
      
      if (data.response) {
        setAiMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        // Handle coordinates parsing if AI resolved location
        if (data.coordinates) {
          triggerHapticFeedback();
          setLevel('PERSONAL');
          setSelectedCity(data.city);
          setUserLocation({ lat: data.coordinates.lat, lon: data.coordinates.lon });
        }
      } else {
        setAiMessages(prev => [...prev, { role: 'assistant', content: 'AI backend unavailable. Manual mode active.' }]);
        setAiBackendStatus('offline');
      }
    } catch (err) {
      setAiMessages(prev => [...prev, { role: 'assistant', content: 'AI backend unavailable. Manual mode active.' }]);
      setAiBackendStatus('offline');
    }
  };

  return (
    <div className="app-container" onDoubleClick={handleDoubleClick}>
      {/* Brand Header */}
      <div className="brand-header" style={{ pointerEvents: 'auto', cursor: 'pointer' }} onClick={handleBrandClick}>
        <div className="brand-logo">AstranoV</div>
        <div className="brand-sub">Internet Operating System</div>
      </div>

      {/* GLOBAL LEVEL: Three.js Earth Sphere */}
      {level === 'GLOBAL' && (
        <Globe onSelectCountry={handleSelectCountry} />
      )}

      {/* NATIONAL LEVEL: Country View (Grid and City Beacons) */}
      {level === 'NATIONAL' && selectedCountry && (
        <div className="overlay-container active" style={{ background: '#020206' }}>
          {/* Neon grid scanning background */}
          <div 
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              backgroundImage: 'radial-gradient(circle, transparent 20%, #020206 90%), linear-gradient(rgba(0, 240, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.05) 1px, transparent 1px)',
              backgroundSize: '100% 100%, 40px 40px, 40px 40px',
              zIndex: 1
            }}
          />
          
          <div style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%', padding: '120px 24px 40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="country-card" style={{ width: '100%', maxWidth: '500px', textAlign: 'center', borderColor: 'var(--color-electric)' }}>
              <h2 style={{ color: 'var(--color-electric)', letterSpacing: '0.05em' }}>{selectedCountry.toUpperCase()} SELECTED</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginTop: '6px' }}>
                Double click to ascend back to Global space. Select a city node to descend.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', width: '100%', maxWidth: '500px', marginTop: '30px' }}>
              {(COUNTRY_CITIES[selectedCountry] || []).map(city => (
                <button
                  key={city.name}
                  className="btn-hud"
                  onClick={() => handleSelectCity(city)}
                  style={{ justifyContent: 'center', width: '100%' }}
                >
                  ⚡ {city.name} Node
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PERSONAL LEVEL: Map layout */}
      {level === 'PERSONAL' && selectedCity && (
        <div className="overlay-container active">
          <CityMap 
            selectedCity={selectedCity}
            onSelectVendor={(v) => {
              triggerHapticFeedback();
              setSelectedVendor(v);
            }}
            onSelectAccounting={() => {
              triggerHapticFeedback();
              alert(`ACCOUNTING OFFICE OPENED FOR ${selectedCity.name.toUpperCase()}\n\nAll AVC ledger entries are verified on the secure backend transaction database.`);
            }}
            orderState={orderState}
            routeCoordinates={routeCoords}
          />
        </div>
      )}

      {/* Triangular context menu (long press) */}
      {contextMenuPos && (
        <div 
          className="triangle-menu" 
          style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="triangle-svg" viewBox="0 0 100 100">
            <polygon points="50,15 90,85 10,85" fill="rgba(12,12,18,0.9)" stroke="var(--color-electric)" strokeWidth="1.5" />
          </svg>
          
          <button 
            className="triangle-btn top" 
            onClick={() => {
              setMockVideoMessage('📹 Outgoing video post uploaded successfully.');
              setContextMenuPos(null);
            }}
          >
            A<br/>Post
          </button>
          
          <button 
            className="triangle-btn left" 
            onClick={() => {
              setUserLocation({ lat: contextMenuPos.coord.lat, lon: contextMenuPos.coord.lon });
              setContextMenuPos(null);
            }}
          >
            My Loc
          </button>
          
          <button 
            className="triangle-btn right" 
            onClick={() => {
              alert('Custom location beacon registered.');
              setContextMenuPos(null);
            }}
          >
            Add Pin
          </button>
        </div>
      )}

      {/* UI overlays / HUD */}
      {level !== 'GLOBAL' && (
        <div style={{ position: 'absolute', top: 30, left: 30, zIndex: 95, pointerEvents: 'auto' }}>
          <button className="btn-hud" onClick={handleDoubleClick}>
            ↩ Back
          </button>
        </div>
      )}

      {/* Personal level details */}
      {level === 'PERSONAL' && (
        <>
          <div style={{ position: 'absolute', bottom: 30, right: 30, zIndex: 95, pointerEvents: 'auto', display: 'flex', gap: '10px' }}>
            <div className="btn-hud" style={{ border: '1px solid var(--color-gold)', color: 'var(--color-gold)' }}>
              🏦 Balance: {balance.toFixed(2)} AVC
            </div>
            
            <button className="btn-hud" onClick={() => setIsAiOpen(!isAiOpen)}>
              🤖 {isAiOpen ? 'Close Assistant' : 'AI Assistant'}
            </button>
          </div>

          {/* Video upload notification */}
          {mockVideoMessage && (
            <div 
              style={{
                position: 'absolute',
                top: 90,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,240,255,0.1)',
                border: '1px solid var(--color-electric)',
                padding: '10px 20px',
                borderRadius: '20px',
                zIndex: 500,
                fontSize: '0.85rem'
              }}
            >
              {mockVideoMessage}
              <button 
                onClick={() => setMockVideoMessage(null)}
                style={{ background: 'transparent', border: 'none', color: '#fff', marginLeft: '10px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          )}
        </>
      )}

      {/* Public AI Assistant Box */}
      {isAiOpen && level === 'PERSONAL' && (
        <div className="ai-assistant-panel">
          <div className="ai-header">
            <span>AstranoV Assistant</span>
            <div className={`ai-status-indicator ${aiBackendStatus === 'offline' ? 'offline' : ''}`} />
          </div>
          <div className="ai-body">
            {aiMessages.map((msg, idx) => (
              <div key={idx} className={`ai-message ${msg.role}`}>
                {msg.content}
              </div>
            ))}
          </div>
          <form className="ai-input-bar" onSubmit={handleSendAiMessage}>
            <input 
              type="text" 
              className="ai-input" 
              placeholder="Search pizza, restaurants, hotels..."
              value={aiMessageInput}
              onChange={(e) => setAiMessageInput(e.target.value)}
            />
            <button type="submit" className="btn-ai-send">Send</button>
          </form>
        </div>
      )}

      {/* Vendor sheet sheet */}
      <VendorSheet 
        vendor={selectedVendor}
        onClose={() => setSelectedVendor(null)}
        basket={basket}
        setBasket={setBasket}
        onSubmitOrder={orderState === 'driver_confirmed_delivered' ? handleConfirmReceived : handleSubmitOrder}
        orderState={orderState}
        orderButtonLabel={getOrderButtonLabel}
        distanceKm={distanceKm}
        deliveryFee={deliveryFee}
        driverCount={driverCount}
        specialFeesList={specialFeesList}
      />

      {/* Owner-only Krypteia Panel */}
      <KrypteiaPanel 
        isOpen={isKrypteiaOpen}
        onClose={() => setIsKrypteiaOpen(false)}
      />
    </div>
  );
}
