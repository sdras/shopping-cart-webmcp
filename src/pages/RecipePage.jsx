import { Link, useNavigate, useParams } from "react-router-dom";
import RecipePlanner from "../components/RecipePlanner.jsx";
import { recipesById } from "../data/recipes.js";
import { productsById } from "../data/products.js";
import { appStore, useApp, useOpenStore } from "../state/app.js";
import { deleteCustomRecipe } from "../state/appStore.js";

export default function RecipePage() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const shop = useOpenStore();
  const custom = useApp((s) => s.customRecipes);
  const recipe = recipesById[recipeId] ?? custom.find((r) => r.id === recipeId);

  if (!recipe) {
    return (
      <main id="main" className="page narrow empty-state">
        <h1>We couldn't find that recipe</h1>
        <p><Link to="/recipes" className="button">See all recipes</Link></p>
      </main>
    );
  }

  return (
    <main id="main" className="page recipe-page">
      <div className="recipe-main">
        <p><Link to="/recipes">← All recipes</Link></p>
        <header className="recipe-header">
          <span className="recipe-art large" aria-hidden="true">{recipe.emoji}</span>
          <div>
            <h1>{recipe.name}</h1>
            <p className="muted">
              {recipe.custom
                ? recipe.source === "agent" ? "Brought by your agent" : "Your recipe"
                : `${recipe.minutes} minutes · serves ${recipe.serves}`}
            </p>
            {recipe.blurb && <p>{recipe.blurb}</p>}
          </div>
        </header>

        <section aria-labelledby="ingredients-title">
          <h2 id="ingredients-title">Ingredients</h2>
          <ul className="ingredient-list">
            {recipe.ingredients.map((ingredient, i) => {
              const product = productsById[ingredient.productId];
              return (
                <li key={i}>
                  <span aria-hidden="true">{product?.emoji ?? "❓"}</span>
                  <span>
                    {recipe.custom ? ingredient.label : product.name}
                    {ingredient.amount && <span className="muted"> · {ingredient.amount}</span>}
                    {recipe.custom && (
                      <span className="muted"> → {product ? product.name : "not sold here"}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {recipe.steps && (
          <section aria-labelledby="steps-title">
            <h2 id="steps-title">Method</h2>
            <ol className="steps">
              {recipe.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </section>
        )}

        {recipe.custom && (
          <p>
            <button
              type="button"
              className="link-button muted"
              onClick={() => {
                deleteCustomRecipe(appStore, recipe.id);
                navigate("/recipes");
              }}
            >
              Delete this recipe
            </button>
          </p>
        )}
      </div>

      <aside className="recipe-side">
        {shop ? (
          <RecipePlanner key={recipe.id} recipe={recipe} shop={shop} />
        ) : (
          <section className="planner">
            <h2>What you need to buy</h2>
            <p className="muted">Choose a store and we'll check this against your cart and what you've bought before.</p>
            <p><Link to="/" className="button">Choose a store</Link></p>
          </section>
        )}
      </aside>
    </main>
  );
}
