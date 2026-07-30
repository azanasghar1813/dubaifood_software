const fs = require('fs');
let content = fs.readFileSync('c:\Users\Azan\Desktop\Dubai Food Software\frontend\src\services\mockData.ts', 'utf8');

// Add Pakistani to categories
if (!content.includes('Pakistani')) {
  content = content.replace(
    ']} \n\nconst modifierGroups',
    '  { id: \\"CAT-11\\", name: \\"Pakistani\\", itemsCount: 4, status: \\"Active\\", menuContext: \\"Restaurant\\" }\\n]\\n\\nconst modifierGroups'
  );
}

// Function to replace each product line to add kitchen property
content = content.replace(/\{ id: \\"([^\\]+)\\", code: \\"([^\\]+)\\", name: \\"([^\\]+)\\", category: \\"([^\\]+)\\"/g, (match, id, code, name, category) => {
  let kitchen = 'Fast Food';
  if (category === 'Pasta' || category === 'Pakistani') {
    kitchen = 'Restaurant';
  }
  return \{ id: "\", code: "\", name: "\", category: "\", kitchen: "\"\;
});

// Append the new products if they don't exist
if (!content.includes('Chicken Karahi')) {
  const newProducts = \
  // Pakistani (Restaurant)
  { id: "pk1", code: "8001", name: "Chicken Karahi", category: "Pakistani", kitchen: "Restaurant", price: 1500, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [], image: undefined },
  { id: "pk2", code: "8002", name: "Handi", category: "Pakistani", kitchen: "Restaurant", price: 1800, status: "Active", stockStatus: "In Stock", isFavorite: true, isPopular: true, modifiers: [], image: undefined },
  { id: "pk3", code: "8003", name: "Biryani", category: "Pakistani", kitchen: "Restaurant", price: 400, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: [], image: undefined },
  { id: "pk4", code: "8004", name: "Naan", category: "Pakistani", kitchen: "Restaurant", price: 50, status: "Active", stockStatus: "In Stock", isFavorite: false, isPopular: true, modifiers: [], image: undefined },
]\;
  content = content.replace(/\\n\\]/g, newProducts);
}

fs.writeFileSync('c:\Users\Azan\Desktop\Dubai Food Software\frontend\src\services\mockData.ts', content);
