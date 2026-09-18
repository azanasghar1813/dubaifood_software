const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/POS.tsx', 'utf8');

// 1. Replace handleProceedToPay body completely.
const handleProceedToPayReplacement = `const handleProceedToPay = async () => {
    if (usePosStore.getState().cart.length === 0) {
      return;
    }
    if (orderType === 'Delivery' && (!customer || !customer.phone)) {
      setCustomerModalOpen(true);
      return;
    }
    
    setIsProcessing(true);
    const method = isPaidPrint ? 'Cash' : ('Later' as any);
    const discountVal = Number(discountAmount) || 0;
    
    const shouldPay = String(method) !== 'Later';
    const totalToPay = getNetTotal();
    
    const { success, orderId: generatedOrderId } = await completeOrder(
      shouldPay ? [{
        id: \`pay-\${Date.now()}\`,
        method: method,
        amount: totalToPay,
        received: totalToPay,
        change: 0,
        timestamp: new Date().toISOString(),
        cashier: user?.name || 'Cashier',
        status: 'Completed'
      }] : [],
      discountVal,
      isPaidPrint
    );

    if (!success) {
      setIsProcessing(false);
      return;
    }
    
    const finalOrderId = generatedOrderId || activeOrderId;
    
    try {
      const { usePrinterStore } = await import("../store/printerStore");
      const ps = usePrinterStore.getState();
      const hasThermal = ps.printers.some(
        (p) => p.driver_type && p.driver_type !== 'VIRTUAL' && (p.current_status === 'ONLINE' || p.current_status === 'OFFLINE')
      );
      if (finalOrderId) {
        if (hasThermal) {
          await ps.printReceipt(finalOrderId, user?.id || user?.name || 'cashier', isPaidPrint);
        }
        await ps.printKitchen(finalOrderId, user?.id || user?.name || 'cashier');
      }
    } catch { /* fallback */ }

    setOrderNotes('');
    setDiscountAmount('');
    setIsPaidPrint(false);
    setIsProcessing(false);
  }`;

content = content.replace(/const handleProceedToPay = \(\) => \{[\s\S]*?setCheckoutModalOpen\(true\)\r?\n\s*\}\r?\n\s*\}/, handleProceedToPayReplacement);


// 2. Disable Checkout Modal Rendering
content = content.replace(/\{checkoutModalOpen && \(\(\) => \{/g, '{false && checkoutModalOpen && (() => {');

// 3. Disable Checkout Keyboard Shortcuts
content = content.replace(/if \(\s*checkoutModalOpen\s*\)\s*\{/g, 'if (false && checkoutModalOpen) {');

// 4. Disable ReceiptPreview UI
content = content.replace(/\{printOrder && <ReceiptPreview/g, '{false && printOrder && <ReceiptPreview');

// 5. Disable Auto KDS Button
content = content.replace(/<button([^>]*)onClick=\{\(\) => setIsKdsAutoSend\(!isKdsAutoSend\)\}([^>]*)>[\s\S]*?<\/button>/, '{false && <button$1onClick={() => setIsKdsAutoSend(!isKdsAutoSend)}$2>Auto KDS</button>}');

// 6. Insert Discount Input
const discountUI = `{orderType === 'Delivery' && (
                        <div className="flex justify-between items-center text-xs font-black text-foreground border-l-2 border-blue-500 pl-2 p-1 -mx-1">
                          <span>Delivery Charges</span>
                          <div className="flex items-center gap-1">
                            <span>Rs</span>
                            <input
                              type="number"
                              ref={deliveryChargesRef}
                              value={deliveryCharges || ''}
                              onChange={(e) => setDeliveryCharges(parseFloat(e.target.value) || 0)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleProceedToPay();
                                }
                              }}
                              className="w-16 h-6 px-1 text-right bg-secondary border border-border rounded text-xs font-black outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-xs font-black text-foreground border-l-2 border-emerald-500 pl-2 p-1 -mx-1">
                        <span>Discount</span>
                        <div className="flex items-center gap-1">
                          <span>Rs</span>
                          <input
                            type="number"
                            value={discountAmount}
                            onChange={(e) => setDiscountAmount(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleProceedToPay();
                              }
                            }}
                            className="w-16 h-6 px-1 text-right bg-secondary border border-border rounded text-xs font-black outline-none focus:border-emerald-500"
                            placeholder="0"
                          />
                        </div>
                      </div>`;

content = content.replace(/\{orderType === 'Delivery' && \(\s*<div className="flex justify-between items-center text-xs font-black text-foreground border-l-2 border-blue-500 pl-2 p-1 -mx-1">[\s\S]*?<\/div>\s*\)\}/, discountUI);

// Fix flex gap since we removed Auto KDS natively wait, I didn't remove Auto KDS natively, I wrapped it.
// Let's also hide Auto KDS native if possible. Wrap the button in a div? The button is just replaced with false && ... so it renders nothing. But the flex container has 6 columns.
content = content.replace(/className="grid grid-cols-6 gap-1\.5 pb-1 flex-1"/g, 'className="grid grid-cols-5 gap-1.5 pb-1 flex-1"');

fs.writeFileSync('frontend/src/pages/POS.tsx', content);
