import { Routes, Route, Link } from "react-router-dom";
import Header from "./components/Header.jsx";
import CartDrawer from "./components/CartDrawer.jsx";
import ProductDialog from "./components/ProductDialog.jsx";
import Toasts from "./components/Toasts.jsx";
import AgentPanel from "./components/AgentPanel.jsx";
import ShoppingTools from "./tools/ShoppingTools.jsx";
import CheckoutTools from "./tools/CheckoutTools.jsx";
import StoresPage from "./pages/StoresPage.jsx";
import StorefrontPage from "./pages/StorefrontPage.jsx";
import CheckoutPage from "./pages/CheckoutPage.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import OrderPage from "./pages/OrderPage.jsx";

function NotFound() {
  return (
    <main className="page narrow empty-state">
      <p className="empty-emoji" aria-hidden="true">🧺</p>
      <h1>This aisle doesn't exist</h1>
      <p>
        <Link to="/" className="button">Back to stores</Link>
      </p>
    </main>
  );
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <ShoppingTools />
      <CheckoutTools />
      <Header />
      <Routes>
        <Route path="/" element={<StoresPage />} />
        <Route path="/store/:storeId" element={<StorefrontPage />} />
        <Route path="/store/:storeId/checkout" element={<CheckoutPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:orderId" element={<OrderPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <footer className="site-footer">
        <p>
          Basketful is a demo. The stores are made up, nothing is charged, and nobody is on their
          way with your groceries. Sorry about dinner.
        </p>
      </footer>
      <CartDrawer />
      <ProductDialog />
      <Toasts />
      <AgentPanel />
    </>
  );
}
