import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { SearchIcon, CartIcon, PinIcon } from "./icons.jsx";
import { useApp, useOpenStore, useCartTotals } from "../state/app.js";
import { isAddressComplete } from "../state/appStore.js";
import { openCart } from "../state/uiStore.js";
import { money, plural } from "../lib/format.js";

function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Basketful home">
      <svg viewBox="0 0 64 64" width="32" height="32" aria-hidden="true">
        <path d="M20 27c0-8 5-14 12-14s12 6 12 14" fill="none" stroke="var(--carrot)" strokeWidth="5" strokeLinecap="round" />
        <path d="M10 26h44l-4.5 22a6 6 0 0 1-5.9 4.8H20.4a6 6 0 0 1-5.9-4.8z" fill="var(--brand)" />
        <path d="M24 34v10M32 34v10M40 34v10" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
      <span>basketful</span>
    </Link>
  );
}

function SearchBox({ shop }) {
  const navigate = useNavigate();
  const location = useLocation();
  const urlQuery = new URLSearchParams(location.search).get("q") ?? "";
  const [text, setText] = useState(urlQuery);

  // Keep the box honest when an agent (or the back button) changes the search.
  useEffect(() => setText(urlQuery), [urlQuery]);

  function submit(event) {
    event.preventDefault();
    const query = text.trim();
    navigate(query ? `/store/${shop.id}?q=${encodeURIComponent(query)}` : `/store/${shop.id}`);
  }

  return (
    <form className="search" role="search" onSubmit={submit}>
      <label htmlFor="site-search" className="visually-hidden">
        Search {shop.name}
      </label>
      <SearchIcon />
      <input
        id="site-search"
        type="search"
        name="q"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Search ${shop.name}...`}
        autoComplete="off"
      />
    </form>
  );
}

function DeliveryInfo({ shop }) {
  const address = useApp((s) => s.address);
  if (!shop && !isAddressComplete(address)) return null;
  return (
    <p className="delivery-info">
      <PinIcon />
      <span>
        <span className="delivery-info-label">Delivery</span>
        <strong>{isAddressComplete(address) ? address.street : `in about ${shop.eta}`}</strong>
      </span>
    </p>
  );
}

function CartButton({ shop }) {
  const totals = useCartTotals(shop);
  return (
    <button
      type="button"
      className="cart-button"
      onClick={openCart}
      aria-label={`Open cart: ${plural(totals.itemCount, "item")}, ${money(totals.subtotal)}`}
    >
      <CartIcon />
      {/* Re-keyed so the bump animation replays whenever the count changes. */}
      <span key={totals.itemCount} className="cart-count">{totals.itemCount}</span>
    </button>
  );
}

export default function Header() {
  const shop = useOpenStore();
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Logo />
        {shop ? <SearchBox shop={shop} /> : <span className="header-spacer" />}
        <DeliveryInfo shop={shop} />
        <nav aria-label="Account">
          <NavLink to="/recipes" className="nav-link">Recipes</NavLink>
          <NavLink to="/orders" className="nav-link">Orders</NavLink>
        </nav>
        {shop && <CartButton shop={shop} />}
      </div>
    </header>
  );
}
