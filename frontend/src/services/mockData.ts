export const CATEGORIES = [
  // Fast Food Section
  { id: "CAT-01", name: "Pizza", itemsCount: 10, status: "Active", menuContext: "Fast Food" },
  { id: "CAT-02", name: "Premium Pizza", itemsCount: 8, status: "Active", menuContext: "Fast Food" },
  { id: "CAT-03", name: "Square Pizza", itemsCount: 1, status: "Active", menuContext: "Fast Food" },
  { id: "CAT-04", name: "Burgers", itemsCount: 9, status: "Active", menuContext: "Fast Food" },
  { id: "CAT-05", name: "Pratha Rolls", itemsCount: 4, status: "Active", menuContext: "Fast Food" },
  { id: "CAT-06", name: "Special Rolls", itemsCount: 2, status: "Active", menuContext: "Fast Food" },
  { id: "CAT-07", name: "Pasta", itemsCount: 1, status: "Active", menuContext: "Fast Food" },
  { id: "CAT-08", name: "Appetizers", itemsCount: 5, status: "Active", menuContext: "Fast Food" },
  { id: "CAT-09", name: "Sandwich", itemsCount: 3, status: "Active", menuContext: "Fast Food" },
  { id: "CAT-10", name: "Shawarma", itemsCount: 5, status: "Active", menuContext: "Fast Food" },

  // Deals Section
  { id: "CAT-D1", name: "Pizza Deals", itemsCount: 9, status: "Active", menuContext: "Deals" },
  { id: "CAT-D2", name: "Burger Deals", itemsCount: 9, status: "Active", menuContext: "Deals" },
  { id: "CAT-D3", name: "Combo Deals", itemsCount: 9, status: "Active", menuContext: "Deals" },
  { id: "CAT-D4", name: "Special Deals", itemsCount: 9, status: "Active", menuContext: "Deals" },

  // Restaurant Section
  { id: "CAT-R01", name: "Broast", itemsCount: 2, status: "Active", menuContext: "Restaurant" },
  { id: "CAT-R02", name: "Starters", itemsCount: 4, status: "Active", menuContext: "Restaurant" },
  { id: "CAT-R03", name: "Soups", itemsCount: 4, status: "Active", menuContext: "Restaurant" },
  { id: "CAT-R04", name: "Bar-B-Q Platters", itemsCount: 2, status: "Active", menuContext: "Restaurant" },
  { id: "CAT-R05", name: "Salads", itemsCount: 6, status: "Active", menuContext: "Restaurant" },
  { id: "CAT-R06", name: "Tandoor", itemsCount: 9, status: "Active", menuContext: "Restaurant" },
  { id: "CAT-R07", name: "Hot & Cold Drinks", itemsCount: 10, status: "Active", menuContext: "Restaurant" },
  { id: "CAT-R08", name: "Rices", itemsCount: 9, status: "Active", menuContext: "Restaurant" },
  { id: "CAT-R09", name: "Chinese Gravy", itemsCount: 4, status: "Active", menuContext: "Restaurant" },
  { id: "CAT-R10", name: "Noodles", itemsCount: 3, status: "Active", menuContext: "Restaurant" },
  { id: "CAT-R11", name: "Special Drinks", itemsCount: 9, status: "Active", menuContext: "Restaurant" },
  { id: "CAT-R12", name: "Ice Cream", itemsCount: 4, status: "Active", menuContext: "Restaurant" },
  { id: "CAT-R13", name: "Mutton", itemsCount: 11, status: "Active", menuContext: "Restaurant" },
  { id: "CAT-R14", name: "Beef", itemsCount: 5, status: "Active", menuContext: "Restaurant" },
  { id: "CAT-R15", name: "Chicken", itemsCount: 21, status: "Active", menuContext: "Restaurant" },
  { id: "CAT-R16", name: "Bar BQ", itemsCount: 17, status: "Active", menuContext: "Restaurant" }
]

const modifierGroups = {
  Pizza: [
    { name: "Extra Topping (Small)", price: 100 },
    { name: "Extra Topping (Medium)", price: 150 },
    { name: "Extra Topping (Large)", price: 200 },
    { name: "Extra Topping (XL)", price: 250 },
  ],
  Burgers: [
    { name: "Extra Cheese", price: 50 },
    { name: "Add Fries", price: 100 },
    { name: "Extra Patty", price: 150 },
  ],
  Shawarma: [
    { name: "Extra Meat", price: 100 },
    { name: "Extra Cheese", price: 50 },
    { name: "Extra Sauce", price: 30 },
  ],
  Appetizers: [
    { name: "Extra White Sauce", price: 50 },
  ]
}

export const PRODUCTS = [
  // ==========================================
  // FAST FOOD SECTION
  // ==========================================

  // --- Pizza Menu (Regular Pizza S / M / L / XL) ---
  { id: "p1", code: "1001", name: "Chicken Tikka Pizza", category: "Pizza", kitchen: "Fast Food", price: 1050, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 600 }, { name: "Medium", price: 1050 }, { name: "Large", price: 1500 }, { name: "X-Large", price: 2000 }] },
  { id: "p2", code: "1002", name: "Chicken Fajita Pizza", category: "Pizza", kitchen: "Fast Food", price: 1050, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 600 }, { name: "Medium", price: 1050 }, { name: "Large", price: 1500 }, { name: "X-Large", price: 2000 }] },
  { id: "p3", code: "1003", name: "Shahi Pizza", category: "Pizza", kitchen: "Fast Food", price: 1050, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 600 }, { name: "Medium", price: 1050 }, { name: "Large", price: 1500 }, { name: "X-Large", price: 2000 }] },
  { id: "p4", code: "1004", name: "Bone Fire Pizza", category: "Pizza", kitchen: "Fast Food", price: 1050, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 600 }, { name: "Medium", price: 1050 }, { name: "Large", price: 1500 }, { name: "X-Large", price: 2000 }] },
  { id: "p5", code: "1005", name: "Max Pizza", category: "Pizza", kitchen: "Fast Food", price: 1050, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 600 }, { name: "Medium", price: 1050 }, { name: "Large", price: 1500 }, { name: "X-Large", price: 2000 }] },
  { id: "p6", code: "1006", name: "Vegetable Pizza", category: "Pizza", kitchen: "Fast Food", price: 1050, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 600 }, { name: "Medium", price: 1050 }, { name: "Large", price: 1500 }, { name: "X-Large", price: 2000 }] },
  { id: "p7", code: "1007", name: "Chicken Supreme Pizza", category: "Pizza", kitchen: "Fast Food", price: 1050, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 600 }, { name: "Medium", price: 1050 }, { name: "Large", price: 1500 }, { name: "X-Large", price: 2000 }] },
  { id: "p8", code: "1008", name: "Chicken Achari Pizza", category: "Pizza", kitchen: "Fast Food", price: 1050, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 600 }, { name: "Medium", price: 1050 }, { name: "Large", price: 1500 }, { name: "X-Large", price: 2000 }] },
  { id: "p9", code: "1009", name: "Chicken Tandoori Pizza", category: "Pizza", kitchen: "Fast Food", price: 1050, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 600 }, { name: "Medium", price: 1050 }, { name: "Large", price: 1500 }, { name: "X-Large", price: 2000 }] },
  { id: "p10", code: "1010", name: "Hot & Spicy Pizza", category: "Pizza", kitchen: "Fast Food", price: 1050, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 600 }, { name: "Medium", price: 1050 }, { name: "Large", price: 1500 }, { name: "X-Large", price: 2000 }] },

  // --- Premium Pizza (S / M / L / XL) ---
  { id: "pp1", code: "1101", name: "Malai Boti Pizza", category: "Premium Pizza", kitchen: "Fast Food", price: 1150, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 700 }, { name: "Medium", price: 1150 }, { name: "Large", price: 1650 }, { name: "X-Large", price: 2200 }] },
  { id: "pp2", code: "1102", name: "Cheesy Lover Pizza", category: "Premium Pizza", kitchen: "Fast Food", price: 1150, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 700 }, { name: "Medium", price: 1150 }, { name: "Large", price: 1650 }, { name: "X-Large", price: 2200 }] },
  { id: "pp3", code: "1103", name: "Special Lazania Pizza", category: "Premium Pizza", kitchen: "Fast Food", price: 1150, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 700 }, { name: "Medium", price: 1150 }, { name: "Large", price: 1650 }, { name: "X-Large", price: 2200 }] },
  { id: "pp4", code: "1104", name: "Behari Kabab Pizza", category: "Premium Pizza", kitchen: "Fast Food", price: 1150, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 700 }, { name: "Medium", price: 1150 }, { name: "Large", price: 1650 }, { name: "X-Large", price: 2200 }] },
  { id: "pp5", code: "1105", name: "Dubai Special Pizza", category: "Premium Pizza", kitchen: "Fast Food", price: 1150, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 700 }, { name: "Medium", price: 1150 }, { name: "Large", price: 1650 }, { name: "X-Large", price: 2200 }] },
  { id: "pp6", code: "1106", name: "Kabab Crown Crust Pizza", category: "Premium Pizza", kitchen: "Fast Food", price: 1150, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 700 }, { name: "Medium", price: 1150 }, { name: "Large", price: 1650 }, { name: "X-Large", price: 2200 }] },
  { id: "pp7", code: "1107", name: "Afghani Malai Boti Pizza", category: "Premium Pizza", kitchen: "Fast Food", price: 1150, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 700 }, { name: "Medium", price: 1150 }, { name: "Large", price: 1650 }, { name: "X-Large", price: 2200 }] },
  { id: "pp8", code: "1108", name: "BBQ Pizza", category: "Premium Pizza", kitchen: "Fast Food", price: 1150, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 700 }, { name: "Medium", price: 1150 }, { name: "Large", price: 1650 }, { name: "X-Large", price: 2200 }] },

  // --- Square Pizza (Special Edition) ---
  { id: "sp1", code: "1201", name: "Square Pizza (Special Edition)", category: "Square Pizza", kitchen: "Fast Food", price: 1350, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Pizza, image: undefined, sizes: [{ name: "Small", price: 750 }, { name: "Medium", price: 1350 }, { name: "Large", price: 1750 }] },

  // --- Burgers ---
  { id: "b1", code: "2001", name: "Zinger Burger", category: "Burgers", kitchen: "Fast Food", price: 350, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Burgers, image: undefined },
  { id: "b2", code: "2002", name: "Grilled Burger", category: "Burgers", kitchen: "Fast Food", price: 380, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: modifierGroups.Burgers, image: undefined },
  { id: "b3", code: "2003", name: "Chicken Burger", category: "Burgers", kitchen: "Fast Food", price: 180, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: modifierGroups.Burgers, image: undefined },
  { id: "b4", code: "2004", name: "Chapli Kabab Burger", category: "Burgers", kitchen: "Fast Food", price: 300, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Burgers, image: undefined },
  { id: "b5", code: "2005", name: "Tower Burger", category: "Burgers", kitchen: "Fast Food", price: 550, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Burgers, image: undefined },
  { id: "b6", code: "2006", name: "Patty Burger", category: "Burgers", kitchen: "Fast Food", price: 260, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: modifierGroups.Burgers, image: undefined },
  { id: "b7", code: "2007", name: "Turkish Burger", category: "Burgers", kitchen: "Fast Food", price: 260, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: modifierGroups.Burgers, image: undefined },
  { id: "b8", code: "2008", name: "Pizza Burger", category: "Burgers", kitchen: "Fast Food", price: 520, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Burgers, image: undefined },
  { id: "b9", code: "2009", name: "Double Decker Burger", category: "Burgers", kitchen: "Fast Food", price: 550, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Burgers, image: undefined },

  // --- Pratha Rolls ---
  { id: "r1", code: "3001", name: "Zinger Pratha Roll", category: "Pratha Rolls", kitchen: "Fast Food", price: 300, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [], image: undefined },
  { id: "r2", code: "3002", name: "Chicken Pratha Roll", category: "Pratha Rolls", kitchen: "Fast Food", price: 300, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: [], image: undefined },
  { id: "r3", code: "3003", name: "Turkish Pratha Roll", category: "Pratha Rolls", kitchen: "Fast Food", price: 300, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "r4", code: "3004", name: "Kabab Pratha Roll", category: "Pratha Rolls", kitchen: "Fast Food", price: 300, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [], image: undefined },

  // --- Special Rolls ---
  { id: "sr1", code: "3101", name: "Italian Roll", category: "Special Rolls", kitchen: "Fast Food", price: 500, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [], image: undefined },
  { id: "sr2", code: "3102", name: "Malai Boti Roll", category: "Special Rolls", kitchen: "Fast Food", price: 550, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [], image: undefined },

  // --- Pasta ---
  { id: "ps1", code: "4000", name: "Chicken Cheese Pasta", category: "Pasta", kitchen: "Fast Food", price: 750, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [], image: undefined, sizes: [{ name: "Small", price: 500 }, { name: "Large", price: 750 }] },

  // --- Appetizers ---
  { id: "a1", code: "5001", name: "Chicken Hot Wings", category: "Appetizers", kitchen: "Fast Food", price: 420, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Appetizers, image: undefined, sizes: [{ name: "6 pcs", price: 420 }, { name: "12 pcs", price: 840 }] },
  { id: "a3", code: "5003", name: "Nuggets (10 pcs)", category: "Appetizers", kitchen: "Fast Food", price: 600, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: modifierGroups.Appetizers, image: undefined },
  { id: "a4", code: "5004", name: "French fries", category: "Appetizers", kitchen: "Fast Food", price: 250, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: modifierGroups.Appetizers, image: undefined, sizes: [{ name: "Small", price: 150 }, { name: "Medium", price: 250 }, { name: "Large", price: 300 }] },
  { id: "a5", code: "5005", name: "Potato Chips", category: "Appetizers", kitchen: "Fast Food", price: 200, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: modifierGroups.Appetizers, image: undefined },
  { id: "a7", code: "5007", name: "Loaded Fries", category: "Appetizers", kitchen: "Fast Food", price: 750, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Appetizers, image: undefined },
  { id: "a8", code: "5008", name: "White Sauce", category: "Appetizers", kitchen: "Fast Food", price: 50, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },

  // --- Sandwich ---
  { id: "s1", code: "6001", name: "Turkish Sandwich", category: "Sandwich", kitchen: "Fast Food", price: 300, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: [], image: undefined },
  { id: "s2", code: "6002", name: "Chicken Club Sandwich", category: "Sandwich", kitchen: "Fast Food", price: 300, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [], image: undefined },
  { id: "s3", code: "6003", name: "Grilled Cheesy Sandwich", category: "Sandwich", kitchen: "Fast Food", price: 520, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [], image: undefined },

  // --- Shawarma ---
  { id: "sh1", code: "7001", name: "Turkish Shawarma", category: "Shawarma", kitchen: "Fast Food", price: 200, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: modifierGroups.Shawarma, image: undefined, sizes: [{ name: "Small", price: 200 }, { name: "Large", price: 250 }] },
  { id: "sh2", code: "7002", name: "Chicken Shawarma", category: "Shawarma", kitchen: "Fast Food", price: 150, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: modifierGroups.Shawarma, image: undefined, sizes: [{ name: "Small", price: 150 }, { name: "Large", price: 170 }] },
  { id: "sh3", code: "7003", name: "Zinger Shawarma", category: "Shawarma", kitchen: "Fast Food", price: 300, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Shawarma, image: undefined },
  { id: "sh4", code: "7004", name: "Platter Shawarma", category: "Shawarma", kitchen: "Fast Food", price: 350, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Shawarma, image: undefined },
  { id: "sh5", code: "7005", name: "Kabab Shawarma", category: "Shawarma", kitchen: "Fast Food", price: 300, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: modifierGroups.Shawarma, image: undefined },


  // ==========================================
  // DEALS SECTION
  // ==========================================

  // --- Pizza Deals ---
  { id: "deal-1", code: "D1", name: "Deal #1 (2 Small Pizza + 500ml Drink)", category: "Pizza Deals", kitchen: "Fast Food", price: 1250, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [{ name: "Small Pizza Tikka" }, { name: "Small Pizza Fajita" }, { name: "Small Pizza Achari" }, { name: "Small Pizza Tandoori" }], image: undefined },
  { id: "deal-2", code: "D2", name: "Deal #2 (2 Medium Pizza + 1.5L Drink)", category: "Pizza Deals", kitchen: "Fast Food", price: 2200, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: [{ name: "Medium Pizza Tikka" }, { name: "Medium Pizza Fajita" }, { name: "Medium Pizza Achari" }, { name: "Medium Pizza Tandoori" }], image: undefined },
  { id: "deal-3", code: "D3", name: "Deal #3 (2 Large Pizza + 1.5L Drink)", category: "Pizza Deals", kitchen: "Fast Food", price: 3000, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: [{ name: "Large Pizza Tikka" }, { name: "Large Pizza Fajita" }, { name: "Large Pizza Achari" }, { name: "Large Pizza Tandoori" }], image: undefined },
  { id: "deal-4", code: "D4", name: "Deal #4 (1 XL + 1 Med Pizza + 2.5L Drink)", category: "Pizza Deals", kitchen: "Fast Food", price: 3100, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [{ name: "XL Pizza Tikka" }, { name: "XL Pizza Fajita" }, { name: "XL Pizza Achari" }, { name: "XL Pizza Tandoori" }, { name: "Med Pizza Tikka" }, { name: "Med Pizza Fajita" }, { name: "Med Pizza Achari" }, { name: "Med Pizza Tandoori" }], image: undefined },
  { id: "deal-5", code: "D5", name: "Deal #5 Birthday (2 Lrg Pizza + 3 Zinger + 3 Shawarma + 2x 1.5L)", category: "Pizza Deals", kitchen: "Fast Food", price: 4750, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [{ name: "Large Pizza Tikka" }, { name: "Large Pizza Fajita" }, { name: "Large Pizza Achari" }, { name: "Large Pizza Tandoori" }], image: undefined },
  { id: "deal-6", code: "D6", name: "Deal #6 (1 Med Pizza + 2 Zinger + Sm Fries + 1.5L)", category: "Pizza Deals", kitchen: "Fast Food", price: 2000, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [{ name: "Medium Pizza Tikka" }, { name: "Medium Pizza Fajita" }, { name: "Medium Pizza Achari" }, { name: "Medium Pizza Tandoori" }], image: undefined },
  { id: "deal-7", code: "D7", name: "Deal #7 (1 Sm Pizza + 2 Zinger + Lrg Shawarma + 1L)", category: "Pizza Deals", kitchen: "Fast Food", price: 1500, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [{ name: "Small Pizza Tikka" }, { name: "Small Pizza Fajita" }, { name: "Small Pizza Achari" }, { name: "Small Pizza Tandoori" }], image: undefined },
  { id: "deal-8", code: "D8", name: "Deal #8 (5 Zinger Burger + 1.5L)", category: "Pizza Deals", kitchen: "Fast Food", price: 1850, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-9", code: "D9", name: "Deal #9 (3 Zinger Burger + 1L)", category: "Pizza Deals", kitchen: "Fast Food", price: 1150, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },

  // --- Burger / Fast Food Deals ---
  { id: "deal-10", code: "D10", name: "Deal #10 (2 Zinger Burger + 500ml Drink)", category: "Burger Deals", kitchen: "Fast Food", price: 800, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [], image: undefined },
  { id: "deal-11", code: "D11", name: "Deal #11 (1 Zinger Burger + 5 Wings)", category: "Burger Deals", kitchen: "Fast Food", price: 680, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-12", code: "D12", name: "Deal #12 (10 Nuggets + 500ml Drink)", category: "Burger Deals", kitchen: "Fast Food", price: 680, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-13", code: "D13", name: "Deal #13 (5 Chicken Burger + 1.5L)", category: "Burger Deals", kitchen: "Fast Food", price: 1050, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-14", code: "D14", name: "Deal #14 (5 Chicken Shawarma Lrg + 1L)", category: "Burger Deals", kitchen: "Fast Food", price: 950, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-15", code: "D15", name: "Deal #15 (2L Chicken Cheese Pasta + 1L)", category: "Burger Deals", kitchen: "Fast Food", price: 1600, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-16", code: "D16", name: "Deal #16 (2 Sm Chicken Cheese Pasta + 500ml)", category: "Burger Deals", kitchen: "Fast Food", price: 1000, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-17", code: "D17", name: "Deal #17 (1 Malai Boti Roll + Sm Fries + 500ml)", category: "Burger Deals", kitchen: "Fast Food", price: 780, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-18", code: "D18", name: "Deal #18 (3 Turkish Sandwich + 1 Zinger + 1L)", category: "Burger Deals", kitchen: "Fast Food", price: 1350, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },

  // --- Combo Deals ---
  { id: "deal-19", code: "D19", name: "Deal #19 (1 Pizza Burger + Sm Fries + 500ml)", category: "Combo Deals", kitchen: "Fast Food", price: 750, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [], image: undefined },
  { id: "deal-20", code: "D20", name: "Deal #20 (1 Tower Burger + 4 Wings + 500ml)", category: "Combo Deals", kitchen: "Fast Food", price: 900, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-21", code: "D21", name: "Deal #21 (1 Patty Burger + Med Fries + 500ml)", category: "Combo Deals", kitchen: "Fast Food", price: 600, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-22", code: "D22", name: "Deal #22 (1 Chapli Kebab Burger + Sm Fries + 500ml)", category: "Combo Deals", kitchen: "Fast Food", price: 500, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-23", code: "D23", name: "Deal #23 (1 Grilled Burger + Sm Fries + 500ml)", category: "Combo Deals", kitchen: "Fast Food", price: 600, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-24", code: "D24", name: "Deal #24 (2 Zinger Paratha + Sm Fries)", category: "Combo Deals", kitchen: "Fast Food", price: 700, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-25", code: "D25", name: "Deal #25 (1 Kebab Paratha + Med Fries + 500ml)", category: "Combo Deals", kitchen: "Fast Food", price: 630, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-26", code: "D26", name: "Deal #26 (10 Hot Wings + 500ml Drink)", category: "Combo Deals", kitchen: "Fast Food", price: 780, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-27", code: "D27", name: "Deal #27 (1 Loaded Fries + 4 Wings + 500ml)", category: "Combo Deals", kitchen: "Fast Food", price: 1100, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },

  // --- Special Deals ---
  { id: "deal-28", code: "D28", name: "Deal #28 (20 Wings + 1L Drink)", category: "Special Deals", kitchen: "Fast Food", price: 1500, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [], image: undefined },
  { id: "deal-29", code: "D29", name: "Deal #29 (20 Nuggets + 1L Drink)", category: "Special Deals", kitchen: "Fast Food", price: 1300, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-30", code: "D30", name: "Deal #30 (1 Italian Roll + Sm Fries + 500ml)", category: "Special Deals", kitchen: "Fast Food", price: 730, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-31", code: "D31", name: "Deal #31 (2 Turkish Paratha + 500ml)", category: "Special Deals", kitchen: "Fast Food", price: 680, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-32", code: "D32", name: "Deal #32 (1 Cheese Sm Pasta + 4 Wings + 500ml)", category: "Special Deals", kitchen: "Fast Food", price: 850, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-33", code: "D33", name: "Deal #33 (1 Malai Boti Roll + 4 Wings + 500ml)", category: "Special Deals", kitchen: "Fast Food", price: 900, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-34", code: "D34", name: "Deal #34 (1 Zinger + 1 Turk Paratha + Med Fries + 500ml)", category: "Special Deals", kitchen: "Fast Food", price: 980, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-35", code: "D35", name: "Deal #35 (1L Cheese Pasta + 6 Nuggets + Sm Fries + 500ml)", category: "Special Deals", kitchen: "Fast Food", price: 1320, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "deal-36", code: "D36", name: "Deal #36 (10 Chicken Shawarma + 1L)", category: "Special Deals", kitchen: "Fast Food", price: 1800, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },


  // ==========================================
  // RESTAURANT SECTION
  // ==========================================

  // --- Spicy Injected Broast ---
  { id: "sib1", code: "8001", name: "Spicy Injected Broast", category: "Broast", kitchen: "Restaurant", price: 2100, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [], image: undefined, sizes: [{ name: "Half Broast (4 Pcs)", price: 1100 }, { name: "Full Broast (8 Pcs)", price: 2100 }] },

  // --- Starters ---
  { id: "str1", code: "8101", name: "Chicken Dhaka", category: "Starters", kitchen: "Restaurant", price: 1050, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "str2", code: "8102", name: "Chicken Pakora", category: "Starters", kitchen: "Restaurant", price: 900, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "str3", code: "8103", name: "Honey Wings", category: "Starters", kitchen: "Restaurant", price: 690, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "str4", code: "8104", name: "Fish Crackers", category: "Starters", kitchen: "Restaurant", price: 300, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },

  // --- Soups ---
  { id: "sop1", code: "8201", name: "Special Soup", category: "Soups", kitchen: "Restaurant", price: 1100, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Small", price: 600 }, { name: "Large", price: 1100 }] },
  { id: "sop2", code: "8202", name: "Hot & Sour Soup", category: "Soups", kitchen: "Restaurant", price: 900, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Small", price: 550 }, { name: "Large", price: 900 }] },
  { id: "sop3", code: "8203", name: "Chicken Corn Soup", category: "Soups", kitchen: "Restaurant", price: 900, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Small", price: 550 }, { name: "Large", price: 900 }] },
  { id: "sop4", code: "8204", name: "Vegetable Soup", category: "Soups", kitchen: "Restaurant", price: 700, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Small", price: 400 }, { name: "Large", price: 700 }] },

  // --- Bar-B-Q Platters ---
  { id: "bbqp1", code: "8301", name: "Full Platter BBQ", category: "Bar-B-Q Platters", kitchen: "Restaurant", price: 3600, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [], image: undefined },
  { id: "bbqp2", code: "8302", name: "Half Platter BBQ", category: "Bar-B-Q Platters", kitchen: "Restaurant", price: 2400, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: [], image: undefined },

  // --- Salads ---
  { id: "sld1", code: "8401", name: "SP Salad Platter", category: "Salads", kitchen: "Restaurant", price: 1090, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "sld2", code: "8402", name: "Russian Salad", category: "Salads", kitchen: "Restaurant", price: 690, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "sld3", code: "8403", name: "Chicken Pineapple Salad", category: "Salads", kitchen: "Restaurant", price: 890, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "sld4", code: "8404", name: "Kachumar Salad", category: "Salads", kitchen: "Restaurant", price: 90, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "sld5", code: "8405", name: "Fresh Green Salad", category: "Salads", kitchen: "Restaurant", price: 70, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "sld6", code: "8406", name: "Raita", category: "Salads", kitchen: "Restaurant", price: 70, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },

  // --- Tandoor ---
  { id: "tdr1", code: "8501", name: "SP Chicken Cheese Naan", category: "Tandoor", kitchen: "Restaurant", price: 400, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "tdr2", code: "8502", name: "Garlic Naan", category: "Tandoor", kitchen: "Restaurant", price: 90, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "tdr3", code: "8503", name: "Ginger Naan", category: "Tandoor", kitchen: "Restaurant", price: 90, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "tdr4", code: "8504", name: "Kalwanji Naan", category: "Tandoor", kitchen: "Restaurant", price: 70, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "tdr5", code: "8505", name: "Roghni Naan", category: "Tandoor", kitchen: "Restaurant", price: 80, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "tdr6", code: "8506", name: "Tandoori Paratha", category: "Tandoor", kitchen: "Restaurant", price: 90, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "tdr7", code: "8507", name: "Sada Naan", category: "Tandoor", kitchen: "Restaurant", price: 70, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "tdr8", code: "8508", name: "Sada Roti", category: "Tandoor", kitchen: "Restaurant", price: 14, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "tdr9", code: "8509", name: "Roti Per Head", category: "Tandoor", kitchen: "Restaurant", price: 140, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },

  // --- Hot & Cold Drinks ---
  { id: "hcd1", code: "8601", name: "Mint Margarita", category: "Hot & Cold Drinks", kitchen: "Drinks", price: 150, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "hcd2", code: "8602", name: "Lemonade", category: "Hot & Cold Drinks", kitchen: "Drinks", price: 120, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "hcd3", code: "8603", name: "Fresh Lime 7up", category: "Hot & Cold Drinks", kitchen: "Drinks", price: 90, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "hcd4", code: "8604", name: "Regular Soft Drink", category: "Hot & Cold Drinks", kitchen: "Drinks", price: 70, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "hcd5", code: "8605", name: "Tin Pack", category: "Hot & Cold Drinks", kitchen: "Drinks", price: 120, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "hcd6", code: "8606", name: "Soft Drink (1.5L)", category: "Hot & Cold Drinks", kitchen: "Drinks", price: 220, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "hcd7", code: "8607", name: "Mineral Water (1L)", category: "Hot & Cold Drinks", kitchen: "Drinks", price: 90, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "hcd8", code: "8608", name: "SP Tea", category: "Hot & Cold Drinks", kitchen: "Drinks", price: 80, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "hcd9", code: "8609", name: "SP Gurh Tea", category: "Hot & Cold Drinks", kitchen: "Drinks", price: 100, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "hcd10", code: "8610", name: "Green Tea", category: "Hot & Cold Drinks", kitchen: "Drinks", price: 60, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },

  // --- Rices ---
  { id: "ric1", code: "8701", name: "Special Fried Rice", category: "Rices", kitchen: "Restaurant", price: 1000, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 700 }, { name: "Full", price: 1000 }] },
  { id: "ric2", code: "8702", name: "Chicken Fried Rice", category: "Rices", kitchen: "Restaurant", price: 950, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 650 }, { name: "Full", price: 950 }] },
  { id: "ric3", code: "8703", name: "Chicken Masala Rice", category: "Rices", kitchen: "Restaurant", price: 950, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 650 }, { name: "Full", price: 950 }] },
  { id: "ric4", code: "8704", name: "Chicken Shashlik with Rice", category: "Rices", kitchen: "Restaurant", price: 1100, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "ric5", code: "8705", name: "Vegetable Fried Rice", category: "Rices", kitchen: "Restaurant", price: 800, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 400 }, { name: "Full", price: 800 }] },
  { id: "ric6", code: "8706", name: "Chicken Biryani", category: "Rices", kitchen: "Restaurant", price: 1000, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 550 }, { name: "Full", price: 1000 }] },
  { id: "ric7", code: "8707", name: "Beef Bannu Pulao", category: "Rices", kitchen: "Restaurant", price: 900, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 480 }, { name: "Full", price: 900 }] },
  { id: "ric8", code: "8708", name: "Jangi Pulao", category: "Rices", kitchen: "Restaurant", price: 1200, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 650 }, { name: "Full", price: 1200 }] },
  { id: "ric9", code: "8709", name: "Plain Rice", category: "Rices", kitchen: "Restaurant", price: 600, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },

  // --- Chinese Gravy ---
  { id: "cg1", code: "8801", name: "Special Pineapple Cherry", category: "Chinese Gravy", kitchen: "Restaurant", price: 1200, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "cg2", code: "8802", name: "Chicken Manchurian", category: "Chinese Gravy", kitchen: "Restaurant", price: 1000, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "cg3", code: "8803", name: "Chicken Almond", category: "Chinese Gravy", kitchen: "Restaurant", price: 1100, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "cg4", code: "8804", name: "Chicken Chili Dry", category: "Chinese Gravy", kitchen: "Restaurant", price: 1000, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },

  // --- Noodles ---
  { id: "ndl1", code: "8901", name: "Special Chow Mein", category: "Noodles", kitchen: "Restaurant", price: 900, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "ndl2", code: "8902", name: "Chicken Chow Mein", category: "Noodles", kitchen: "Restaurant", price: 800, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "ndl3", code: "8903", name: "Vegetable Chow Mein", category: "Noodles", kitchen: "Restaurant", price: 700, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },

  // --- Special Drinks ---
  { id: "spd1", code: "9001", name: "Blueberry Special Drink", category: "Special Drinks", kitchen: "Drinks", price: 100, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Regular", price: 70 }, { name: "Large", price: 100 }] },
  { id: "spd2", code: "9002", name: "Pineapple Special Drink", category: "Special Drinks", kitchen: "Drinks", price: 100, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Regular", price: 70 }, { name: "Large", price: 100 }] },
  { id: "spd3", code: "9003", name: "Imli Special Drink", category: "Special Drinks", kitchen: "Drinks", price: 100, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Regular", price: 70 }, { name: "Large", price: 100 }] },
  { id: "spd4", code: "9004", name: "Red Anar Special Drink", category: "Special Drinks", kitchen: "Drinks", price: 100, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Regular", price: 70 }, { name: "Large", price: 100 }] },
  { id: "spd5", code: "9005", name: "Lychee Special Drink", category: "Special Drinks", kitchen: "Drinks", price: 100, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Regular", price: 70 }, { name: "Large", price: 100 }] },
  { id: "spd6", code: "9006", name: "Guava Special Drink", category: "Special Drinks", kitchen: "Drinks", price: 100, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Regular", price: 70 }, { name: "Large", price: 100 }] },
  { id: "spd7", code: "9007", name: "Strawberry Special Drink", category: "Special Drinks", kitchen: "Drinks", price: 100, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Regular", price: 70 }, { name: "Large", price: 100 }] },
  { id: "spd8", code: "9008", name: "Falsa Special Drink", category: "Special Drinks", kitchen: "Drinks", price: 100, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Regular", price: 80 }, { name: "Large", price: 100 }] },
  { id: "spd9", code: "9009", name: "Mint Margarita Special", category: "Special Drinks", kitchen: "Drinks", price: 150, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Regular", price: 150 }, { name: "Large", price: 150 }] },

  // --- Ice Cream ---
  { id: "ic1", code: "9101", name: "Surprise Special Ice Cream", category: "Ice Cream", kitchen: "Drinks", price: 280, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [{ name: "Tutti Frutti" }, { name: "Qulfa" }, { name: "Vanilla" }, { name: "Chocolate" }, { name: "Mango" }, { name: "Strawberry" }], image: undefined },
  { id: "ic2", code: "9102", name: "3 Scoop Ice Cream", category: "Ice Cream", kitchen: "Drinks", price: 240, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [{ name: "Tutti Frutti" }, { name: "Qulfa" }, { name: "Vanilla" }, { name: "Chocolate" }, { name: "Mango" }, { name: "Strawberry" }], image: undefined },
  { id: "ic3", code: "9103", name: "2 Scoop Ice Cream", category: "Ice Cream", kitchen: "Drinks", price: 160, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [{ name: "Tutti Frutti" }, { name: "Qulfa" }, { name: "Vanilla" }, { name: "Chocolate" }, { name: "Mango" }, { name: "Strawberry" }], image: undefined },
  { id: "ic4", code: "9104", name: "1 Scoop Ice Cream", category: "Ice Cream", kitchen: "Drinks", price: 80, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [{ name: "Tutti Frutti" }, { name: "Qulfa" }, { name: "Vanilla" }, { name: "Chocolate" }, { name: "Mango" }, { name: "Strawberry" }], image: undefined },

  // --- Mutton ---
  { id: "mut1", code: "9201", name: "Special Mutton Karahi", category: "Mutton", kitchen: "Restaurant", price: 3600, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 1850 }, { name: "Full", price: 3600 }] },
  { id: "mut2", code: "9202", name: "Mutton Karahi", category: "Mutton", kitchen: "Restaurant", price: 3400, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 1850 }, { name: "Full", price: 3400 }] },
  { id: "mut3", code: "9203", name: "Mutton White Karahi", category: "Mutton", kitchen: "Restaurant", price: 3500, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 1850 }, { name: "Full", price: 3500 }] },
  { id: "mut4", code: "9204", name: "Mutton Shinwari Karahi", category: "Mutton", kitchen: "Restaurant", price: 3500, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 1850 }, { name: "Full", price: 3500 }] },
  { id: "mut5", code: "9205", name: "Mutton Handi", category: "Mutton", kitchen: "Restaurant", price: 3600, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 1850 }, { name: "Full", price: 3600 }] },
  { id: "mut6", code: "9206", name: "Mutton White Handi", category: "Mutton", kitchen: "Restaurant", price: 3600, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 1850 }, { name: "Full", price: 3600 }] },
  { id: "mut7", code: "9207", name: "Mutton Achari Handi", category: "Mutton", kitchen: "Restaurant", price: 3600, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 1850 }, { name: "Full", price: 3600 }] },
  { id: "mut8", code: "9208", name: "Mutton Arabian", category: "Mutton", kitchen: "Restaurant", price: 2050, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "mut9", code: "9209", name: "Mutton Hari Mirch", category: "Mutton", kitchen: "Restaurant", price: 1890, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "mut10", code: "9210", name: "Mutton Chili Lemon", category: "Mutton", kitchen: "Restaurant", price: 1890, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "mut11", code: "9211", name: "Mutton Machli", category: "Mutton", kitchen: "Restaurant", price: 1900, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },

  // --- Beef ---
  { id: "bef1", code: "9301", name: "Special Beef Karahi", category: "Beef", kitchen: "Restaurant", price: 2200, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 1100 }, { name: "Full", price: 2200 }] },
  { id: "bef2", code: "9302", name: "Beef Karahi", category: "Beef", kitchen: "Restaurant", price: 1900, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 1000 }, { name: "Full", price: 1900 }] },
  { id: "bef3", code: "9303", name: "Beef White Karahi", category: "Beef", kitchen: "Restaurant", price: 1950, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 1050 }, { name: "Full", price: 1950 }] },
  { id: "bef4", code: "9304", name: "Beef Rosh", category: "Beef", kitchen: "Restaurant", price: 1200, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bef5", code: "9305", name: "Beef Namkeen Fry", category: "Beef", kitchen: "Restaurant", price: 600, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },

  // --- Chicken (Full / Half where applicable) ---
  { id: "chk1", code: "9401", name: "Special Chicken Karahi", category: "Chicken", kitchen: "Restaurant", price: 1850, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 950 }, { name: "Full", price: 1850 }] },
  { id: "chk2", code: "9402", name: "Chicken Karahi", category: "Chicken", kitchen: "Restaurant", price: 1650, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 750 }, { name: "Full", price: 1650 }] },
  { id: "chk3", code: "9403", name: "Chicken White Karahi", category: "Chicken", kitchen: "Restaurant", price: 1750, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 850 }, { name: "Full", price: 1750 }] },
  { id: "chk4", code: "9404", name: "Chicken Handi", category: "Chicken", kitchen: "Restaurant", price: 1750, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 950 }, { name: "Full", price: 1750 }] },
  { id: "chk5", code: "9405", name: "Chicken White Handi", category: "Chicken", kitchen: "Restaurant", price: 1850, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 950 }, { name: "Full", price: 1850 }] },
  { id: "chk6", code: "9406", name: "Chicken Achari Handi", category: "Chicken", kitchen: "Restaurant", price: 1650, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 850 }, { name: "Full", price: 1650 }] },
  { id: "chk7", code: "9407", name: "Chicken Madrasi", category: "Chicken", kitchen: "Restaurant", price: 1550, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 850 }, { name: "Full", price: 1550 }] },
  { id: "chk8", code: "9408", name: "Chicken Makhni", category: "Chicken", kitchen: "Restaurant", price: 1550, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 850 }, { name: "Full", price: 1550 }] },
  { id: "chk9", code: "9409", name: "Chicken Bharta", category: "Chicken", kitchen: "Restaurant", price: 1550, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 850 }, { name: "Full", price: 1550 }] },
  { id: "chk10", code: "9410", name: "Chicken Hari Mirch", category: "Chicken", kitchen: "Restaurant", price: 1550, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 850 }, { name: "Full", price: 1550 }] },
  { id: "chk11", code: "9411", name: "Chicken Chili Lemon", category: "Chicken", kitchen: "Restaurant", price: 1550, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 850 }, { name: "Full", price: 1550 }] },
  { id: "chk12", code: "9412", name: "Chicken Nawabi", category: "Chicken", kitchen: "Restaurant", price: 1550, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 850 }, { name: "Full", price: 1550 }] },
  { id: "chk13", code: "9413", name: "Chicken Rajasthani", category: "Chicken", kitchen: "Restaurant", price: 1550, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined, sizes: [{ name: "Half", price: 850 }, { name: "Full", price: 1550 }] },
  { id: "chk14", code: "9414", name: "Chicken Jalfrezi", category: "Chicken", kitchen: "Restaurant", price: 1400, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "chk15", code: "9415", name: "Chicken Ginger", category: "Chicken", kitchen: "Restaurant", price: 1300, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "chk16", code: "9416", name: "Kabab Masala", category: "Chicken", kitchen: "Restaurant", price: 990, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "chk17", code: "9417", name: "Tikka Piece Masala", category: "Chicken", kitchen: "Restaurant", price: 990, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "chk18", code: "9418", name: "Shahi Daal", category: "Chicken", kitchen: "Restaurant", price: 550, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "chk19", code: "9419", name: "Mix Vegetables", category: "Chicken", kitchen: "Restaurant", price: 500, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "chk20", code: "9420", name: "Daal Makhni", category: "Chicken", kitchen: "Restaurant", price: 650, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "chk21", code: "9421", name: "Daal Mash", category: "Chicken", kitchen: "Restaurant", price: 450, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },

  // --- Bar BQ ---
  { id: "bbq1", code: "9501", name: "Special Qalmi Tikka (6 pcs)", category: "Bar BQ", kitchen: "Restaurant", price: 1400, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bbq2", code: "9502", name: "Lebanese Kabab (6 pcs)", category: "Bar BQ", kitchen: "Restaurant", price: 1380, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bbq3", code: "9503", name: "Makmali Kabab (6 pcs)", category: "Bar BQ", kitchen: "Restaurant", price: 1400, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bbq4", code: "9504", name: "Reshmi Kabab (6 pcs)", category: "Bar BQ", kitchen: "Restaurant", price: 1200, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bbq5", code: "9505", name: "Chicken Kabab (6 pcs)", category: "Bar BQ", kitchen: "Restaurant", price: 1080, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bbq6", code: "9506", name: "Malai Boti (12 pcs)", category: "Bar BQ", kitchen: "Restaurant", price: 1200, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bbq7", code: "9507", name: "Shish Tawook Boti (12 pcs)", category: "Bar BQ", kitchen: "Restaurant", price: 1200, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bbq8", code: "9508", name: "Kastoori Boti (12 pcs)", category: "Bar BQ", kitchen: "Restaurant", price: 1200, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bbq9", code: "9509", name: "Bihari Boti (12 pcs)", category: "Bar BQ", kitchen: "Restaurant", price: 1200, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bbq10", code: "9510", name: "Green Boti (12 pcs)", category: "Bar BQ", kitchen: "Restaurant", price: 1200, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bbq11", code: "9511", name: "Tikka Boti (12 pcs)", category: "Bar BQ", kitchen: "Restaurant", price: 1080, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bbq12", code: "9512", name: "Tikka Piece (Chest)", category: "Bar BQ", kitchen: "Restaurant", price: 430, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bbq13", code: "9513", name: "Tikka Piece (Leg)", category: "Bar BQ", kitchen: "Restaurant", price: 390, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bbq14", code: "9514", name: "Malai Piece (Chest)", category: "Bar BQ", kitchen: "Restaurant", price: 450, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bbq15", code: "9515", name: "Malai Piece (Leg)", category: "Bar BQ", kitchen: "Restaurant", price: 410, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bbq16", code: "9516", name: "Fish Tikka (8 pcs)", category: "Bar BQ", kitchen: "Restaurant", price: 1650, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined },
  { id: "bbq17", code: "9517", name: "Lahori Grilled Fish (1 KG)", category: "Bar BQ", kitchen: "Restaurant", price: 1600, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: false, modifiers: [], image: undefined }
]

export const ORDERS = [
  { id: "1001", time: "10:30 AM", type: "Dine In", table: "T-4", items: 3, total: 2450, status: "New" },
  { id: "1002", time: "10:35 AM", type: "Takeaway", items: 2, total: 700, status: "New" },
  { id: "1003", time: "10:15 AM", type: "Delivery", items: 5, total: 3500, status: "Preparing" },
  { id: "1004", time: "10:20 AM", type: "Dine In", table: "T-2", items: 1, total: 1150, status: "Preparing" },
  { id: "1005", time: "10:05 AM", type: "Takeaway", items: 4, total: 1800, status: "Ready" },
  { id: "1006", time: "09:50 AM", type: "Dine In", table: "T-7", items: 6, total: 4200, status: "Served" },
]

export const INVENTORY = [
  { id: "1", name: "Burger Buns", sku: "BUN-01", category: "Bakery", stock: 150, unit: "pcs", status: "In Stock" },
  { id: "2", name: "Chicken Breast", sku: "CHK-01", category: "Meat", stock: 85, unit: "kg", status: "In Stock" },
  { id: "3", name: "Cheddar Cheese", sku: "CHE-01", category: "Dairy", stock: 12, unit: "kg", status: "Low Stock" },
  { id: "4", name: "Pizza Dough", sku: "DGH-01", category: "Bakery", stock: 2, unit: "batches", status: "Critical" },
  { id: "5", name: "French Fries", sku: "FRI-01", category: "Frozen", stock: 200, unit: "kg", status: "In Stock" },
]

export const CUSTOMERS = [
  { id: "1", name: "Sarah Ahmed", phone: "0300 123 4567", email: "sarah@example.com", totalOrders: 14, totalSpent: 14500, points: 120 },
  { id: "2", name: "John Doe", phone: "0321 987 6543", email: "john@example.com", totalOrders: 3, totalSpent: 8500, points: 25 },
  { id: "3", name: "Fatima Ali", phone: "0333 456 7890", email: "fatima@example.com", totalOrders: 28, totalSpent: 42400, points: 450 },
  { id: "4", name: "Michael Smith", phone: "0345 321 0987", email: "michael@example.com", totalOrders: 8, totalSpent: 12100, points: 65 },
]

export const EXPENSES = [
  { id: "1", date: "2026-07-26", category: "Supplies", description: "Weekly fresh vegetables", amount: 4500, status: "Paid" },
  { id: "2", date: "2026-07-25", category: "Maintenance", description: "AC Repair", amount: 2000, status: "Paid" },
  { id: "3", date: "2026-07-24", category: "Utilities", description: "Electricity Bill", amount: 12500, status: "Pending" },
  { id: "4", date: "2026-07-22", category: "Marketing", description: "Social Media Ads", amount: 3000, status: "Paid" },
]

export const EMPLOYEES = [
  { id: "1", name: "Ahmed", role: "Cashier", status: "Active", shift: "Morning", image: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop" },
  { id: "2", name: "Ali", role: "Manager", status: "Active", shift: "Morning", image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop" },
  { id: "3", name: "Bilal", role: "Chef", status: "Active", shift: "Morning", image: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&h=100&fit=crop" },
  { id: "4", name: "Hassan", role: "Delivery", status: "Inactive", shift: "Evening", image: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&h=100&fit=crop" },
  { id: "5", name: "Umar", role: "Cashier", status: "Active", shift: "Evening", image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop" },
]

export const REPORTS = {
  monthly: [
    { name: 'Jan', revenue: 40000, expenses: 24000 },
    { name: 'Feb', revenue: 30000, expenses: 13900 },
    { name: 'Mar', revenue: 20000, expenses: 98000 },
    { name: 'Apr', revenue: 27800, expenses: 39000 },
    { name: 'May', revenue: 18900, expenses: 48000 },
    { name: 'Jun', revenue: 23900, expenses: 38000 },
    { name: 'Jul', revenue: 34900, expenses: 43000 },
  ],
  bestSelling: [
    { name: 'Zinger Burger', sales: 400 },
    { name: 'Malai Boti Pizza', sales: 300 },
    { name: 'Chicken Fajita Pizza', sales: 300 },
    { name: 'Chicken Hot Wings', sales: 200 },
    { name: 'Loaded Fries', sales: 150 },
  ],
  categoryData: [
    { name: 'Burgers', value: 45 },
    { name: 'Pizza', value: 25 },
    { name: 'Appetizers', value: 20 },
    { name: 'Shawarma', value: 10 },
  ]
}

export const DASHBOARD_METRICS = {
  weeklyRevenue: [
    { name: "Mon", total: 12000 },
    { name: "Tue", total: 18000 },
    { name: "Wed", total: 22000 },
    { name: "Thu", total: 19500 },
    { name: "Fri", total: 32000 },
    { name: "Sat", total: 41000 },
    { name: "Sun", total: 38000 },
  ],
  recentOrders: [1, 2, 3, 4, 5]
}
