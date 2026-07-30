const fs = require('fs');

const path = 'c:/Users/Azan/Desktop/Dubai Food Software/frontend/src/pages/Reports.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Remove paymentReportData
code = code.replace(/\/\/ Payment Report Data[\s\S]*?}, \[reportStats\]\)\n\n/m, '');

// 2. Update sidebarLinks
code = code.replace(/const sidebarLinks = \[\s*([\s\S]*?)\s*\]/m, `const sidebarLinks = [
    "Dashboard Summary", "Orders Report", 
    "Product Sales", "Category Sales", "Deal Sales"
  ]`);

// 3. Remove tab blocks from {/* 4. Cashier Report */} up to the end of Kitchen Performance block
code = code.replace(/\s*\{\/\* 4\. Cashier Report \*\/\}[\s\S]*?\{\/\* 8\. Kitchen Performance \*\/\}[\s\S]*?\n          \)}\n/m, '\n');

fs.writeFileSync(path, code);
console.log("Cleanup complete!");
