import os

path = r'C:\Users\Azan\Desktop\Dubai Food Software\frontend\src\pages\Reports.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace sidebar links
old_sidebar = '''  const sidebarLinks = [
    "Dashboard Summary", "Orders Report",
    "Product Sales", "Category Sales", "Deal Sales"
  ]'''
new_sidebar = '''  const sidebarLinks = [
    "Dashboard Summary", "Orders Report",
    "Product Sales", "Category Sales", "Deal Sales",
    "Payment Report", "Shift Audit Log"
  ]'''
content = content.replace(old_sidebar, new_sidebar)

# Add new tabs before the closing divs
new_tabs = '''
          {/* 4. Payment Report */}
          {activeTab === "Payment Report" && (
            <div className="bg-card border border-border rounded-[2.5rem] shadow-sm overflow-hidden p-6 space-y-6">
              <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Payment Channel Allocation</h3>
              <div className="flex justify-center items-center h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Cash", value: 45000, color: "#10B981" },
                        { name: "Card", value: 32400, color: "#3B82F6" },
                        { name: "JazzCash", value: 12000, color: "#F59E0B" },
                        { name: "EasyPaisa", value: 8500, color: "#EC4899" },
                        { name: "Meezan", value: 15600, color: "#06B6D4" }
                      ]}
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {[
                        { name: "Cash", value: 45000, color: "#10B981" },
                        { name: "Card", value: 32400, color: "#3B82F6" },
                        { name: "JazzCash", value: 12000, color: "#F59E0B" },
                        { name: "EasyPaisa", value: 8500, color: "#EC4899" },
                        { name: "Meezan", value: 15600, color: "#06B6D4" }
                      ].map((entry, index) => (
                        <Cell key={cell-} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', fontWeight: 'bold' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 5. Shift Audit Log */}
          {activeTab === "Shift Audit Log" && (
            <div className="bg-card border border-border rounded-[2.5rem] shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Shift Activity Audit Log</h3>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { time: "06:15 AM", user: "Manager Admin", action: "Opened shift register (Till #1)", amount: "Rs. 10,000" },
                  { time: "08:42 AM", user: "Azan Cashier", action: "Safe Drop / Cash skim", amount: "-Rs. 25,000" },
                  { time: "11:30 AM", user: "System", action: "Auto-reconcile check passed", amount: "--" },
                  { time: "02:15 PM", user: "Azan Cashier", action: "Paid out (Vendor Supplies)", amount: "-Rs. 3,500" },
                  { time: "03:45 PM", user: "Manager Admin", action: "Safe Drop / Cash skim", amount: "-Rs. 30,000" }
                ].map((log, idx) => (
                  <div key={idx} className="flex justify-between items-center py-3 border-b border-border/50 last:border-0 hover:bg-secondary/20 rounded-xl px-2 transition-colors">
                    <div className="flex gap-4 items-center">
                      <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-foreground">{log.action}</p>
                        <p className="text-xs font-bold text-muted-foreground">{log.time} • {log.user}</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-foreground">{log.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  )
}'''

content = content.replace('''        </div>

      </div>

    </div>
  )
}''', new_tabs)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated Reports.tsx successfully.')
