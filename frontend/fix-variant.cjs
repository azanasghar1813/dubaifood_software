const fs = require('fs');
let content = fs.readFileSync('src/store/posStore.ts', 'utf8');
content = content.replace(/name: item\.product_name \|\| 'Unknown'/g, "name: item.variant_name ? `${item.product_name} (${item.variant_name})` : (item.product_name || 'Unknown')");
fs.writeFileSync('src/store/posStore.ts', content);
