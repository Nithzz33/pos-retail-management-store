import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Home } from './pages/Home';
import { ProductDetails } from './pages/ProductDetails';
import { CategoryProducts } from './pages/CategoryProducts';
import { OrderHistory } from './pages/OrderHistory';
import { POSHistory } from './pages/POSHistory';
import { AdminDashboard } from './pages/AdminDashboard';
import { CartProvider } from './context/CartContext';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <CartProvider>
      <Router>
        <div className="min-h-screen selection:bg-[#FF3269] selection:text-white pt-24">
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/category/:categoryId" element={<CategoryProducts />} />
            <Route path="/order-history" element={<OrderHistory />} />
            <Route path="/pos-history" element={<POSHistory />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
          <Toaster position="bottom-right" richColors />
        </div>
      </Router>
    </CartProvider>
  );
}
