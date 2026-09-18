const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/POS.tsx', 'utf8');

// 1. Remove keyboard shortcuts
const shortcutRegex = /if\s*\(\s*checkoutModalOpen\s*\)\s*\{[\s\S]*?(?=\/\/\s*---\s*Grid vs Cart Mode Shortcuts\s*---)/;
content = content.replace(shortcutRegex, '');

// 2. Remove AnimatePresence block containing checkoutModalOpen
// Let's find the exact bounds using a safer method.
let lines = content.split('\n');
let s1 = lines.findIndex(l => l.includes('{checkoutModalOpen && (() => {'));
let start = -1;
if (s1 !== -1) {
  for (let i = s1; i >= 0; i--) {
    if (lines[i].includes('<AnimatePresence>')) {
      start = i;
      break;
    }
  }
}
let end = -1;
if (s1 !== -1) {
  for (let i = s1; i < lines.length; i++) {
    if (lines[i].includes('<CustomerPanelModal')) {
      end = i;
      break;
    }
  }
}

if (start !== -1 && end !== -1) {
  lines.splice(start, end - start);
}
content = lines.join('\n');

// 3. Remove isKdsAutoSend references (wait, the button was already removed! but there might be 'isKdsAutoSend' usage left in handleProceedToPay or placed order?)
// Wait, isKdsAutoSend was used in `printKitchen`. Let's see: `if (isKdsAutoSend && ...)`?
// Actually the previous error log showed `src/pages/POS.tsx(2795,31): error TS2304: Cannot find name 'isKdsAutoSend'.` 
// and `(2799,35): error TS2304: Cannot find name 'isKdsAutoSend'.`
// Since that's around line 2795, it's inside the checkout modal which we just spliced out!

// 4. Remove ReceiptPreview usages from the bottom
content = content.replace(/\{\/\* ReceiptPreview Popup \*\/\}\r?\n\s*\{printOrder && <ReceiptPreview order=\{printOrder\} autoPrint=\{true\} onClose=\{\(\) => setPrintOrder\(null\)\} \/>\}/g, '');

fs.writeFileSync('frontend/src/pages/POS.tsx', content);
