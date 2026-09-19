import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SampleHistory from "../components/SampleHistory.jsx";
import { recipes } from "../data/recipes.js";
import { buildCustomRecipe } from "../lib/recipes.js";
import { appStore, useApp } from "../state/app.js";
import { saveCustomRecipe } from "../state/appStore.js";
import { plural } from "../lib/format.js";

function RecipeCard({ recipe }) {
  return (
    <Link to={`/recipes/${recipe.id}`} className="recipe-card">
      <span className="recipe-art" aria-hidden="true">{recipe.emoji}</span>
      <span className="recipe-card-text">
        <span className="store-name">{recipe.name}</span>
        <span className="muted">
          {recipe.custom
            ? recipe.source === "agent" ? "Brought by your agent" : "Your recipe"
            : `${recipe.minutes} min · serves ${recipe.serves}`}
          {" · "}
          {plural(recipe.ingredients.length, "ingredient")}
        </span>
      </span>
    </Link>
  );
}

function AddYourOwn() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lines = String(form.get("ingredients")).split("\n").filter((line) => line.trim());
    const recipe = buildCustomRecipe(form.get("name"), lines);
    if (!recipe.ingredients.some((ingredient) => ingredient.productId)) {
      setError("We couldn't match any of those to something we sell. One ingredient per line works best.");
      return;
    }
    saveCustomRecipe(appStore, recipe);
    navigate(`/recipes/${recipe.id}`);
  }

  return (
    <form className="own-recipe" onSubmit={submit}>
      <h2>Cooking something else?</h2>
      <p className="muted">Paste the ingredient list from any recipe, one per line. We'll work out what you need to buy.</p>
      <div className="field">
        <label htmlFor="recipe-name">What is it?</label>
        <input id="recipe-name" name="name" placeholder="Grandma's salsa" autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="recipe-ingredients">Ingredients</label>
        <textarea
          id="recipe-ingredients"
          name="ingredients"
          rows={7}
          required
          placeholder={"4 ripe tomatoes, diced\n1/2 onion\n2 cloves garlic\n1 jalapeño\njuice of 1 lime\na handful of cilantro\nsalt"}
        />
      </div>
      <div className="form-actions">
        <button type="submit" className="button">See what I need</button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </form>
  );
}

export default function RecipesPage() {
  const custom = useApp((s) => s.customRecipes);

  return (
    <main id="main" className="page">
      <header>
        <h1>Recipes</h1>
        <p className="muted">
          Pick one and we'll add what you're missing: not what's in your cart, and not the oregano you bought in July.
        </p>
      </header>

      <ul className="recipe-grid">
        {recipes.map((recipe) => (
          <li key={recipe.id}><RecipeCard recipe={recipe} /></li>
        ))}
      </ul>

      {custom.length > 0 && (
        <section aria-labelledby="your-recipes">
          <h2 id="your-recipes" className="section-title">Your recipes</h2>
          <ul className="recipe-grid">
            {custom.map((recipe) => (
              <li key={recipe.id}><RecipeCard recipe={recipe} /></li>
            ))}
          </ul>
        </section>
      )}

      <AddYourOwn />
      <SampleHistory />
    </main>
  );
}
