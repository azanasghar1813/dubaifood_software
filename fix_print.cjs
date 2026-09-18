const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/POS.tsx', 'utf8');

// 1. Remove hasThermal check from handleProceedToPay
content = content.replace(
  /const hasThermal = ps\.printers\.some\([\s\S]*?\);\s*if \(finalOrderId\) \{\s*if \(hasThermal\) \{\s*await ps\.printReceipt\(finalOrderId, user\?\.id \|\| user\?\.name \|\| 'cashier', isPaidPrint\);\s*\}\s*await ps\.printKitchen\(finalOrderId, user\?\.id \|\| user\?\.name \|\| 'cashier'\);\s*\}/,
  `if (finalOrderId) {
        await ps.printReceipt(finalOrderId, user?.id || user?.name || 'cashier', isPaidPrint);
        await ps.printKitchen(finalOrderId, user?.id || user?.name || 'cashier');
      }`
);

// 2. Remove setKotPreview from handleSendKot
content = content.replace(/setKotPreview\(preview\)\r?\n\s*if \(!kot\) alert\("KOT could not be sent to the kitchen printer\. Check USB or LAN\. Preview is still shown\."\)/,
  'if (!kot) alert("KOT could not be sent to the kitchen printer. Check USB or LAN.");'
);

// Disable KitchenTicketPreview rendering entirely just in case
content = content.replace(/\{kotPreview && <KitchenTicketPreview/g, '{false && kotPreview && <KitchenTicketPreview');

fs.writeFileSync('frontend/src/pages/POS.tsx', content);
