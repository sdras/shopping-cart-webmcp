import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useOpenStore, useCartTotals } from "../state/app.js";
import { openCart } from "../state/uiStore.js";
import { money, plural } from "../lib/format.js";

function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Basketful home">
      <svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="var(--brand)" />
        <path d="M20 28c0-8 5-14 12-14s12 6 12 14" fill="none" stroke="var(--peach)" strokeWidth="4" strokeLinecap="round" />
        <path d="M13 28h38l-4 19a5 5 0 0 1-5 4H22a5 5 0 0 1-5-4z" fill="#fff8ec" />
        <path d="M25 35v9M32 35v9M39 35v9" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span>Basketful</span>
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
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        id="site-search"
        type="search"
        name="q"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Search ${shop.name}`}
        autoComplete="off"
      />
    </form>
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
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M3 4h2.5l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.4-1.1L20.5 8H6.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="19.5" r="1.5" fill="currentColor" />
        <circle cx="17" cy="19.5" r="1.5" fill="currentColor" />
      </svg>
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
        {shop ? (
          <>
            <Link to="/" className="store-pill" aria-label={`Shopping at ${shop.name}. Change store`}>
              <span aria-hidden="true">{shop.emoji}</span>
              <span className="store-pill-name">{shop.name}</span>
              <span className="store-pill-change" aria-hidden="true">Change</span>
            </Link>
            <SearchBox shop={shop} />
          </>
        ) : (
          <span className="header-spacer" />
        )}
        <nav aria-label="Account">
          <NavLink to="/orders" className="nav-link">Orders</NavLink>
        </nav>
        {shop && <CartButton shop={shop} />}
      </div>
    </header>
  );
}
