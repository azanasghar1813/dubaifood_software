import { useState, useEffect, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Search, Filter, Plus, Edit2, Trash2, ChevronLeft, ChevronRight, 
  CheckCircle2, XCircle, Package, Loader2, Download, Upload,
  Grid, List, Eye, Copy, RefreshCw, Smartphone, Printer, Settings,
  AlertTriangle, DollarSign, Clock, HelpCircle, EyeOff, Sparkles, BarChart2,
  Trash, ArrowUpDown, ChevronDown, Check, X, ShieldAlert, BadgeInfo
} from "lucide-react"
import { PRODUCTS as initialProducts } from "../services/mockData"

// Categories matching options
const categoriesList = [
  "Pizza", "Premium Pizza", "Square Pizza", "Burgers", "Pratha Rolls", 
  "Special Rolls", "Pasta", "Appetizers", "Sandwich", "Shawarma",
  "Broast", "Starters", "Soups", "Bar-B-Q Platters", "Salads", "Tandoor",
  "Hot & Cold Drinks", "Rices", "Chinese Gravy", "Noodles", "Special Drinks",
  "Ice Cream", "Mutton", "Beef", "Chicken", "Bar BQ"
]

export default function Products() {
  // Store state locally since there is no backend
  const [products, setProducts] = useState<any[]>(() => {
    return initialProducts
  })
  
  const [currentTime, setCurrentTime] = useState(new Date())
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedKitchen, setSelectedKitchen] = useState("All")
  const [selectedStatus, setSelectedStatus] = useState("All")
  const [sortBy, setSortBy] = useState("NameA-Z")
  const [showFilters, setShowFilters] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [mainTab, setMainTab] = useState<"All" | "Fast Food" | "Restaurant" | "Deals" | "Drinks">("All")

  // Drawer States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [drawerMode, setDrawerMode] = useState<"view" | "edit" | "add">("view")

  // Refs for shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "SELECT"

      // F2: Focus Search
      if (e.key === "F2") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }

      // Ctrl + N: Add product
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault()
        handleOpenAdd()
      }

      // Esc: Close Drawer
      if (e.key === "Escape" && isDrawerOpen) {
        e.preventDefault()
        setIsDrawerOpen(false)
      }

      // Ctrl + P: Print Catalog
      if (e.ctrlKey && e.key === "p" && !isInputFocused) {
        e.preventDefault()
        window.print()
      }
      
      // Ctrl + E: Edit selected
      if (e.ctrlKey && e.key === "e" && selectedProduct && drawerMode === "view") {
        e.preventDefault()
        setDrawerMode("edit")
      }

      // Ctrl + D: Duplicate selected
      if (e.ctrlKey && e.key === "d" && selectedProduct) {
        e.preventDefault()
        handleDuplicateProduct(selectedProduct)
      }

      // Delete: Delete selected
      if (e.key === "Delete" && selectedProduct && !isInputFocused) {
        e.preventDefault()
        handleDeleteProduct(selectedProduct.id)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isDrawerOpen, selectedProduct, drawerMode])

  // KPIs
  const stats = useMemo(() => {
    const total = products.length
    const fastFood = products.filter(p => p.kitchen === "Fast Food").length
    const restaurant = products.filter(p => p.kitchen === "Restaurant").length
    const drinks = products.filter(p => p.category.toLowerCase().includes("drink")).length
    const outOfStock = products.filter(p => p.stockStatus === "Out of Stock").length
    const hidden = products.filter(p => p.status === "Hidden").length
    
    // Average price calculation
    const avgPrice = total > 0 ? Math.round(products.reduce((sum, p) => sum + p.price, 0) / total) : 0
    
    return { total, fastFood, restaurant, drinks, outOfStock, hidden, avgPrice }
  }, [products])

  // Handler: Save / Update Product
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault()
    if (drawerMode === "add") {
      const newId = `prod-${Date.now()}`
      const newProd = {
        ...selectedProduct,
        id: newId,
        popularity: { sold: 0, revenue: 0 }
      }
      setProducts([newProd, ...products])
      setSelectedProduct(newProd)
      setDrawerMode("view")
    } else if (drawerMode === "edit") {
      setProducts(products.map(p => p.id === selectedProduct.id ? selectedProduct : p))
      setDrawerMode("view")
    }
  }

  // Handler: Add product trigger
  const handleOpenAdd = () => {
    setSelectedProduct({
      id: "",
      code: Math.floor(1000 + Math.random() * 9000).toString(),
      barcode: `8801${Math.floor(100000 + Math.random() * 900000)}`,
      name: "",
      category: "Burgers",
      kitchen: "Fast Food",
      price: 150,
      costPrice: 80,
      status: "Active",
      stockStatus: "In Stock",
      isPopular: false,
      isFavorite: false,
      description: "",
      preparationTime: 15,
      modifiers: [],
      sizes: []
    })
    setDrawerMode("add")
    setIsDrawerOpen(true)
  }

  const handleOpenView = (product: any) => {
    setSelectedProduct({ ...product })
    setDrawerMode("view")
    setIsDrawerOpen(true)
  }

  // Handler: Duplicate
  const handleDuplicateProduct = (prod: any) => {
    const duplicated = {
      ...prod,
      id: `prod-${Date.now()}`,
      code: (parseInt(prod.code) + 1).toString(),
      name: `${prod.name} (Copy)`
    }
    setProducts([duplicated, ...products])
    alert(`Duplicated "${prod.name}" successfully.`)
  }

  // Handler: Delete
  const handleDeleteProduct = (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      setProducts(products.filter(p => p.id !== id))
      setIsDrawerOpen(false)
      setSelectedProduct(null)
    }
  }

  // Refresh
  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 800)
  }

  // Modifiers config inside form helper
  const handleAddModifier = () => {
    const name = prompt("Enter modifier name (e.g. Extra Cheese, Spicy, Large):")
    if (!name) return
    const priceStr = prompt("Enter price adjustment (e.g. 50, 100) or leave blank for 0:")
    const price = priceStr ? parseFloat(priceStr) : 0
    
    setSelectedProduct({
      ...selectedProduct,
      modifiers: [...(selectedProduct.modifiers || []), { name, price }]
    })
  }

  const handleRemoveModifier = (idx: number) => {
    const next = [...(selectedProduct.modifiers || [])]
    next.splice(idx, 1)
    setSelectedProduct({ ...selectedProduct, modifiers: next })
  }

  // Filters logic
  const filteredAndSorted = useMemo(() => {
    let result = products.filter(p => {
      const q = search.toLowerCase()
      const matchSearch = p.name.toLowerCase().includes(q) || 
                          p.code.includes(q) || 
                          (p.barcode || '').includes(q) || 
                          p.category.toLowerCase().includes(q)
      
      const cat = p.category || ""
      const isDeal = cat.toLowerCase().includes("deal")
      const isDrink = cat.toLowerCase().includes("drink") || cat.toLowerCase().includes("ice cream") || cat.toLowerCase().includes("tea")
      
      const fastFoodCats = ["Pizza", "Premium Pizza", "Square Pizza", "Burgers", "Pratha Rolls", "Special Rolls", "Pasta", "Appetizers", "Sandwich", "Shawarma"]
      const restaurantCats = ["Broast", "Starters", "Soups", "Bar-B-Q Platters", "Salads", "Tandoor", "Rices", "Chinese Gravy", "Noodles", "Mutton", "Beef", "Chicken", "Bar BQ"]
      
      const isFastFood = fastFoodCats.includes(cat) || (p.kitchen === "Fast Food" && !restaurantCats.includes(cat))
      const isRestaurant = restaurantCats.includes(cat) || (p.kitchen === "Restaurant" && !fastFoodCats.includes(cat))

      let matchMainTab = true
      if (mainTab === "Fast Food") matchMainTab = isFastFood && !isDeal && !isDrink
      else if (mainTab === "Restaurant") matchMainTab = isRestaurant && !isDeal && !isDrink
      else if (mainTab === "Deals") matchMainTab = isDeal
      else if (mainTab === "Drinks") matchMainTab = isDrink

      const matchCat = selectedCategory === "All" || p.category === selectedCategory
      const matchKitchen = selectedKitchen === "All" || p.kitchen === selectedKitchen
      
      let matchStatus = true
      if (selectedStatus === "Active") matchStatus = p.status === "Active"
      else if (selectedStatus === "Hidden") matchStatus = p.status === "Hidden"
      else if (selectedStatus === "Out of Stock") matchStatus = p.stockStatus === "Out of Stock"

      return matchSearch && matchMainTab && matchCat && matchKitchen && matchStatus
    })

    // Sort config
    result.sort((a, b) => {
      if (sortBy === "NameA-Z") return a.name.localeCompare(b.name)
      if (sortBy === "NameZ-A") return b.name.localeCompare(a.name)
      if (sortBy === "PriceHighLow") return b.price - a.price
      if (sortBy === "PriceLowHigh") return a.price - b.price
      if (sortBy === "Code") return a.code.localeCompare(b.code)
      return 0
    })

    return result
  }, [products, search, selectedCategory, selectedKitchen, selectedStatus, sortBy])

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground pb-12">

      {/* ==================================================
          HEADER
          ================================================== */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl gap-4 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Menu & Product Management
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Control Panel</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Business Day: 6AM–6AM
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={handleRefresh}
            className={`p-2.5 bg-secondary hover:bg-border rounded-xl text-muted-foreground hover:text-foreground border border-border relative transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh Database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => alert("Product Catalog Exported successfully.")}
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-black text-foreground hover:bg-secondary/80 transition-colors"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>

          <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/95 shadow-md shadow-primary/10 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Product [Ctrl+N]
          </button>
        </div>
      </div>

      {/* ==================================================
          KPI TOP CARDS
          ================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {[
          { label: "Total Products", val: stats.total, sub: "All database items", color: "text-blue-500" },
          { label: "Fast Food Products", val: stats.fastFood, sub: "Pizzas, burgers", color: "text-amber-500" },
          { label: "Restaurant", val: stats.restaurant, sub: "Mutton, BBQ, Rices", color: "text-rose-500" },
          { label: "Drinks / Bevs", val: stats.drinks, sub: "Tin pack, margarita", color: "text-sky-500" },
          { label: "Out of Stock", val: stats.outOfStock, sub: "Needs raw supply", color: "text-red-500" },
          { label: "Hidden / Drafts", val: stats.hidden, sub: "Inactive on menu", color: "text-zinc-500" },
          { label: "Avg Price", val: `Rs. ${stats.avgPrice}`, sub: "Average item cost", color: "text-emerald-500" }
        ].map((card, i) => (
          <div key={i} className="p-4 bg-card border border-border/50 rounded-2xl flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wide leading-none">{card.label}</span>
              <h4 className="text-xl font-black mt-2 text-foreground">{card.val}</h4>
            </div>
            <span className={`text-[8px] font-bold mt-2 ${card.color}`}>{card.sub}</span>
          </div>
        ))}
      </div>

      {/* ==================================================
          STICKY SEARCH, TABS & ADVANCED FILTERS
          ================================================== */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl pt-2 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        
        <div className="bg-card/80 backdrop-blur-md border border-border/80 rounded-3xl p-4 shadow-lg shadow-black/5 space-y-4 mb-4">
          
          {/* Top Search bar */}
        <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Search className="w-4 h-4" /></span>
            <input 
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Product Name, Code, Barcode, Category... [Press F2 to focus]"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-sm font-bold text-foreground placeholder:text-muted-foreground transition-all"
            />
          </div>
          
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`h-11 px-4 rounded-xl border text-xs font-black uppercase transition-all flex items-center gap-2 ${
              showFilters 
                ? 'bg-orange-500/10 border-orange-500 text-orange-500' 
                : 'bg-secondary text-muted-foreground border-border hover:border-muted-foreground'
            }`}
          >
            <Filter className="w-4 h-4" /> Filter Panel
          </button>

          <div className="flex border border-border rounded-xl overflow-hidden shrink-0">
            <button 
              onClick={() => setViewMode("grid")}
              className={`p-3 transition-colors ${viewMode === "grid" ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode("table")}
              className={`p-3 transition-colors ${viewMode === "table" ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Drawer */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-border/50"
            >
              <div>
                <label className="text-[10px] uppercase font-black text-muted-foreground">Category</label>
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full h-9 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none"
                >
                  <option value="All">All Categories</option>
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-muted-foreground">Kitchen Assign</label>
                <select 
                  value={selectedKitchen}
                  onChange={(e) => setSelectedKitchen(e.target.value)}
                  className="w-full h-9 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none"
                >
                  <option value="All">All Kitchens</option>
                  <option value="Fast Food">Fast Food Kitchen</option>
                  <option value="Restaurant">Restaurant Kitchen</option>
                  <option value="Drinks">Drinks Bar</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-muted-foreground">Menu Availability</label>
                <select 
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full h-9 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active / Live</option>
                  <option value="Hidden">Hidden / Draft</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-muted-foreground">Sort Catalog</label>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full h-9 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none"
                >
                  <option value="NameA-Z">Alphabetical (A - Z)</option>
                  <option value="NameZ-A">Alphabetical (Z - A)</option>
                  <option value="PriceHighLow">Price: High to Low</option>
                  <option value="PriceLowHigh">Price: Low to High</option>
                  <option value="Code">Product Code</option>
                </select>
              </div>

              <div className="flex items-end">
                <button 
                  onClick={() => {
                    setSelectedCategory("All")
                    setSelectedKitchen("All")
                    setSelectedStatus("All")
                    setSortBy("NameA-Z")
                    setSearch("")
                    setMainTab("All")
                  }}
                  className="w-full h-9 rounded-lg border border-border hover:bg-secondary text-xs font-black uppercase text-center transition-colors"
                >
                  Reset filters
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>

        {/* Main Categories Segmented Control */}
        <div className="flex gap-2 p-1.5 bg-secondary/80 border border-border rounded-2xl overflow-x-auto custom-scrollbar shadow-sm">
          {["All", "Fast Food", "Restaurant", "Deals", "Drinks"].map((tab) => (
            <button
              key={tab}
              onClick={() => setMainTab(tab as any)}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${
                mainTab === tab 
                  ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]' 
                  : 'text-muted-foreground hover:bg-background hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ==================================================
          PRODUCT VIEW MODE CONTAINER
          ================================================== */}
      {viewMode === "grid" ? (
        
        // GRID VIEW LAYOUT
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredAndSorted.map((product) => {
            const hasModifiers = product.modifiers && product.modifiers.length > 0
            const modCount = product.modifiers?.length || 0
            const isDeal = product.category.toLowerCase().includes("deal")

            return (
              <motion.div
                layout
                key={product.id}
                onClick={() => handleOpenView(product)}
                className="bg-card hover:bg-secondary/40 border border-border/60 hover:border-primary/50 rounded-3xl p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 cursor-pointer transition-all duration-300 flex flex-col justify-between relative group overflow-hidden"
              >
                <div>
                  {/* Thumbnail / Image Simulation */}
                  <div className="w-full h-32 bg-secondary/30 rounded-2xl overflow-hidden border border-border/50 flex items-center justify-center text-muted-foreground relative mb-4 shrink-0 group-hover:border-primary/30 transition-colors">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <Package className="w-8 h-8 opacity-20 group-hover:scale-110 group-hover:opacity-40 transition-all duration-300" />
                    )}
                    
                    {product.isPopular && (
                      <span className="absolute top-2 right-2 text-[9px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full shadow-md shadow-amber-500/20 backdrop-blur-md">BEST SELLER</span>
                    )}
                    {isDeal && (
                      <span className="absolute top-2 left-2 text-[9px] bg-primary/90 text-white font-black px-2 py-0.5 rounded-full shadow-md backdrop-blur-md flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> DEAL
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black tracking-widest text-muted-foreground/80 uppercase">#{product.code}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider border leading-none ${
                      product.status === "Active" 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                        : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>
                      {product.status}
                    </span>
                  </div>
                  
                  <h4 className="text-[13px] font-black text-foreground mt-1.5 leading-snug group-hover:text-primary transition-colors line-clamp-2">{product.name}</h4>
                  
                  <div className="flex gap-2 mt-1.5 items-center">
                    <span className="text-[10px] text-muted-foreground font-semibold px-2 py-0.5 bg-secondary rounded-md">{product.category}</span>
                    <span className="text-[10px] text-muted-foreground font-semibold px-2 py-0.5 bg-secondary rounded-md">{product.kitchen}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                  <span className="text-sm font-black text-primary">Rs. {product.price.toLocaleString()}</span>
                  
                  {hasModifiers && (
                    <span className="text-[9px] bg-sky-500/10 text-sky-500 border border-sky-500/20 px-2 py-1 rounded-md font-black flex items-center gap-1">
                      <Plus className="w-3 h-3" /> {modCount}
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
          {filteredAndSorted.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground font-bold">
              No products found matching search filters.
            </div>
          )}
        </div>

      ) : (

        // TABLE VIEW LAYOUT
        <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-secondary/30 text-muted-foreground text-xs uppercase font-bold border-b border-border">
              <tr>
                <th className="px-6 py-4">Image</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Kitchen</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Stock Status</th>
                <th className="px-6 py-4 text-center">Modifiers</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAndSorted.map((product) => (
                <tr 
                  key={product.id}
                  onClick={() => handleOpenView(product)}
                  className="hover:bg-secondary/20 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary/50 overflow-hidden border border-border flex items-center justify-center text-muted-foreground">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 opacity-30" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-muted-foreground">#{product.code}</td>
                  <td className="px-6 py-4 font-black text-foreground">{product.name}</td>
                  <td className="px-6 py-4 text-xs font-semibold text-muted-foreground">{product.category}</td>
                  <td className="px-6 py-4 text-xs font-bold text-foreground">{product.kitchen}</td>
                  <td className="px-6 py-4 font-black text-primary">Rs. {product.price}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${product.stockStatus === 'In Stock' ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}>
                      {product.stockStatus || "In Stock"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-xs text-foreground">
                    {product.modifiers?.length || 0}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[9px] px-2 py-0.5 rounded font-black border uppercase tracking-wider ${
                      product.status === "Active" ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end gap-1.5">
                      <button 
                        onClick={() => handleOpenView(product)}
                        className="p-2 bg-secondary text-foreground hover:bg-border border border-border rounded-xl transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDuplicateProduct(product)}
                        className="p-2 bg-secondary text-foreground hover:bg-border border border-border rounded-xl transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 bg-secondary/80 text-red-500 hover:bg-red-500 hover:text-white border border-border rounded-xl transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAndSorted.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground font-bold">
                    No products matching search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      )}

      {/* ==================================================
          PRODUCT DETAILS & EDIT DRAWER (RIGHT-SIDE)
          ================================================== */}
      {createPortal(
        <AnimatePresence>
          {isDrawerOpen && selectedProduct && (
            <div className="fixed inset-0 z-[9999] flex justify-end">
            
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />

            {/* Drawer Body */}
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg bg-card border-l border-border shadow-2xl flex flex-col h-full z-10 overflow-hidden text-foreground"
            >
              <form onSubmit={handleSaveProduct} className="flex flex-col h-full">
                
                {/* Header */}
                <div className="p-6 border-b border-border bg-secondary/30 flex justify-between items-center shrink-0">
                  <div>
                    <h2 className="text-lg font-black text-foreground">
                      {drawerMode === 'add' ? "Add Menu Product" : drawerMode === 'edit' ? "Edit Menu Product" : "Product details"}
                    </h2>
                    <p className="text-xs text-muted-foreground font-semibold mt-1">
                      {drawerMode === 'add' ? "Create new database entry" : `Product Code: #${selectedProduct.code}`}
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-2 bg-secondary hover:bg-border rounded-xl text-muted-foreground hover:text-foreground border border-border transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Form fields */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-background/40">
                  
                  {/* Image Selector / Simulator */}
                  <div className="space-y-2">
                    <label className="text-xs uppercase font-black text-muted-foreground">Product Image</label>
                    <div className="w-full h-44 bg-secondary border-2 border-dashed border-border rounded-2xl overflow-hidden flex flex-col items-center justify-center relative text-muted-foreground">
                      {selectedProduct.image ? (
                        <>
                          <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                          <button 
                            type="button" 
                            onClick={() => setSelectedProduct({ ...selectedProduct, image: undefined })}
                            className="absolute bottom-2 right-2 bg-black/60 text-white rounded-lg p-2 hover:bg-red-600 transition-colors"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <Upload className="w-8 h-8 mx-auto mb-2 opacity-35" />
                          <span className="text-xs font-black block">Upload Product Image</span>
                          <span className="text-[10px] text-muted-foreground font-semibold mt-1 block">Supports PNG, JPG (Max 2MB)</span>
                          <button 
                            type="button" 
                            onClick={() => setSelectedProduct({ ...selectedProduct, image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop" })}
                            className="mt-3 px-3 py-1.5 bg-card hover:bg-border rounded-xl border border-border text-[9px] font-black uppercase text-foreground transition-all"
                          >
                            Use Demo Image
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Core Properties */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Product Code</label>
                      <input 
                        required
                        disabled={drawerMode === "view"}
                        type="text"
                        value={selectedProduct.code}
                        onChange={e => setSelectedProduct({ ...selectedProduct, code: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Barcode / SKU</label>
                      <input 
                        disabled={drawerMode === "view"}
                        type="text"
                        value={selectedProduct.barcode || ""}
                        onChange={e => setSelectedProduct({ ...selectedProduct, barcode: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground disabled:opacity-60"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Product Name</label>
                      <input 
                        required
                        disabled={drawerMode === "view"}
                        type="text"
                        value={selectedProduct.name}
                        onChange={e => setSelectedProduct({ ...selectedProduct, name: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Category & Pricing */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Category</label>
                      <select 
                        disabled={drawerMode === "view"}
                        value={selectedProduct.category}
                        onChange={e => setSelectedProduct({ ...selectedProduct, category: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-bold text-foreground disabled:opacity-60"
                      >
                        {categoriesList.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Kitchen Assignment</label>
                      <select 
                        disabled={drawerMode === "view"}
                        value={selectedProduct.kitchen}
                        onChange={e => setSelectedProduct({ ...selectedProduct, kitchen: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-bold text-foreground disabled:opacity-60"
                      >
                        <option value="Fast Food">Fast Food Kitchen</option>
                        <option value="Restaurant">Restaurant Kitchen</option>
                        <option value="Drinks">Drinks Bar</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Retail Price (Rs.)</label>
                      <input 
                        required
                        disabled={drawerMode === "view"}
                        type="number"
                        value={selectedProduct.price}
                        onChange={e => setSelectedProduct({ ...selectedProduct, price: parseFloat(e.target.value) || 0 })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-primary disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Cost Price (Rs.)</label>
                      <input 
                        disabled={drawerMode === "view"}
                        type="number"
                        value={selectedProduct.costPrice || 0}
                        onChange={e => setSelectedProduct({ ...selectedProduct, costPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-muted-foreground disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Status & Stock */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Menu Status</label>
                      <select 
                        disabled={drawerMode === "view"}
                        value={selectedProduct.status}
                        onChange={e => setSelectedProduct({ ...selectedProduct, status: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-bold text-foreground disabled:opacity-60"
                      >
                        <option value="Active">Active</option>
                        <option value="Hidden">Hidden</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Stock Availability</label>
                      <select 
                        disabled={drawerMode === "view"}
                        value={selectedProduct.stockStatus || "In Stock"}
                        onChange={e => setSelectedProduct({ ...selectedProduct, stockStatus: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-bold text-foreground disabled:opacity-60"
                      >
                        <option value="In Stock">In Stock</option>
                        <option value="Out of Stock">Out of Stock</option>
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-black text-muted-foreground">Product Description</label>
                    <textarea 
                      disabled={drawerMode === "view"}
                      value={selectedProduct.description || ""}
                      onChange={e => setSelectedProduct({ ...selectedProduct, description: e.target.value })}
                      placeholder="Enter recipe details, ingredients list, or item summaries..."
                      className="w-full h-20 p-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-bold text-foreground disabled:opacity-60 resize-none"
                    />
                  </div>

                  {/* Modifiers Builder Section */}
                  <div className="space-y-3 border-t border-border pt-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs uppercase font-black tracking-wider text-muted-foreground">Modifiers / Add-ons</h4>
                      {drawerMode !== "view" && (
                        <button 
                          type="button" 
                          onClick={handleAddModifier}
                          className="text-[10px] text-primary hover:underline font-black flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add Mod
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      {selectedProduct.modifiers && selectedProduct.modifiers.length > 0 ? (
                        selectedProduct.modifiers.map((mod: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-secondary/50 border border-border rounded-xl">
                            <div>
                              <p className="text-xs font-black text-foreground">{mod.name}</p>
                              <span className="text-[10px] text-muted-foreground font-semibold">
                                Price Adjustment: +Rs. {mod.price || 0}
                              </span>
                            </div>
                            {drawerMode !== "view" && (
                              <button 
                                type="button" 
                                onClick={() => handleRemoveModifier(idx)}
                                className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-muted-foreground font-semibold italic text-center py-4 bg-secondary/20 rounded-xl border border-dashed border-border">
                          No customized modifiers defined. Default categories apply.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* MOCK Product Statistics (Popularity) */}
                  {drawerMode === "view" && (
                    <div className="border-t border-border pt-4 space-y-3">
                      <h4 className="text-xs uppercase font-black tracking-wider text-muted-foreground flex items-center gap-1"><BarChart2 className="w-3.5 h-3.5 text-primary" /> Sales Statistics</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-secondary/55 border border-border rounded-xl text-center">
                          <span className="text-[9px] text-muted-foreground uppercase font-black">Today's Sales count</span>
                          <p className="text-lg font-black text-foreground mt-1">
                            {selectedProduct.isPopular ? "42 units" : "12 units"}
                          </p>
                        </div>
                        <div className="p-3 bg-secondary/55 border border-border rounded-xl text-center">
                          <span className="text-[9px] text-muted-foreground uppercase font-black">Estimated Revenue</span>
                          <p className="text-lg font-black text-primary mt-1">
                            Rs. {selectedProduct.isPopular ? (selectedProduct.price * 42).toLocaleString() : (selectedProduct.price * 12).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Footer Buttons */}
                <div className="p-6 border-t border-border bg-card grid grid-cols-2 gap-2 shrink-0">
                  {drawerMode === "view" ? (
                    <>
                      <button 
                        type="button" 
                        onClick={() => setDrawerMode("edit")}
                        className="py-3 bg-primary text-white hover:bg-primary/95 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-primary/10"
                      >
                        <Edit2 className="w-4 h-4" /> Edit Item
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleDuplicateProduct(selectedProduct)}
                        className="py-3 bg-secondary hover:bg-border border border-border text-foreground font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Copy className="w-4 h-4" /> Duplicate
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          const status = selectedProduct.status === "Active" ? "Hidden" : "Active"
                          setSelectedProduct({ ...selectedProduct, status })
                          setProducts(products.map(p => p.id === selectedProduct.id ? { ...p, status } : p))
                          alert(`Product status changed to: ${status}`)
                        }}
                        className="col-span-2 py-3 bg-secondary hover:bg-border border border-border text-foreground font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {selectedProduct.status === "Active" ? <EyeOff className="w-4 h-4 text-zinc-500" /> : <Eye className="w-4 h-4 text-primary" />}
                        {selectedProduct.status === "Active" ? "Hide Product" : "Restore Product"}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleDeleteProduct(selectedProduct.id)}
                        className="col-span-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-4.5 h-4.5" /> Delete Product
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        type="submit"
                        className="py-3 bg-primary text-white hover:bg-primary/95 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-primary/10"
                      >
                        Save Product
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          if (drawerMode === "add") {
                            setIsDrawerOpen(false)
                            setSelectedProduct(null)
                          } else {
                            setDrawerMode("view")
                            setSelectedProduct(products.find(p => p.id === selectedProduct.id))
                          }
                        }}
                        className="py-3 bg-secondary hover:bg-border border border-border text-foreground font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>

              </form>
            </motion.div>
          </div>
        )}
        </AnimatePresence>,
        document.body
      )}

    </div>
  )
}
