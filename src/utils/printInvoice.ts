import { Sale, Order } from '../types';
import { format } from 'date-fns';

export const printInvoice = (data: Sale | Order) => {
  const isSale = 'type' in data && data.type === 'store';
  const items = data.items;
  const total = data.totalAmount;
  const date = data.createdAt?.toDate ? format(data.createdAt.toDate(), 'PPP p') : format(new Date(), 'PPP p');
  const id = data.id.slice(-8).toUpperCase();

  const html = `
    <html>
      <head>
        <title>Invoice #${id}</title>
        <style>
          body { font-family: 'Inter', sans-serif; padding: 40px; color: #1a1a1a; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px; }
          .logo { font-size: 24px; font-weight: 900; color: #FF3269; margin-bottom: 5px; }
          .info { display: flex; justify-content: space-between; margin-bottom: 40px; font-size: 14px; }
          .info div { flex: 1; }
          .info .right { text-align: right; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          th { text-align: left; border-bottom: 2px solid #f0f0f0; padding: 12px 0; font-size: 12px; text-transform: uppercase; color: #9ca3af; }
          td { padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
          .totals { text-align: right; }
          .totals div { margin-bottom: 10px; font-size: 14px; }
          .totals .grand-total { font-size: 20px; font-weight: 900; color: #FF3269; margin-top: 20px; border-top: 2px solid #f0f0f0; padding-top: 10px; }
          .footer { text-align: center; margin-top: 60px; color: #9ca3af; font-size: 12px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">RETAIL STORE</div>
          <div>Invoice / Bill of Supply</div>
        </div>
        
        <div class="info">
          <div>
            <strong>Bill To:</strong><br>
            ${isSale ? (data as Sale).customerName || 'Walk-in Customer' : 'Online Customer'}<br>
            ${isSale ? (data as Sale).customerPhone || '' : (data as Order).deliveryAddress}
          </div>
          <div class="right">
            <strong>Invoice #:</strong> ${id}<br>
            <strong>Date:</strong> ${date}<br>
            <strong>Payment:</strong> ${data.paymentMethod.toUpperCase()}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item Description</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">₹${item.price.toFixed(2)}</td>
                <td style="text-align: right;">₹${((item as any).subtotal || (item.price * item.quantity)).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          ${isSale ? `
            <div>Subtotal: ₹${(data as Sale).subtotal?.toFixed(2) || total.toFixed(2)}</div>
            <div>GST (18%): ₹${(data as Sale).gstAmount?.toFixed(2) || 0}</div>
            ${(data as Sale).discount > 0 ? `<div style="color: #ef4444;">Discount: -₹${(data as Sale).discount.toFixed(2)}</div>` : ''}
          ` : ''}
          <div class="grand-total">Total Amount: ₹${total.toFixed(2)}</div>
        </div>

        <div class="footer">
          <p>Thank you for shopping with us!</p>
          <p>This is a computer generated invoice.</p>
        </div>
      </body>
    </html>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    };
  }
};
