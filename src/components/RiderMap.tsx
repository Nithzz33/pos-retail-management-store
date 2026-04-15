import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Rider } from '../services/riderAssignmentService';
import { Order } from '../types';

// Fix for default marker icon issue in Leaflet with Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const getRiderIcon = (status: string, isHovered: boolean = false) => {
  const color = status === 'online' ? '#22c55e' : status === 'busy' ? '#f59e0b' : '#ef4444';
  const size = isHovered ? 40 : 32;
  const iconSize = isHovered ? 24 : 18;
  
  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        ${isHovered ? 'transform: scale(1.1); z-index: 1000;' : ''}
      ">
        <img src="https://cdn-icons-png.flaticon.com/512/2972/2972185.png" style="width: ${iconSize}px; height: ${iconSize}px; filter: brightness(0) invert(1);" />
      </div>
    `,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

const orderIcon = (isSelected: boolean = false) => L.divIcon({
  html: `
    <div class="relative flex items-center justify-center">
      ${isSelected ? '<div class="absolute w-12 h-12 bg-[#0c831f]/20 rounded-full animate-ping"></div>' : ''}
      <div style="
        background-color: ${isSelected ? '#0c831f' : '#9ca3af'};
        width: ${isSelected ? '40px' : '32px'};
        height: ${isSelected ? '40px' : '32px'};
        border-radius: 12px;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(45deg);
        position: relative;
        z-index: 10;
        transition: all 0.3s ease;
      ">
        <div style="transform: rotate(-45deg);">
          <img src="https://cdn-icons-png.flaticon.com/512/606/606547.png" style="width: ${isSelected ? '24px' : '18px'}; height: ${isSelected ? '24px' : '18px'}; filter: brightness(0) invert(1);" />
        </div>
      </div>
      ${isSelected ? `
      <div style="
        position: absolute;
        bottom: -25px;
        background: #0c831f;
        color: white;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 10px;
        font-weight: 900;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        z-index: 20;
      ">PICKUP</div>` : ''}
    </div>
  `,
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

const deliveryIcon = L.divIcon({
  html: `
    <div class="relative flex items-center justify-center">
      <div style="
        background-color: #3b82f6;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        z-index: 10;
      ">
        <img src="https://cdn-icons-png.flaticon.com/512/1946/1946436.png" style="width: 20px; height: 20px; filter: brightness(0) invert(1);" />
      </div>
      <div style="
        position: absolute;
        bottom: -25px;
        background: #3b82f6;
        color: white;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 10px;
        font-weight: 900;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        z-index: 20;
      ">DELIVERY</div>
    </div>
  `,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

interface RiderMapProps {
  riders: Rider[];
  pendingOrders?: Order[];
  selectedOrderId?: string | null;
  hoveredRiderId?: string | null;
}

// Component to auto-center map when riders or order changes
const ChangeView: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

export const RiderMap: React.FC<RiderMapProps> = ({ riders, pendingOrders = [], selectedOrderId, hoveredRiderId }) => {
  const defaultCenter: [number, number] = [12.9716, 77.5946]; // Bangalore
  const selectedOrder = pendingOrders.find(o => o.id === selectedOrderId);
  
  const center: [number, number] = selectedOrder?.pickupLocation
    ? [selectedOrder.pickupLocation.lat, selectedOrder.pickupLocation.lng]
    : (riders.length > 0 ? [riders[0].location.lat, riders[0].location.lng] : defaultCenter);

  const hoveredRider = hoveredRiderId ? riders.find(r => r.id === hoveredRiderId) : null;

  return (
    <div className="h-[450px] w-full rounded-2xl overflow-hidden border border-gray-200 shadow-inner relative z-0">
      {/* Legend */}
      <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-xl border border-gray-100 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-[10px] font-black text-gray-600 uppercase">Online Rider</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-[10px] font-black text-gray-600 uppercase">Busy Rider</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-lg bg-[#0c831f] rotate-45" />
          <span className="text-[10px] font-black text-gray-600 uppercase ml-1">Pickup (Store)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-[10px] font-black text-gray-600 uppercase">Delivery (Home)</span>
        </div>
      </div>

      <MapContainer 
        center={center} 
        zoom={13} 
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <ChangeView center={center} zoom={13} />

        {/* Render Riders */}
        {riders.map((rider) => (
          <Marker 
            key={rider.id} 
            position={[rider.location.lat, rider.location.lng]}
            icon={getRiderIcon(rider.status, hoveredRiderId === rider.id)}
          >
            <Tooltip direction="top" offset={[0, -20]} opacity={1}>
              <div className="p-1 min-w-[100px]">
                <p className="font-black text-gray-900 text-xs">{rider.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold text-yellow-600">★ {rider.rating}</span>
                  <span className="text-[10px] font-bold text-blue-600">{(rider.acceptanceRate * 100).toFixed(0)}% AR</span>
                </div>
              </div>
            </Tooltip>
            <Popup>
              <div className="p-1">
                <p className="font-black text-gray-900">{rider.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                    Status: <span className={
                      rider.status === 'online' ? 'text-green-500' : 
                      rider.status === 'busy' ? 'text-amber-500' : 'text-red-500'
                    }>{rider.status}</span>
                  </p>
                  <span className="text-[10px] font-bold text-gray-400">•</span>
                  <p className="text-[10px] font-bold text-gray-400">Rating: ★ {rider.rating}</p>
                </div>
                <p className="text-[10px] font-bold text-blue-600 mt-1">Acceptance Rate: {(rider.acceptanceRate * 100).toFixed(0)}%</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Render Pending Orders (Pickup Locations) */}
        {pendingOrders.map((order) => {
          if (!order.pickupLocation) return null;
          const isSelected = order.id === selectedOrderId;
          return (
            <Marker 
              key={`pickup-${order.id}`}
              position={[order.pickupLocation.lat, order.pickupLocation.lng]}
              icon={orderIcon(isSelected)}
              zIndexOffset={isSelected ? 1000 : 0}
            >
              <Popup>
                <div className="p-1">
                  <p className={`font-black ${isSelected ? 'text-[#0c831f]' : 'text-gray-600'}`}>
                    Pickup for #{order.id.slice(-6)}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 truncate max-w-[150px]">
                    {order.deliveryAddress}
                  </p>
                  {isSelected && (
                    <p className="text-[10px] font-black text-[#0c831f] uppercase mt-1">Currently Matching</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Render Selected Order Delivery Location */}
        {selectedOrder?.deliveryLocation && (
          <Marker 
            position={[selectedOrder.deliveryLocation.lat, selectedOrder.deliveryLocation.lng]}
            icon={deliveryIcon}
            zIndexOffset={1000}
          >
            <Popup>
              <div className="p-1">
                <p className="font-black text-blue-600">Delivery Location</p>
                <p className="text-[10px] font-bold text-gray-500">{selectedOrder.deliveryAddress}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Render Assignment Visualization (Polyline) */}
        {selectedOrder?.pickupLocation && hoveredRider && (
          <>
            {/* Rider to Pickup */}
            <Polyline 
              positions={[
                [hoveredRider.location.lat, hoveredRider.location.lng],
                [selectedOrder.pickupLocation.lat, selectedOrder.pickupLocation.lng]
              ]}
              pathOptions={{ 
                color: '#0c831f', 
                weight: 4, 
                dashArray: '10, 10',
                opacity: 0.6
              }}
            />
            {/* Pickup to Delivery */}
            {selectedOrder.deliveryLocation && (
              <Polyline 
                positions={[
                  [selectedOrder.pickupLocation.lat, selectedOrder.pickupLocation.lng],
                  [selectedOrder.deliveryLocation.lat, selectedOrder.deliveryLocation.lng]
                ]}
                pathOptions={{ 
                  color: '#3b82f6', 
                  weight: 4, 
                  dashArray: '10, 10',
                  opacity: 0.6
                }}
              />
            )}
          </>
        )}
      </MapContainer>
    </div>
  );
};
