import os

path = r'C:\Users\Azan\Desktop\Dubai Food Software\frontend\src\pages\CashierManagement.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

new_kpi = '''      {/* ====================================================
          TOP SUMMARY CARDS (KPI BLOCK)
          ==================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* KPI 1: Today's Accrual Sales */}
        <div className="p-6 bg-card border border-border rounded-3xl shadow-sm flex items-start gap-4">
          <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center border border-border shrink-0 text-emerald-500">
            <BarChart className="w-6 h-6" />
          </div>
          <div className="space-y-1 w-full min-w-0">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">Today's Sales</span>
            <h3 className="text-xl font-black text-foreground">Rs. {isShiftActive ? (salesSummary.cashSales + salesSummary.onlineSales).toLocaleString() : 0}</h3>
            <p className="text-[10px] text-muted-foreground font-bold">Total revenue accrued during this shift</p>
          </div>
        </div>

        {/* KPI 2: Orders Count */}
        <div className="p-6 bg-card border border-border rounded-3xl shadow-sm flex items-start gap-4">
          <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center border border-border shrink-0 text-primary">
            <Activity className="w-6 h-6" />
          </div>
          <div className="space-y-1 w-full min-w-0">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">Orders Count</span>
            <h3 className="text-xl font-black text-foreground">{isShiftActive ? salesSummary.totalOrders : 0}</h3>
            <p className="text-[10px] text-muted-foreground font-bold">Total transactions processed</p>
          </div>
        </div>

        {/* KPI 3: Drawer Cash Balance */}
        <div className="p-6 bg-card border border-border rounded-3xl shadow-sm flex items-start gap-4">
          <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center border border-border shrink-0 text-orange-500">
            <Coins className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">Expected Cash in Till</span>
            <h3 className="text-xl font-black text-primary">Rs. {isShiftActive ? expectedDrawerBalance.toLocaleString() : 0}</h3>
            <p className="text-[10px] text-muted-foreground font-semibold leading-tight">
              Opening Float: <span className="text-foreground font-bold">Rs. {isShiftActive ? openingFloat.toLocaleString() : 0}</span>
            </p>
          </div>
        </div>

      </div>'''

new_main = '''      {/* ====================================================
          MAIN CONTENT GRID (RECONCILIATION)
          ==================================================== */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        {/* Single Cash Reconciliation Card */}
        <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
            <Coins className="w-4 h-4 text-emerald-500" /> Cash Reconciliation
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs font-bold">
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Opening Cash Float:</span>
              <span className="text-foreground">Rs. {isShiftActive ? openingFloat.toLocaleString() : 0}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Total Safe Drops (-):</span>
              <span className="text-orange-500 font-semibold">-Rs. {isShiftActive ? totalCashDrops.toLocaleString() : 0}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Cash Sales (+):</span>
              <span className="text-emerald-500 font-black">+Rs. {isShiftActive ? salesSummary.cashSales.toLocaleString() : 0}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Total Paid Out Expenses (-):</span>
              <span className="text-sky-500">-Rs. {isShiftActive ? totalPaidOuts.toLocaleString() : 0}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Online Card Sales (+):</span>
              <span className="text-indigo-500">+Rs. {isShiftActive ? salesSummary.onlineSales.toLocaleString() : 0}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Cash Refunds (-):</span>
              <span className="text-red-500">-Rs. {isShiftActive ? salesSummary.refunds.toLocaleString() : 0}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Applied Discounts (-):</span>
              <span className="text-zinc-500">-Rs. {isShiftActive ? salesSummary.discounts.toLocaleString() : 0}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-3 border-t border-border mt-2 text-sm">
            <span className="font-black text-foreground">Expected Drawer Balance:</span>
            <span className="font-black text-primary">Rs. {isShiftActive ? expectedDrawerBalance.toLocaleString() : 0}</span>
          </div>

          <div className="mt-6 pt-4 border-t border-border/50 max-w-md">
            <label className="text-[10px] uppercase font-black text-muted-foreground mb-1 block">Enter Counted Cash Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-xs">Rs</span>
              <input 
                type="number"
                placeholder="Enter raw cash amount"
                value={calcInputCash}
                onChange={(e) => setCalcInputCash(e.target.value)}
                className="w-full h-10 pl-8 pr-3 rounded-xl bg-secondary border border-border text-sm font-black outline-none"
              />
            </div>
            <div className="flex justify-between items-center text-xs font-bold pt-3">
              <div>
                <span className="text-muted-foreground block text-[9px] uppercase">Discrepancy</span>
                {calcInputCash === "" ? (
                  <span className="text-sm font-black text-muted-foreground">Not yet counted</span>
                ) : (
                  <span className={	ext-sm font-black }>
                    {isShiftActive ? 
                      ((parseFloat(calcInputCash) - expectedDrawerBalance) === 0 ? "Rs. 0 (Balanced)" :
                       (parseFloat(calcInputCash) - expectedDrawerBalance) > 0 ? +Rs.  (OVERAGE) :
                       -Rs.  (SHORT)
                      ) : 0
                    }
                  </span>
                )}
              </div>
              {calcInputCash !== "" && (
                <button 
                  onClick={() => setCalcInputCash("")}
                  className="text-[9px] uppercase font-black text-muted-foreground hover:text-foreground"
                >
                  Clear Count
                </button>
              )}
            </div>
          </div>

        </div>
      </div>'''

new_lines = lines[:522] + [new_kpi] + lines[603:604] + [new_main] + lines[1018:]
with open(path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print('Replacement successful.')
