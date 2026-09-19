import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard.jsx";
import StartWithUsual from "../components/StartWithUsual.jsx";
import { BoltIcon, ChevronIcon, HomeIcon, ReceiptIcon, StarIcon } from "../components/icons.jsx";
import { storesById } from "../data/stores.js";
import { products, productsById, departments, departmentsById, dietaryTags } from "../data/products.js";
import { searchProducts } from "../lib/catalog.js";
import { appStore, useApp, useCart } from "../state/app.js";
import { selectStore } from "../state/appStore.js";
import { addAllStaples } from "../state/stapleActions.js";
import { money, plural } from "../lib/format.js";

function Sidebar({ shop, activeDept, browsing }) {
  return (
    <aside className="store-sidebar">
      <div className="store-identity" style={{ "--hue": shop.hue }}>
        <span className="store-logo" aria-hidden="true">{shop.emoji}</span>
        <h1>{shop.name}</h1>
        <p className="muted">{shop.tagline}</p>
        <p className="eta"><BoltIcon />Delivery in about {shop.eta}</p>
        <ul className="store-facts">
          <li>{money(shop.deliveryFee)} delivery, free over {money(shop.freeDeliveryOver)}</li>
          <li>{money(shop.minimumOrder)} minimum order</li>
        </ul>
        <Link to="/" className="text-link">Change store</Link>
      </div>
      <nav aria-label="Store">
        <ul className="side-nav">
          <li>
            <Link to={`/store/${shop.id}`} aria-current={browsing ? "page" : undefined}>
              <HomeIcon />Shop
            </Link>
          </li>
          <li>
            <Link to="/usuals">
              <StarIcon size={20} />Your usuals
            </Link>
          </li>
          <li>
            <Link to="/orders">
              <ReceiptIcon />Orders
            </Link>
          </li>
        </ul>
        <h2 className="side-heading" id="aisles-heading">Browse aisles</h2>
        <ul className="side-nav aisles" aria-labelledby="aisles-heading">
          {departments.map((d) => (
            <li key={d.id}>
              <Link
                to={`/store/${shop.id}?dept=${d.id}`}
                aria-current={activeDept === d.id ? "page" : undefined}
              >
                {d.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function Shelf({ id, title, link, linkLabel = "View more", action, items, shop, cart }) {
  const rowRef = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    setEdges({
      start: row.scrollLeft <= 4,
      end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [measure, items.length]);

  if (items.length === 0) return null;

  const page = (direction) =>
    rowRef.current.scrollBy({ left: direction * rowRef.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <section className="shelf" aria-labelledby={`shelf-${id}`}>
      <header>
        <h2 id={`shelf-${id}`}>{title}</h2>
        <div className="shelf-controls">
          {action}
          {link && (
            <Link to={link} className="text-link">
              {linkLabel}<ChevronIcon size={14} />
            </Link>
          )}
          <button type="button" className="round-button" disabled={edges.start} onClick={() => page(-1)} aria-label={`Scroll ${title} back`}>
            <ChevronIcon direction="left" />
          </button>
          <button type="button" className="round-button" disabled={edges.end} onClick={() => page(1)} aria-label={`Scroll ${title} forward`}>
            <ChevronIcon />
          </button>
        </div>
      </header>
      <div className="shelf-row" ref={rowRef} onScroll={measure} tabIndex={0} role="group" aria-label={`${title} products`}>
        {items.map((p) => (
          <ProductCard key={p.id} shop={shop} product={p} quantity={cart[p.id] ?? 0} />
        ))}
      </div>
    </section>
  );
}

function DietFilters({ active, onToggle }) {
  return (
    <div className="chips" role="group" aria-label="Dietary filters">
      {dietaryTags.map((tag) => (
        <button
          key={tag}
          type="button"
          className="chip"
          aria-pressed={active.includes(tag)}
          onClick={() => onToggle(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}

export default function StorefrontPage() {
  const { storeId } = useParams();
  const shop = storesById[storeId];
  const [params, setParams] = useSearchParams();
  const cart = useCart(storeId);
  const orders = useApp((s) => s.orders);

  useEffect(() => {
    if (shop) selectStore(appStore, shop.id);
  }, [shop]);

  const query = params.get("q") ?? "";
  const dept = departmentsById[params.get("dept")] ?? null;
  const diet = (params.get("diet") ?? "").split(",").filter((t) => dietaryTags.includes(t));
  const dietKey = diet.join(",");
  const maxPrice = Number(params.get("max")) > 0 ? Number(params.get("max")) : undefined;
  const browsing = !query && !dept && diet.length === 0 && maxPrice == null;

  const results = useMemo(
    () =>
      shop && !browsing
        ? searchProducts({ query, department: dept?.id, dietary: dietKey ? dietKey.split(",") : [], maxPrice, store: shop })
        : [],
    [shop, browsing, query, dept, dietKey, maxPrice]
  );

  const staples = useApp((s) => s.staples);
  const stapleProducts = useMemo(
    () => Object.keys(staples).map((id) => productsById[id]).filter(Boolean),
    [staples]
  );

  const buyAgain = useMemo(() => {
    const ids = new Set(orders.flatMap((o) => o.items.map((i) => i.id)));
    return [...ids].map((id) => productsById[id]).filter(Boolean).slice(0, 12);
  }, [orders]);

  if (!shop) {
    return (
      <main id="main" className="page narrow empty-state">
        <h1>We couldn't find that store</h1>
        <p><Link to="/" className="button">See all stores</Link></p>
      </main>
    );
  }

  function toggleDiet(tag) {
    const next = diet.includes(tag) ? diet.filter((t) => t !== tag) : [...diet, tag];
    const updated = new URLSearchParams(params);
    if (next.length) updated.set("diet", next.join(","));
    else updated.delete("diet");
    setParams(updated);
  }

  let heading = dept ? dept.name : "All products";
  if (query) heading = `Results for “${query}”${dept ? ` in ${dept.name}` : ""}`;

  return (
    <div className="storefront">
      <Sidebar shop={shop} activeDept={dept?.id} browsing={browsing} />
      <main id="main" className="storefront-main">
        {browsing ? (
          <>
            <StartWithUsual shop={shop} />
            <Shelf
              id="staples"
              title="Your usuals"
              link="/usuals"
              linkLabel="Edit list"
              action={
                Object.keys(cart).length > 0 && (
                  <button type="button" className="button small" onClick={() => addAllStaples(shop)}>
                    Add my usuals
                  </button>
                )
              }
              items={stapleProducts}
              shop={shop}
              cart={cart}
            />
            <Shelf id="again" title="Buy it again" items={buyAgain} shop={shop} cart={cart} />
            {departments.map((d) => (
              <Shelf
                key={d.id}
                id={d.id}
                title={d.name}
                link={`/store/${shop.id}?dept=${d.id}`}
                items={products.filter((p) => p.department === d.id).slice(0, 10)}
                shop={shop}
                cart={cart}
              />
            ))}
          </>
        ) : (
          <section aria-labelledby="results-title">
            <header className="results-header">
              <div>
                <h2 id="results-title">{heading}</h2>
                <p className="muted" role="status">
                  {plural(results.length, "result")}
                  {maxPrice != null && ` under ${money(maxPrice)}`}
                </p>
              </div>
              <DietFilters active={diet} onToggle={toggleDiet} />
            </header>
            {results.length > 0 ? (
              <div className="product-grid">
                {results.map((p) => (
                  <ProductCard key={p.id} shop={shop} product={p} quantity={cart[p.id] ?? 0} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p className="empty-emoji" aria-hidden="true">🔍</p>
                <p>Nothing matched. Try a simpler search, or drop a filter.</p>
                <p><Link to={`/store/${shop.id}`} className="button secondary">Back to all aisles</Link></p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
