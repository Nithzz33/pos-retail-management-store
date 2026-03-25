import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  isOpen: boolean;
  onClose: () => void;
  continuous?: boolean;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, isOpen, onClose, continuous = false }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isOpen) {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scannerRef.current.render(
        (decodedText) => {
          onScan(decodedText);
          if (!continuous) {
            onClose();
          }
        },
        (error) => {
          // console.warn(error);
        }
      );
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      }
    };
  }, [isOpen, onScan, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xl font-black text-gray-900">Scan Barcode</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="p-6">
          <div id="reader" className="overflow-hidden rounded-2xl border-2 border-dashed border-gray-200"></div>
          <p className="mt-4 text-center text-sm font-bold text-gray-500">
            Position the barcode within the frame to scan
          </p>
        </div>
      </div>
    </div>
  );
};
