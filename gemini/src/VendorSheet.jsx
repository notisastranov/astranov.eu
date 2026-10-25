import React from 'react';

export default function VendorSheet({ 
  vendor, 
  onClose, 
  basket, 
  setBasket, 
  onSubmitOrder, 
  orderState, 
  orderButtonLabel,
  distanceKm,
  deliveryFee,
  driverCount,
  specialFeesList
}) {
  if (!vendor) return null;

  // Basket modifications
  const handleAddItem = (item) => {
    const existing = basket.find(i => i.id === item.id);
    if (existing) {
      setBasket(basket.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setBasket([...basket, { ...item, qty: 1 }]);
    }
  };

  const handleRemoveItem = (item) => {
    const existing = basket.find(i => i.id === item.id);
    if (!existing) return;
    if (existing.qty === 1) {
      setBasket(basket.filter(i => i.id !== item.id));
    } else {
      setBasket(basket.map(i => i.id === item.id ? { ...i, qty: i.qty - 1 } : i));
    }
  };

  const getItemQty = (itemId) => {
    const item = basket.find(i => i.id === itemId);
    return item ? item.qty : 0;
  };

  const basketSubtotal = basket.reduce((acc, item) => acc + item.price * item.qty, 0);
  const totalWeight = basket.reduce((acc, item) => acc + (item.weight || 0) * item.qty, 0);
  
  // Calculate final total (Subtotal + Delivery Fee + Special Conditions if any)
  const specialConditionsSurcharges = specialFeesList.reduce((acc, fee) => acc + fee.amount, 0);
  const basketTotal = basketSubtotal > 0 ? (basketSubtotal + deliveryFee + specialConditionsSurcharges) : 0;

  return (
    <div className={`bottom-sheet ${vendor ? 'open' : ''}`}>
      <div className="bottom-sheet-handle" onClick={onClose} />
      
      <div className="bottom-sheet-content">
        <div className="flex-between mb-12">
          <div>
            <h2 style={{ color: 'var(--color-electric)', fontSize: '1.4rem' }}>{vendor.icon} {vendor.name}</h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem', marginTop: '4px' }}>{vendor.desc}</p>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'transparent', 
              border: '1px solid var(--color-border)', 
              color: '#fff', 
              borderRadius: '50%', 
              width: '32px', 
              height: '32px',
              cursor: 'pointer' 
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginTop: '16px' }}>
          <h3 style={{ fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '12px' }}>
            Available Items & Services
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {vendor.items.map(item => {
              const qty = getItemQty(item.id);
              return (
                <div 
                  key={item.id} 
                  className="flex-between"
                  style={{ 
                    padding: '12px', 
                    borderRadius: '8px', 
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '600' }}>{item.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-gold)', marginTop: '4px' }}>
                      {item.price} AVC {item.weight > 0 ? `(${item.weight} kg)` : ''}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {qty > 0 && (
                      <>
                        <button 
                          onClick={() => handleRemoveItem(item)}
                          style={{ 
                            background: 'rgba(255,255,255,0.1)', 
                            border: 'none', 
                            color: '#fff', 
                            width: '28px', 
                            height: '28px', 
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1rem'
                          }}
                        >
                          -
                        </button>
                        <span style={{ fontWeight: '600', minWidth: '16px', textAlign: 'center' }}>{qty}</span>
                      </>
                    )}
                    <button 
                      onClick={() => handleAddItem(item)}
                      style={{ 
                        background: 'var(--color-electric)', 
                        border: 'none', 
                        color: '#000', 
                        width: '28px', 
                        height: '28px', 
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '1rem'
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {basket.length > 0 && (
          <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
            <h4 style={{ color: 'var(--color-gold)', fontSize: '0.9rem', marginBottom: '6px' }}>Cargo Metrics</h4>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              Total Weight/Volume: <span style={{ color: '#fff', fontWeight: 'bold' }}>{totalWeight.toFixed(2)} kg/L</span>
            </div>
            {driverCount > 1 && (
              <div style={{ color: '#ff3b30', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '6px' }}>
                ⚠️ Multiple drivers ({driverCount}) required for cargo!
              </div>
            )}
          </div>
        )}

        {specialFeesList.length > 0 && (
          <div style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.15)' }}>
            <h4 style={{ color: 'var(--color-electric)', fontSize: '0.85rem', marginBottom: '4px' }}>Applied Surcharges (+13% each)</h4>
            <ul style={{ paddingLeft: '16px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)' }}>
              {specialFeesList.map((f, i) => (
                <li key={i}>{f.name}: <span style={{ color: 'var(--color-electric)' }}>+{f.amount.toFixed(2)} AVC</span></li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Gold Checkout Ribbon */}
      <div className="gold-checkout-ribbon">
        <div className="gold-ribbon-details">
          <div className="gold-ribbon-detail">
            From: <span>{vendor.name.split(' ')[0]}</span>
          </div>
          <div className="gold-ribbon-detail">
            Distance: <span>{distanceKm ? `${distanceKm.toFixed(2)} km` : 'Calculating...'}</span>
          </div>
          <div className="gold-ribbon-detail">
            Delivery Fee: <span>{deliveryFee.toFixed(2)} AVC</span>
          </div>
          <div className="gold-ribbon-detail">
            Couriers: <span>{driverCount} Driver{driverCount > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Total Price</div>
            <div className="gold-ribbon-price">{basketTotal.toFixed(2)} AVC</div>
          </div>

          <button 
            className="btn-checkout" 
            disabled={basket.length === 0 || orderState !== 'draft'}
            onClick={onSubmitOrder}
          >
            {orderButtonLabel()}
          </button>
        </div>
      </div>
    </div>
  );
}
