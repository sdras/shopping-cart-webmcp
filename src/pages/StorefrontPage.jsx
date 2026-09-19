import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard.jsx";
import { storesById } from "../data/stores.js";
import { products, productsById, departments, departmentsById, dietaryTags } from "../data/products.js";
import { searchProducts } from "../lib/catalog.js";
import { appStore, useApp, useCart } from "../state/app.js";
import { selectStore } from "../state/appStore.js";
import { money, plural } from "../lib/format.js";

function Sidebar({ shop, activeDept, browsing }) {
  return (
    <aside className="store-sidebar">
      <div className="store-identity" style={{ "--hue": shop.hue }}>
        <span className="store-logo" aria-hidden="true">{shop.emoji}</span>
        <h1>{shop.name}</h1>
        <p className="muted">{shop.tagline}</p>
        <ul className="store-facts">
          <li><span className="emoji" aria-hidden="true">⚡</span>Delivery in about {shop.eta}</li>
          <li>{money(shop.deliveryFee)} delivery, free over {money(shop.freeDeliveryOver)}</li>
          <li>{money(shop.minimumOrder)} minimum</li>
        </ul>
      </div>
      <nav aria-label="Departments">
        <ul className="dept-nav">
          <li>
            <Link to={`/store/${shop.id}`} aria-current={browsing ? "page" : undefined}>
              <span className="emoji" aria-hidden="true">🏠</span>Shop
            </Link>
          </li>
          {departments.map((d) => (
            <li key={d.id}>
              <Link
                to={`/store/${shop.id}?dept=${d.id}`}
                aria-current={activeDept === d.id ? "page" : undefined}
              >
                <span className="emoji" aria-hidden="true">{d.emoji}</span>{d.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function Shelf({ id, title, link, items, shop, cart }) {
  if (items.length === 0) return null;
  return (
    <section className="shelf" aria-labelledby={`shelf-${id}`}>
      <header>
        <h2 id={`shelf-${id}`}>{title}</h2>
        {link && <Link to={link}>View all</Link>}
      </header>
      <div className="shelf-row" tabIndex={0} role="group" aria-label={`${title} products`}>
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
                  {plural(results.length, "product")}
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
