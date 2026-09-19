export const departments = [
  { id: "produce", name: "Produce", emoji: "🥕", hue: 120 },
  { id: "dairy", name: "Dairy & Eggs", emoji: "🥛", hue: 210 },
  { id: "bakery", name: "Bakery", emoji: "🥖", hue: 35 },
  { id: "meat", name: "Meat & Seafood", emoji: "🥩", hue: 5 },
  { id: "pantry", name: "Pantry", emoji: "🥫", hue: 25 },
  { id: "frozen", name: "Frozen", emoji: "🧊", hue: 195 },
  { id: "beverages", name: "Beverages", emoji: "🧃", hue: 280 },
  { id: "snacks", name: "Snacks", emoji: "🍿", hue: 50 },
  { id: "household", name: "Household", emoji: "🧻", hue: 250 },
];

export const departmentsById = Object.fromEntries(
  departments.map((d) => [d.id, d])
);

export const dietaryTags = ["organic", "vegan", "gluten-free", "dairy-free"];

// [id, name, dept, price, size, emoji, tags, description, keywords]
// `keywords` are extra search terms that don't appear in the name, so
// "soda" finds cola and "ground beef" finds what a taco night needs.
const rows = [
  // Produce
  ["banana", "Bananas", "produce", 0.29, "each", "🍌", ["vegan", "gluten-free", "dairy-free"], "Ripe-in-a-day yellow bananas, sold individually.", "fruit"],
  ["banana-organic", "Organic Bananas", "produce", 0.39, "each", "🍌", ["organic", "vegan", "gluten-free", "dairy-free"], "Fair-trade organic bananas, sold individually.", "fruit"],
  ["apple-honeycrisp", "Honeycrisp Apples", "produce", 1.49, "each", "🍎", ["vegan", "gluten-free", "dairy-free"], "Crisp, juicy, and sweet-tart. Great for snacking.", "fruit apple"],
  ["apple-granny", "Granny Smith Apples", "produce", 0.99, "each", "🍏", ["vegan", "gluten-free", "dairy-free"], "Tart green apples that hold their shape in pies.", "fruit apple baking"],
  ["avocado", "Hass Avocados", "produce", 1.79, "each", "🥑", ["vegan", "gluten-free", "dairy-free"], "Ready to eat in one to two days.", "guacamole taco"],
  ["lemon", "Lemons", "produce", 0.79, "each", "🍋", ["vegan", "gluten-free", "dairy-free"], "Bright, thin-skinned lemons.", "citrus"],
  ["lime", "Limes", "produce", 0.5, "each", "🟢", ["vegan", "gluten-free", "dairy-free"], "Juicy Persian limes.", "citrus taco margarita"],
  ["strawberries", "Strawberries", "produce", 4.99, "1 lb", "🍓", ["vegan", "gluten-free", "dairy-free"], "Sweet red strawberries, one pound clamshell.", "fruit berries"],
  ["blueberries", "Organic Blueberries", "produce", 5.49, "6 oz", "🫐", ["organic", "vegan", "gluten-free", "dairy-free"], "Plump organic blueberries.", "fruit berries"],
  ["raspberries", "Raspberries", "produce", 4.49, "6 oz", "🍇", ["vegan", "gluten-free", "dairy-free"], "Delicate red raspberries.", "fruit berries"],
  ["orange-navel", "Navel Oranges", "produce", 1.19, "each", "🍊", ["vegan", "gluten-free", "dairy-free"], "Seedless and easy to peel.", "fruit citrus"],
  ["tomato-vine", "Tomatoes on the Vine", "produce", 2.99, "1 lb", "🍅", ["vegan", "gluten-free", "dairy-free"], "Vine-ripened slicing tomatoes.", "salsa taco salad"],
  ["carrots", "Organic Carrots", "produce", 1.99, "1 lb bag", "🥕", ["organic", "vegan", "gluten-free", "dairy-free"], "Whole organic carrots.", "vegetable"],
  ["broccoli", "Broccoli Crowns", "produce", 2.49, "1 lb", "🥦", ["vegan", "gluten-free", "dairy-free"], "Fresh green broccoli crowns.", "vegetable"],
  ["spinach", "Organic Baby Spinach", "produce", 3.99, "5 oz", "🥬", ["organic", "vegan", "gluten-free", "dairy-free"], "Triple-washed and ready to eat.", "greens salad"],
  ["romaine", "Romaine Hearts", "produce", 3.49, "3 ct", "🥗", ["vegan", "gluten-free", "dairy-free"], "Crunchy romaine hearts.", "lettuce salad taco"],
  ["cucumber", "Cucumbers", "produce", 0.99, "each", "🥒", ["vegan", "gluten-free", "dairy-free"], "Cool, crisp slicing cucumbers.", "vegetable salad"],
  ["corn", "Sweet Corn", "produce", 0.69, "each", "🌽", ["vegan", "gluten-free", "dairy-free"], "Fresh ears of sweet corn.", "vegetable"],
  ["onion-yellow", "Yellow Onions", "produce", 1.29, "1 lb", "🧅", ["vegan", "gluten-free", "dairy-free"], "All-purpose cooking onions.", "vegetable taco"],
  ["garlic", "Garlic", "produce", 0.79, "1 head", "🧄", ["vegan", "gluten-free", "dairy-free"], "Whole heads of garlic.", "vegetable"],
  ["potato-russet", "Russet Potatoes", "produce", 3.99, "5 lb bag", "🥔", ["vegan", "gluten-free", "dairy-free"], "Fluffy bakers and mashers.", "vegetable"],
  ["sweet-potato", "Sweet Potatoes", "produce", 1.49, "1 lb", "🍠", ["vegan", "gluten-free", "dairy-free"], "Orange-fleshed sweet potatoes.", "vegetable yam"],
  ["bell-pepper", "Red Bell Peppers", "produce", 1.69, "each", "🫑", ["vegan", "gluten-free", "dairy-free"], "Sweet red bell peppers.", "vegetable fajita"],
  ["jalapeno", "Jalapeño Peppers", "produce", 0.25, "each", "🌶️", ["vegan", "gluten-free", "dairy-free"], "Medium-heat green chiles.", "spicy salsa taco"],
  ["mushrooms", "Cremini Mushrooms", "produce", 3.29, "8 oz", "🍄", ["vegan", "gluten-free", "dairy-free"], "Earthy baby bella mushrooms.", "vegetable"],
  ["cilantro", "Cilantro", "produce", 0.99, "bunch", "🌿", ["vegan", "gluten-free", "dairy-free"], "Fresh cilantro bunch.", "herb salsa taco"],
  ["basil", "Fresh Basil", "produce", 2.99, "bunch", "🌱", ["vegan", "gluten-free", "dairy-free"], "Sweet Genovese basil.", "herb pesto"],

  // Dairy & Eggs
  ["milk-whole", "Whole Milk", "dairy", 4.29, "1 gal", "🥛", ["gluten-free"], "Vitamin D whole milk.", ""],
  ["milk-2", "2% Reduced Fat Milk", "dairy", 4.29, "1 gal", "🥛", ["gluten-free"], "Reduced fat milk.", ""],
  ["oat-milk", "Oat Milk", "dairy", 4.99, "64 fl oz", "🌾", ["vegan", "dairy-free"], "Creamy original oat milk.", "plant milk non-dairy"],
  ["oat-milk-barista", "Barista Oat Milk", "dairy", 5.49, "32 fl oz", "🌾", ["vegan", "dairy-free"], "Steams and foams like dairy.", "plant milk latte non-dairy"],
  ["almond-milk", "Unsweetened Almond Milk", "dairy", 3.99, "64 fl oz", "🥛", ["vegan", "dairy-free", "gluten-free"], "Thirty calories a cup.", "plant milk non-dairy"],
  ["eggs-large", "Large Eggs", "dairy", 3.99, "12 ct", "🥚", ["gluten-free", "dairy-free"], "Grade A large white eggs.", "dozen"],
  ["eggs-pasture", "Pasture-Raised Eggs", "dairy", 7.49, "12 ct", "🥚", ["organic", "gluten-free", "dairy-free"], "Organic pasture-raised brown eggs.", "dozen"],
  ["butter", "Salted Butter", "dairy", 4.99, "1 lb", "🧈", ["gluten-free"], "Four quarter-pound sticks.", "baking"],
  ["butter-unsalted", "Unsalted Butter", "dairy", 4.99, "1 lb", "🧈", ["gluten-free"], "Four quarter-pound sticks for baking.", "baking"],
  ["cheddar", "Sharp Cheddar Cheese", "dairy", 5.49, "8 oz block", "🧀", ["gluten-free"], "Aged nine months.", ""],
  ["mexican-blend", "Shredded Mexican Blend Cheese", "dairy", 4.29, "8 oz", "🧀", ["gluten-free"], "Cheddar, jack, asadero, and queso quesadilla.", "taco quesadilla"],
  ["mozzarella", "Fresh Mozzarella", "dairy", 4.99, "8 oz", "🧀", ["gluten-free"], "Soft, milky mozzarella ball.", "pizza caprese"],
  ["goat-cheese", "Goat Cheese Log", "dairy", 5.99, "4 oz", "🧀", ["gluten-free"], "Tangy fresh chèvre.", "chevre"],
  ["greek-yogurt", "Plain Greek Yogurt", "dairy", 5.99, "32 oz", "🥣", ["gluten-free"], "Whole milk, strained thick.", ""],
  ["sour-cream", "Sour Cream", "dairy", 2.79, "16 oz", "🥣", ["gluten-free"], "Cultured sour cream.", "taco"],
  ["cream-cheese", "Cream Cheese", "dairy", 3.49, "8 oz", "🧀", ["gluten-free"], "Original brick cream cheese.", "bagel"],
  ["parmesan", "Parmesan Wedge", "dairy", 7.99, "8 oz", "🧀", ["gluten-free"], "Aged 24 months. Grate it yourself.", "parmigiano cheese pasta"],

  // Bakery
  ["sourdough", "Sourdough Loaf", "bakery", 5.99, "24 oz", "🍞", ["vegan", "dairy-free"], "Naturally leavened, baked this morning.", "bread"],
  ["wheat-bread", "Whole Wheat Sandwich Bread", "bakery", 3.79, "20 oz", "🍞", ["dairy-free"], "Soft sliced whole wheat.", "bread"],
  ["baguette", "French Baguette", "bakery", 2.99, "each", "🥖", ["vegan", "dairy-free"], "Crackly crust, airy crumb.", "bread"],
  ["croissants", "Butter Croissants", "bakery", 5.49, "4 ct", "🥐", [], "All-butter croissants.", "pastry"],
  ["bagels", "Everything Bagels", "bakery", 4.49, "6 ct", "🥯", ["vegan", "dairy-free"], "Kettle-boiled everything bagels.", ""],
  ["tortillas-flour", "Flour Tortillas", "bakery", 3.29, "10 ct", "🫓", ["vegan", "dairy-free"], "Soft taco size flour tortillas.", "taco burrito wrap"],
  ["tortillas-corn", "Corn Tortillas", "bakery", 2.79, "30 ct", "🫓", ["vegan", "gluten-free", "dairy-free"], "Street taco size white corn tortillas.", "taco"],
  ["muffins", "Blueberry Muffins", "bakery", 5.99, "4 ct", "🧁", [], "Jumbo bakery muffins.", "pastry"],
  ["cookies", "Chocolate Chip Cookies", "bakery", 4.99, "12 ct", "🍪", [], "Soft-baked bakery cookies.", "dessert"],

  // Meat & Seafood
  ["chicken-breast", "Boneless Chicken Breasts", "meat", 6.99, "1 lb", "🍗", ["gluten-free", "dairy-free"], "Skinless, air-chilled chicken breasts.", "poultry"],
  ["chicken-thighs", "Chicken Thighs", "meat", 4.49, "1 lb", "🍗", ["gluten-free", "dairy-free"], "Bone-in, skin-on thighs.", "poultry"],
  ["ground-beef", "Ground Beef 85% Lean", "meat", 6.49, "1 lb", "🥩", ["gluten-free", "dairy-free"], "Fresh ground chuck.", "hamburger taco mince"],
  ["ribeye", "Ribeye Steak", "meat", 17.99, "12 oz", "🥩", ["gluten-free", "dairy-free"], "USDA Choice, well marbled.", "beef"],
  ["bacon", "Thick-Cut Bacon", "meat", 7.99, "12 oz", "🥓", ["gluten-free", "dairy-free"], "Applewood smoked.", "pork breakfast"],
  ["ground-turkey", "Ground Turkey", "meat", 5.99, "1 lb", "🦃", ["gluten-free", "dairy-free"], "93% lean ground turkey.", "poultry taco"],
  ["hot-dogs", "Beef Hot Dogs", "meat", 5.49, "8 ct", "🌭", ["gluten-free", "dairy-free"], "Uncured all-beef franks.", "grill"],
  ["salmon", "Atlantic Salmon Fillet", "meat", 11.99, "1 lb", "🐟", ["gluten-free", "dairy-free"], "Fresh, skin-on fillet.", "fish seafood"],
  ["shrimp", "Large Raw Shrimp", "meat", 10.99, "1 lb", "🍤", ["gluten-free", "dairy-free"], "Peeled and deveined, tail on.", "seafood prawns"],

  // Pantry
  ["spaghetti", "Spaghetti", "pantry", 1.79, "16 oz", "🍝", ["vegan", "dairy-free"], "Bronze-cut durum wheat pasta.", "pasta noodles"],
  ["penne-gf", "Gluten-Free Penne", "pantry", 3.49, "12 oz", "🍝", ["vegan", "gluten-free", "dairy-free"], "Brown rice penne.", "pasta"],
  ["marinara", "Marinara Sauce", "pantry", 3.99, "24 oz", "🥫", ["vegan", "gluten-free", "dairy-free"], "Slow-simmered tomato and basil.", "pasta sauce tomato"],
  ["rice-jasmine", "Jasmine Rice", "pantry", 4.49, "2 lb", "🍚", ["vegan", "gluten-free", "dairy-free"], "Fragrant long-grain rice.", ""],
  ["black-beans", "Black Beans", "pantry", 1.19, "15 oz can", "🫘", ["vegan", "gluten-free", "dairy-free"], "Low-sodium canned black beans.", "taco burrito"],
  ["chickpeas", "Chickpeas", "pantry", 1.29, "15 oz can", "🫘", ["vegan", "gluten-free", "dairy-free"], "Garbanzo beans, ready to use.", "hummus garbanzo"],
  ["diced-tomatoes", "Diced Tomatoes", "pantry", 1.49, "14.5 oz can", "🥫", ["vegan", "gluten-free", "dairy-free"], "Fire-roasted diced tomatoes.", "chili"],
  ["salsa", "Medium Salsa", "pantry", 3.79, "16 oz", "🍅", ["vegan", "gluten-free", "dairy-free"], "Chunky restaurant-style salsa.", "taco chips dip"],
  ["taco-seasoning", "Taco Seasoning", "pantry", 1.29, "1 oz packet", "🌮", ["vegan", "dairy-free"], "Classic chili, cumin, and garlic blend.", "spice taco"],
  ["olive-oil", "Extra Virgin Olive Oil", "pantry", 9.99, "16.9 fl oz", "🫒", ["vegan", "gluten-free", "dairy-free"], "Cold-pressed, single origin.", "cooking oil"],
  ["sea-salt", "Sea Salt", "pantry", 2.99, "26 oz", "🧂", ["vegan", "gluten-free", "dairy-free"], "Fine-grain sea salt.", "spice"],
  ["black-pepper", "Black Pepper", "pantry", 4.49, "2 oz", "🧂", ["vegan", "gluten-free", "dairy-free"], "Coarse ground black pepper.", "spice peppercorn"],
  ["oregano", "Dried Oregano", "pantry", 3.49, "0.75 oz", "🌿", ["vegan", "gluten-free", "dairy-free"], "Mediterranean oregano, dried.", "spice herb"],
  ["cumin", "Ground Cumin", "pantry", 3.99, "2 oz", "🫙", ["vegan", "gluten-free", "dairy-free"], "Warm, earthy ground cumin.", "spice taco chili"],
  ["chili-flakes", "Red Pepper Flakes", "pantry", 3.29, "1.5 oz", "🌶️", ["vegan", "gluten-free", "dairy-free"], "Crushed red chile flakes.", "spice chili spicy"],
  ["honey", "Wildflower Honey", "pantry", 6.99, "12 oz", "🍯", ["gluten-free", "dairy-free"], "Raw and unfiltered.", "sweetener"],
  ["peanut-butter", "Creamy Peanut Butter", "pantry", 3.99, "16 oz", "🥜", ["vegan", "gluten-free", "dairy-free"], "Just peanuts and salt.", "pb sandwich"],
  ["oats", "Old-Fashioned Rolled Oats", "pantry", 4.29, "42 oz", "🥣", ["vegan", "dairy-free"], "Whole grain rolled oats.", "oatmeal breakfast"],
  ["cereal", "Honey Nut O's Cereal", "pantry", 4.79, "12 oz", "🥣", [], "Toasted oat cereal with honey.", "breakfast"],
  ["flour", "All-Purpose Flour", "pantry", 3.99, "5 lb", "🌾", ["vegan", "dairy-free"], "Unbleached all-purpose flour.", "baking"],
  ["sugar", "Granulated Sugar", "pantry", 3.49, "4 lb", "🍚", ["vegan", "gluten-free", "dairy-free"], "Pure cane sugar.", "baking sweetener"],

  // Frozen
  ["frozen-pizza-margherita", "Margherita Frozen Pizza", "frozen", 7.99, "15 oz", "🍕", [], "Wood-fired crust, mozzarella, basil.", "dinner"],
  ["frozen-pizza-pepperoni", "Pepperoni Frozen Pizza", "frozen", 7.49, "17 oz", "🍕", [], "Rising crust with uncured pepperoni.", "dinner"],
  ["ice-cream-vanilla", "Vanilla Bean Ice Cream", "frozen", 5.99, "1 pt", "🍨", ["gluten-free"], "Five ingredients, real vanilla.", "dessert"],
  ["ice-cream-chocolate", "Chocolate Fudge Ice Cream", "frozen", 5.99, "1 pt", "🍦", ["gluten-free"], "Dark chocolate with fudge ripple.", "dessert"],
  ["dumplings", "Pork & Chive Dumplings", "frozen", 6.49, "20 oz", "🥟", ["dairy-free"], "Pan-fry from frozen in ten minutes.", "potstickers gyoza"],
  ["fries", "Crinkle-Cut Fries", "frozen", 3.99, "32 oz", "🍟", ["vegan", "gluten-free", "dairy-free"], "Oven-crisp potato fries.", "potato"],
  ["frozen-peas", "Frozen Peas", "frozen", 2.29, "16 oz", "🫛", ["vegan", "gluten-free", "dairy-free"], "Sweet green peas.", "vegetable"],
  ["frozen-berries", "Frozen Mixed Berries", "frozen", 9.99, "3 lb", "🫐", ["vegan", "gluten-free", "dairy-free"], "Strawberries, blueberries, and raspberries.", "smoothie fruit"],

  // Beverages
  ["coffee-beans", "Medium Roast Coffee Beans", "beverages", 11.99, "12 oz", "☕", ["vegan", "gluten-free", "dairy-free"], "Whole bean, notes of caramel and citrus.", ""],
  ["green-tea", "Green Tea Bags", "beverages", 4.49, "20 ct", "🍵", ["vegan", "gluten-free", "dairy-free"], "Japanese sencha.", ""],
  ["orange-juice", "Orange Juice", "beverages", 5.49, "52 fl oz", "🧃", ["vegan", "gluten-free", "dairy-free"], "Not from concentrate, no pulp.", "oj breakfast"],
  ["sparkling-water", "Lime Sparkling Water", "beverages", 5.99, "12 pack", "🫧", ["vegan", "gluten-free", "dairy-free"], "Zero calories, zero sweeteners.", "seltzer soda"],
  ["cola", "Cola", "beverages", 7.99, "12 pack", "🥤", ["vegan", "gluten-free", "dairy-free"], "Classic cola in cans.", "soda pop"],
  ["kombucha", "Ginger Kombucha", "beverages", 3.99, "16 fl oz", "🧋", ["organic", "vegan", "gluten-free", "dairy-free"], "Raw and lightly fizzy.", ""],
  ["spring-water", "Spring Water", "beverages", 5.49, "24 pack", "💧", ["vegan", "gluten-free", "dairy-free"], "Half-liter bottles.", "bottled water"],

  // Snacks
  ["tortilla-chips", "Tortilla Chips", "snacks", 3.99, "13 oz", "🌽", ["vegan", "gluten-free", "dairy-free"], "Restaurant-style corn chips.", "taco salsa nachos"],
  ["potato-chips", "Kettle Potato Chips", "snacks", 4.29, "8 oz", "🥔", ["vegan", "gluten-free", "dairy-free"], "Sea salt kettle chips.", "crisps"],
  ["popcorn", "Sea Salt Popcorn", "snacks", 3.79, "5 oz", "🍿", ["vegan", "gluten-free", "dairy-free"], "Air-popped and lightly salted.", ""],
  ["dark-chocolate", "Dark Chocolate Bar 72%", "snacks", 3.49, "3 oz", "🍫", ["vegan", "gluten-free", "dairy-free"], "Single-origin cacao.", "candy dessert"],
  ["pretzels", "Pretzel Twists", "snacks", 3.29, "16 oz", "🥨", ["vegan", "dairy-free"], "Classic salted twists.", ""],
  ["mixed-nuts", "Roasted Mixed Nuts", "snacks", 8.99, "16 oz", "🌰", ["vegan", "gluten-free", "dairy-free"], "Cashews, almonds, pecans, and hazelnuts.", ""],
  ["granola-bars", "Oat & Honey Granola Bars", "snacks", 4.49, "12 ct", "🍘", ["dairy-free"], "Crunchy granola bars.", "breakfast"],
  ["hummus", "Classic Hummus", "snacks", 4.49, "10 oz", "🫘", ["vegan", "gluten-free", "dairy-free"], "Chickpeas, tahini, lemon.", "dip"],

  // Household
  ["paper-towels", "Paper Towels", "household", 8.99, "6 rolls", "🧻", [], "Select-a-size double rolls.", ""],
  ["toilet-paper", "Toilet Paper", "household", 9.99, "12 rolls", "🧻", [], "Soft two-ply mega rolls.", "bath tissue"],
  ["dish-soap", "Dish Soap", "household", 3.99, "19 fl oz", "🧼", [], "Cuts grease, gentle on hands.", "cleaning"],
  ["sponges", "Scrub Sponges", "household", 3.49, "3 ct", "🧽", [], "Non-scratch scrub sponges.", "cleaning"],
  ["laundry-detergent", "Laundry Detergent", "household", 12.99, "64 loads", "🧴", [], "Free and clear liquid detergent.", "cleaning"],
  ["trash-bags", "Tall Kitchen Trash Bags", "household", 7.49, "40 ct", "🗑️", [], "13-gallon drawstring bags.", "garbage"],
];

// How long something is good for once it's in your kitchen, in days. Pantry
// memory uses it to decide whether what you bought is probably still around.
const KEEPS_BY_DEPARTMENT = {
  produce: 7, dairy: 14, bakery: 5, meat: 3, pantry: 365, frozen: 180, beverages: 180, snacks: 90, household: 3650,
};
const KEEPS = {
  banana: 5, "banana-organic": 5, avocado: 5, strawberries: 4, blueberries: 5, raspberries: 3, spinach: 5,
  mushrooms: 5, cilantro: 5, basil: 5, corn: 4, "apple-honeycrisp": 28, "apple-granny": 28, lemon: 21, lime: 21,
  "orange-navel": 21, carrots: 28, "onion-yellow": 30, garlic: 45, "potato-russet": 30, "sweet-potato": 30,
  jalapeno: 10, "milk-whole": 10, "milk-2": 10, "oat-milk": 10, "oat-milk-barista": 10, "almond-milk": 10,
  "eggs-large": 28, "eggs-pasture": 28, butter: 60, "butter-unsalted": 60, cheddar: 30, parmesan: 45,
  "mexican-blend": 21, mozzarella: 7, "cream-cheese": 21, "tortillas-flour": 14, "tortillas-corn": 14,
  bacon: 10, "hot-dogs": 14, salmon: 2, shrimp: 2, "coffee-beans": 60, "orange-juice": 10, kombucha: 30,
  hummus: 10, "sea-salt": 1825, "black-pepper": 730, oregano: 730, cumin: 730, "chili-flakes": 730,
  "taco-seasoning": 730, honey: 1825, sugar: 730,
};

// Bought once, used many times. When one of these is within its shelf life we
// assume it's still in the cupboard. Everything else gets used up, so a recent
// purchase is a question ("still have the eggs?") rather than an assumption.
const LASTS_MANY_USES = new Set([
  "sea-salt", "black-pepper", "oregano", "cumin", "chili-flakes", "olive-oil", "honey", "flour", "sugar",
  "rice-jasmine", "oats", "peanut-butter", "coffee-beans", "green-tea",
]);

// Household goods are taxable; groceries are not.
const TAXABLE_DEPARTMENTS = new Set(["household"]);

export const products = rows.map(
  ([id, name, department, price, size, emoji, tags, description, keywords]) => ({
    id,
    name,
    department,
    price,
    size,
    emoji,
    tags,
    description,
    keywords,
    taxable: TAXABLE_DEPARTMENTS.has(department),
    keeps: KEEPS[id] ?? KEEPS_BY_DEPARTMENT[department],
    lastsManyUses: LASTS_MANY_USES.has(id),
  })
);

export const productsById = Object.fromEntries(products.map((p) => [p.id, p]));
