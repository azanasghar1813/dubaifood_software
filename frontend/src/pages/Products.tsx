import { useState, useEffect, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search, Filter, Plus, Edit2, Trash2,
  Package, Download, Grid, List, Eye, Copy, RefreshCw, EyeOff, Sparkles,
  Trash, X
}
  from "lucide-react"
import { menuService } from "../services/menuService"
import { useAuthStore } from "../store/authStore"
import { toast } from "../store/toastStore"

// Categories matching options

const getImageUrl = (path?: string) => {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  let baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api/v1', '') : 'http://localhost:5000';
  if (typeof window !== 'undefined' && window.location.port !== '5173') {
    baseUrl = `${window.location.protocol}//${window.location.host}`;
  }
  return `${baseUrl}${path}`;
}

export default function Products() {
  const { user } = useAuthStore()
  const canManageProducts = user?.role === 'Super Admin' || user?.role === 'Admin' || (user?.permissions?.includes("MANAGE_PRODUCTS") ?? false)

  const [products, setProducts] = useState<any[]>([])
  const [categoriesList, setCategoriesList] = useState<any[]>([])
  const [, setIsLoadingData] = useState(true)

  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedKitchen, setSelectedKitchen] = useState("All")
  const [selectedStatus, setSelectedStatus] = useState("All")
  const [sortBy, setSortBy] = useState("Code")
  const [showFilters, setShowFilters] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [mainTab, setMainTab] = useState<"Fast Food" | "Restaurant" | "Deals" | "Drinks">("Fast Food")

  // Drawer States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [drawerMode, setDrawerMode] = useState<"view" | "edit" | "add">("view")
  const [isSaving, setIsSaving] = useState(false)

  // Refs for shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Fetch backend data
  const fetchProductsAndCategories = async () => {
    try {
      setIsLoadingData(true)
      const [prodRes, catRes, dealsRes] = await Promise.all([
        menuService.getProducts(),
        menuService.getCategories(),
        menuService.getDeals()
      ])

      const flattenCategories = (cats: any[]): any[] => {
        let result: any[] = [];
        cats.forEach(cat => {
          result.push(cat);
          if (cat.sub_categories && cat.sub_categories.length > 0) {
            result = result.concat(flattenCategories(cat.sub_categories));
          }
        });
        return result;
      }

      const allFetchedCats = flattenCategories(catRes.data || [])
      const activeCats = allFetchedCats.filter((c: any) => c.status === "Active" || c.lifecycle_state === "ACTIVE")

      const getContext = (cat: any): string | null => {
        if (cat.name === 'Fast Food' || cat.name === 'Restaurant' || cat.name === 'Deals') return cat.name;
        if (cat.parent_id) {
          const parent = activeCats.find((p: any) => p.id === cat.parent_id);
          if (parent) return getContext(parent);
        }
        return null;
      }

      const catsWithContext = activeCats.map((c: any) => ({
        ...c,
        menuContext: getContext(c)
      })).filter((c: any) => !(c.sub_categories && c.sub_categories.length > 0));

      if (catRes.data) {
        setCategoriesList(catsWithContext)
      }

      const loadedProducts = (prodRes.data || []).map((p: any) => {
        const cat = catsWithContext.find((c: any) => c.id === p.category_id)
        const primaryImage = p.images?.find((img: any) => img.is_primary === 1)?.image_path || p.images?.[0]?.image_path || null;
        
        let displayPrice = p.price || 0;
        if (p.variants && p.variants.length > 0) {
          const minVariantPrice = Math.min(...p.variants.map((v: any) => v.price || 0));
          if (minVariantPrice > 0) {
            displayPrice = minVariantPrice;
          }
        }
        
        return {
          ...p,
          code: p.code || p.product_code,
          category: cat?.name || 'Unknown',
          menuContext: cat?.menuContext || 'all',
          image: p.image || primaryImage,
          displayPrice,
          kitchen: p.kitchen_printer_id || "Main Kitchen",
          status: p.status === "AVAILABLE" ? "Active" : p.status === "HIDDEN" ? "Hidden" : p.status === "DRAFT" ? "Draft" : "Hidden"
        }
      })

      const loadedDeals = (dealsRes.data || []).map((deal: any) => ({
        ...deal,
        isDeal: true,
        category: 'Deals',
        id: deal.id,
        name: deal.name,
        price: deal.price,
        code: deal.code || deal.product_code,
      }))

      setProducts([...loadedProducts, ...loadedDeals])
    } catch (error) {
      toast.error("Failed to load catalog data")
      console.error(error)
    } finally {
      setIsLoadingData(false)
    }
  }

  useEffect(() => {
    fetchProductsAndCategories()
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
    const fastFood = products.filter(p => p.menuContext === "Fast Food" && !p.isDeal).length
    const restaurant = products.filter(p => p.menuContext === "Restaurant" && !p.isDeal).length
    const drinks = products.filter(p => (p.category?.toLowerCase().includes("drink") || p.category?.toLowerCase().includes("beverage") || p.category?.toLowerCase().includes("tea") || p.category?.toLowerCase().includes("ice cream")) && !p.isDeal).length
    const deals = products.filter(p => p.isDeal).length

    // Average price calculation
    const avgPrice = total > 0 ? Math.round(products.reduce((sum, p) => sum + (p.price || 0), 0) / total) : 0

    return { total, fastFood, restaurant, drinks, deals, avgPrice }
  }, [products])

  // Handler: Save / Update Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManageProducts) {
      toast.error("Permission denied")
      return
    }

    try {
      setIsSaving(true)
      // Find the category_id from the categoriesList based on the selected category name
      const categoryObj = categoriesList.find(c => c.name === selectedProduct.category)
      
      const payload: any = {
        name: selectedProduct.name,
        price: Number(selectedProduct.price) || 0,
        cost: 0,
        status: selectedProduct.status === "Active" ? "AVAILABLE" : "UNAVAILABLE",
        lifecycle_state: selectedProduct.status === "Active" ? "ACTIVE" : selectedProduct.status === "Hidden" ? "HIDDEN" : "DRAFT",
        kitchen_printer_id: selectedProduct.kitchen || null,
        variants: (selectedProduct.variants || []).map((v: any) => ({
          name: v.name,
          price: Number(v.price) || 0
        })),
      }

      if (selectedProduct.variants && selectedProduct.variants.length > 0) {
        payload.price = Math.min(...payload.variants.map((v: any) => v.price));
      }

      if (selectedProduct.code) payload.product_code = String(selectedProduct.code);
      if (selectedProduct.description) payload.description = String(selectedProduct.description);
      if (categoryObj && categoryObj.id) payload.category_id = categoryObj.id;


      const formatResponseProduct = (data: any) => {
        const cat = categoriesList.find((c: any) => c.id === data.category_id)
        const primaryImage = data.images?.find((img: any) => img.is_primary === 1)?.image_path || data.images?.[0]?.image_path || null;
        return {
          ...data,
          code: data.code || data.product_code,
          category: cat?.name || 'Unknown',
          menuContext: cat?.menuContext || 'all',
          kitchen: data.kitchen_printer_id || "Main Kitchen",
          status: data.status === "AVAILABLE" ? "Active" : data.status === "HIDDEN" ? "Hidden" : data.status === "DRAFT" ? "Draft" : "Hidden",
          image: data.image || primaryImage
        }
      }

      if (drawerMode === "add") {
        const res = await menuService.createProduct(payload)
        if (res.data) {
          toast.success("Product created")
          setDrawerMode("view")
          setIsDrawerOpen(false)
          // Set the created ID so we can upload image if needed
          setSelectedProduct(formatResponseProduct(res.data))
          fetchProductsAndCategories()
        }
      } else if (drawerMode === "edit") {
        if (selectedProduct.isDeal) {
          const res = await menuService.updateDeal(selectedProduct.id, {
            name: payload.name,
            code: payload.product_code,
            price: payload.price,
            is_active: payload.status === "AVAILABLE" ? 1 : 0
          })
          if (res.data) {
            toast.success("Deal updated")
            setDrawerMode("view")
            setIsDrawerOpen(false)
            fetchProductsAndCategories()
          }
        } else {
          const res = await menuService.updateProduct(selectedProduct.id, payload)
          if (res.data) {
            toast.success("Product updated")
            setDrawerMode("view")
            setIsDrawerOpen(false)
            setSelectedProduct(formatResponseProduct(res.data))
            fetchProductsAndCategories()
          }
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to save product")
    } finally {
      setIsSaving(false)
    }
  }

  // Image Delete Handler
  const handleDeleteImage = async () => {
    if (!selectedProduct?.id || !selectedProduct?.images) return;
    const existingImageId = selectedProduct.images?.find((img: any) => img.image_path === selectedProduct.image)?.id || selectedProduct.images?.[0]?.id;
    if (!existingImageId) return;

    try {
      await menuService.deleteProductImage(selectedProduct.id, existingImageId);
      toast.success("Image deleted successfully");
      setSelectedProduct({ ...selectedProduct, image: undefined, images: [] });
      fetchProductsAndCategories();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to delete image");
    }
  }

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length) return
    if (!selectedProduct?.id) {
      toast.error("Save product first before uploading image")
      return
    }

    const file = e.target.files[0]
    try {
      // If replacing an existing image, delete the old one first
      const existingImageId = selectedProduct.images?.find((img: any) => img.image_path === selectedProduct.image)?.id || selectedProduct.images?.[0]?.id;
      if (existingImageId) {
        await menuService.deleteProductImage(selectedProduct.id, existingImageId);
      }

      const res: any = await menuService.uploadProductImage(selectedProduct.id, file, true)
      const path = res?.data?.path || res?.path
      if (path) {
        toast.success("Image uploaded successfully")
        // The backend returns { id, path }. Update just the image field on the product
        setSelectedProduct({ ...selectedProduct, image: path, images: [{ id: res.data?.id || res.id, image_path: path, is_primary: 1 }] })
        fetchProductsAndCategories()
      } else {
        // Just in case it succeeded but response is malformed
        toast.success("Image uploaded successfully")
        fetchProductsAndCategories()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to upload image")
    }
  }

  // Handler: Add product trigger
  const handleOpenAdd = () => {
    setSelectedProduct({
      id: "",
      barcode: `8801${Math.floor(100000 + Math.random() * 900000)}`,
      name: "",
      category: "Burgers",
      kitchen: "Fast Food",
      price: 0,
      costPrice: 0,
      status: "Active",
      stockStatus: "In Stock",
      isPopular: false,
      isFavorite: false,
      description: "",
      variants: [],
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
  const handleDuplicateProduct = async (prod: any) => {
    if (!canManageProducts) {
      toast.error("Permission denied")
      return
    }
    const duplicated = {
      ...prod,
      name: `${prod.name} (Copy)`
    }
    delete duplicated.id // Backend will assign a new ID
    delete duplicated.code
    delete duplicated.product_code
    delete duplicated._id

    try {
      const res = await menuService.createProduct(duplicated)
      if (res.data) {
        toast.success(`Duplicated "${prod.name}" successfully.`)
        fetchProductsAndCategories()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to duplicate product")
    }
  }

  // Handler: Delete
  const handleDeleteProduct = async (id: string) => {
    if (!canManageProducts) {
      toast.error("Permission denied")
      return
    }

    if (confirm("Are you sure you want to delete this product?")) {
      try {
        const res = await menuService.deleteProduct(id)
        if (res.data) {
          toast.success("Product deleted")
          setIsDrawerOpen(false)
          setSelectedProduct(null)
          fetchProductsAndCategories()
        }
      } catch (error: any) {
        toast.error(error.response?.data?.error || "Failed to delete product")
      }
    }
  }

  // Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchProductsAndCategories()
    setIsRefreshing(false)
  }

  // Variants config inside form helper
  const handleAddVariant = () => {
    const name = prompt("Enter variant name (e.g. Extra Cheese, Spicy, Large):")
    if (!name) return
    const priceStr = prompt("Enter price adjustment (e.g. 50, 100) or leave blank for 0:")
    const price = priceStr ? parseFloat(priceStr) : 0

    setSelectedProduct({
      ...selectedProduct,
      variants: [...(selectedProduct.variants || []), { name, price }]
    })
  }

  const handleRemoveVariant = (idx: number) => {
    const next = [...(selectedProduct.variants || [])]
    next.splice(idx, 1)
    setSelectedProduct({ ...selectedProduct, variants: next })
  }

  // Filters logic
  const filteredAndSorted = useMemo(() => {
    let result = products.filter(p => {
      const q = search.toLowerCase()
      const matchSearch = p.name?.toLowerCase().includes(q) ||
        p.code.includes(q) ||
        (p.barcode || '').includes(q) ||
        p.category?.toLowerCase().includes(q)

      const cat = p.category || ""
      const isDeal = cat.toLowerCase().includes("deal")
      const isDrink = cat.toLowerCase().includes("drink") || cat.toLowerCase().includes("ice cream") || cat.toLowerCase().includes("tea")

      const catObj = categoriesList.find(c => c.name === p.category)
      const context = catObj?.menuContext || 'all'

      let matchMainTab = true
      if (mainTab === "Fast Food") matchMainTab = (p.menuContext === "Fast Food" || p.kitchen === "Fast Food") && !isDeal && !isDrink
      else if (mainTab === "Restaurant") matchMainTab = (p.menuContext === "Restaurant" || p.kitchen === "Restaurant") && !isDeal && !isDrink
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
  }, [products, search, selectedCategory, selectedKitchen, selectedStatus, sortBy, mainTab, categoriesList])

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

          {canManageProducts && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/95 shadow-md shadow-primary/10 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add Product [Ctrl+N]
            </button>
          )}
        </div>
      </div>

      {/* ==================================================
          KPI TOP CARDS
          ================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Products", val: stats.total, sub: "All database items", color: "text-blue-500" },
          { label: "Fast Food Products", val: stats.fastFood, sub: "Pizzas, burgers", color: "text-amber-500" },
          { label: "Restaurant", val: stats.restaurant, sub: "Mutton, BBQ, Rices", color: "text-rose-500" },
          { label: "Drinks / Bevs", val: stats.drinks, sub: "Tin pack, margarita", color: "text-sky-500" },
          { label: "Deals", val: stats.deals, sub: "Promotional combos", color: "text-orange-500" },
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
              className={`h-11 px-4 rounded-xl border text-xs font-black uppercase transition-all flex items-center gap-2 ${showFilters
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
                      setSortBy("Code")
                      setSearch("")
                      setMainTab("Fast Food")
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
          {["Fast Food", "Restaurant", "Deals", "Drinks"].map((tab) => (
            <button
              key={tab}
              onClick={() => setMainTab(tab as any)}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${mainTab === tab
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
      <div className="flex flex-col gap-6 items-start h-[calc(100vh-280px)] pb-4">
        
        <div className="flex-1 w-full min-w-0 h-full overflow-y-auto custom-scrollbar pr-2 pb-8">
          {viewMode === "grid" ? (

            // GRID VIEW LAYOUT
            <div className="flex flex-col gap-8">
              {categoriesList
                .filter((c) => selectedCategory === 'All' ? ((c.menuContext as any) === mainTab || (mainTab === 'Drinks' && (c.name.toLowerCase().includes('drink') || c.name.toLowerCase().includes('beverage')))) : c.name === selectedCategory)
                .map(cat => {
                  const catProducts = filteredAndSorted.filter(p => (p.category || categoriesList.find(c => c.id === p.category_id)?.name) === cat.name);
                  if (catProducts.length === 0) return null;

                  return (
                    <div key={cat.id || cat.name} className="flex flex-col gap-4">
                      <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                        {cat.name}
                      </h3>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                        {catProducts.map((product) => {
                          const hasVariants = product.variants && product.variants.length > 0
                          const varCount = product.variants?.length || 0
                          const isDeal = product.category?.toLowerCase().includes("deal")

                          return (
                            <motion.div
                              layout
                              key={product.id}
                              onClick={() => handleOpenView(product)}
                              className="bg-card hover:bg-secondary/40 border border-border/60 hover:border-primary/50 rounded-2xl p-2.5 shadow-sm hover:shadow-xl hover:-translate-y-1 cursor-pointer transition-all duration-300 flex flex-col justify-between relative group overflow-hidden"
                            >
                              <div>
                                {/* Thumbnail / Image Simulation */}
                                <div className="w-full h-24 bg-secondary/30 rounded-xl overflow-hidden border border-border/50 flex items-center justify-center text-muted-foreground relative mb-2.5 shrink-0 group-hover:border-primary/30 transition-colors">
                                  {product.image ? (
                                    <img src={getImageUrl(product.image)} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                  ) : (
                                    <Package className="w-6 h-6 opacity-20 group-hover:scale-110 group-hover:opacity-40 transition-all duration-300" />
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

                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="text-[9px] font-black tracking-widest text-muted-foreground/80 uppercase truncate">#{product.code}</span>
                                  <span
                                    title={product.status === "Active" ? "Available" : "Not Available"}
                                    className={`w-2 h-2 rounded-full shrink-0 ${product.status === "Active" ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]'}`}
                                  />
                                </div>

                                <h4 className="text-[11px] font-black text-foreground mt-1 leading-snug group-hover:text-primary transition-colors line-clamp-2">{product.name}</h4>

                                <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                                  <span className="text-[9px] text-muted-foreground font-semibold px-1.5 py-0.5 bg-secondary rounded">{product.category}</span>
                                </div>
                              </div>

                              <div className="mt-3 pt-2 border-t border-border/40 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-primary">Rs. {product.price.toLocaleString()}</span>

                                  {hasVariants && (
                                    <span className="text-[8px] bg-sky-500/10 text-sky-500 border border-sky-500/20 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">
                                      <Plus className="w-2.5 h-2.5" /> {varCount}
                                    </span>
                                  )}
                                </div>

                                {/* Grid Action Buttons */}
                                <div className="flex justify-end items-center gap-1.5 pt-1.5 border-t border-border/30" onClick={e => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleOpenView(product)}
                                    className="p-1.5 bg-secondary text-foreground hover:bg-border border border-border rounded-lg transition-colors flex justify-center items-center shadow-sm"
                                    title="View"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  {canManageProducts && (
                                    <button
                                      onClick={() => handleDeleteProduct(product.id)}
                                      className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 rounded-lg transition-colors flex justify-center items-center shadow-sm"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              {filteredAndSorted.length === 0 && (
                <div className="py-16 text-center text-muted-foreground font-bold">
                  No products found matching search filters.
                </div>
              )}
            </div>

          ) : (

            // TABLE VIEW LAYOUT
            <div className="flex flex-col gap-8">
              {categoriesList
                .filter((c) => selectedCategory === 'All' ? ((c.menuContext as any) === mainTab || (mainTab === 'Drinks' && (c.name.toLowerCase().includes('drink') || c.name.toLowerCase().includes('beverage')))) : c.name === selectedCategory)
                .map(cat => {
                  const catProducts = filteredAndSorted.filter(p => (p.category || categoriesList.find(c => c.id === p.category_id)?.name) === cat.name);
                  if (catProducts.length === 0) return null;

                  return (
                    <div key={cat.id || cat.name} className="flex flex-col gap-4">
                      <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                        {cat.name}
                      </h3>
                      <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-secondary/30 text-muted-foreground text-[10px] uppercase font-bold border-b border-border">
                            <tr>
                              <th className="px-4 py-3">Image</th>
                              <th className="px-4 py-3">Code</th>
                              <th className="px-4 py-3">Product Name</th>
                              <th className="px-4 py-3">Category</th>
                              <th className="px-4 py-3">Kitchen</th>
                              <th className="px-4 py-3">Price</th>
                              <th className="px-4 py-3 text-center">Variants</th>
                              <th className="px-4 py-3 text-center">Status</th>
                              <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {catProducts.map((product) => (
                              <tr
                                key={product.id}
                                onClick={() => handleOpenView(product)}
                                className="hover:bg-secondary/20 transition-colors cursor-pointer group"
                              >
                                <td className="px-4 py-2">
                                  <div className="w-8 h-8 rounded-lg bg-secondary/50 overflow-hidden border border-border flex items-center justify-center text-muted-foreground">
                                    {product.image ? (
                                      <img src={getImageUrl(product.image)} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <Package className="w-4 h-4 opacity-30" />
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2 font-bold text-muted-foreground text-[11px]">#{product.code}</td>
                                <td className="px-4 py-2 font-black text-foreground text-xs">{product.name}</td>
                                <td className="px-4 py-2 text-[10px] font-semibold text-muted-foreground">{product.category}</td>
                                <td className="px-4 py-2 text-[10px] font-bold text-foreground">{product.kitchen}</td>
                                <td className="px-4 py-2 font-black text-primary text-xs">Rs. {product.displayPrice !== undefined ? product.displayPrice : product.price}</td>
                                <td className="px-4 py-2 text-center font-bold text-[11px] text-foreground">
                                  {product.variants?.length || 0}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <div className="flex justify-center items-center">
                                    <span
                                      title={product.status === "Active" ? "Available" : "Not Available"}
                                      className={`w-2.5 h-2.5 rounded-full ${product.status === "Active" ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}
                                    />
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-right" onClick={e => e.stopPropagation()}>
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => handleOpenView(product)}
                                      className="p-1.5 bg-secondary text-foreground hover:bg-border border border-border rounded-lg transition-colors shadow-sm"
                                      title="View"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    {canManageProducts && (
                                      <button
                                        onClick={() => handleDeleteProduct(product.id)}
                                        className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 rounded-lg transition-colors shadow-sm"
                                        title="Delete"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              {filteredAndSorted.length === 0 && (
                <div className="py-16 text-center text-muted-foreground font-bold">
                  No products found matching search filters.
                </div>
              )}
            </div>

          )}
        </div>
      </div>

      {/* ==================================================
          RIGHT DRAWER (ADD / EDIT / VIEW)ER (RIGHT-SIDE)
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
                      <div className="w-full h-44 bg-secondary border-2 border-dashed border-border rounded-2xl overflow-hidden flex flex-col items-center justify-center relative text-muted-foreground group">
                        {selectedProduct.image ? (
                          <>
                            <img src={getImageUrl(selectedProduct.image)} alt={selectedProduct.name} className="w-full h-full object-cover" />
                            
                            {/* Overlay for change/delete actions */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                              <label className="cursor-pointer bg-white text-black text-xs font-black px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
                                Change Image
                                <input
                                  type="file"
                                  accept="image/png, image/jpeg"
                                  onChange={handleImageUpload}
                                  className="hidden"
                                  disabled={!canManageProducts}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={handleDeleteImage}
                                className="bg-red-500 text-white rounded-lg p-2 hover:bg-red-600 transition-colors"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <label className="text-center p-4 w-full h-full flex flex-col justify-center items-center cursor-pointer hover:bg-secondary/70 transition-colors">
                            <div className="w-8 h-8 mx-auto mb-2 opacity-35" />
                            <span className="text-xs font-black block">Upload Product Image</span>
                            <span className="text-[10px] text-muted-foreground font-semibold mt-1 block">Supports PNG, JPG (Max 2MB)</span>
                            <input
                              type="file"
                              accept="image/png, image/jpeg"
                              onChange={handleImageUpload}
                              className="hidden"
                              disabled={!canManageProducts || !selectedProduct?.id}
                            />
                            {!selectedProduct?.id && (
                              <span className="text-[9px] text-orange-500 font-bold mt-2 block">(Save product first to upload image)</span>
                            )}
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Core Properties */}
                    <div className="grid grid-cols-2 gap-4">
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
                            <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs uppercase font-black text-muted-foreground">Status / Availability</label>
                        <select
                          disabled={drawerMode === "view"}
                          value={selectedProduct.status}
                          onChange={e => setSelectedProduct({ ...selectedProduct, status: e.target.value })}
                          className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-bold text-foreground disabled:opacity-60"
                        >
                          <option value="Active">Available (Active)</option>
                          <option value="Hidden">Not Available (Hidden)</option>
                          <option value="Draft">Draft (Incomplete)</option>
                        </select>
                      </div>
                      {(!selectedProduct.variants || selectedProduct.variants.length === 0) && (
                        <div className="space-y-1">
                          <label className="text-xs uppercase font-black text-muted-foreground">Price (Rs.)</label>
                          <input
                            required
                            disabled={drawerMode === "view"}
                            type="number"
                            value={selectedProduct.price}
                            onChange={e => setSelectedProduct({ ...selectedProduct, price: parseFloat(e.target.value) || 0 })}
                            className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-primary disabled:opacity-60"
                          />
                        </div>
                      )}
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

                    {/* Variants Builder Section */}
                    <div className="space-y-3 border-t border-border pt-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs uppercase font-black tracking-wider text-muted-foreground">Product Variants</h4>
                        {drawerMode !== "view" && (
                          <button
                            type="button"
                            onClick={() => setSelectedProduct({ ...selectedProduct, variants: [...(selectedProduct.variants || []), { name: "", price: 0 }] })}
                            className="text-[10px] text-primary hover:underline font-black flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add Variant
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {selectedProduct.variants && selectedProduct.variants.length > 0 ? (
                          selectedProduct.variants.map((variant: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-secondary/50 border border-border rounded-xl gap-3">
                              <div className="flex-1 space-y-2">
                                {drawerMode === "view" ? (
                                  <>
                                    <p className="text-xs font-black text-foreground">{variant.name}</p>
                                    <span className="text-[10px] text-muted-foreground font-semibold">
                                      Price: Rs. {variant.price || 0}
                                    </span>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={variant.name}
                                      placeholder="Variant Name"
                                      onChange={(e) => {
                                        const next = [...selectedProduct.variants]
                                        next[idx].name = e.target.value
                                        setSelectedProduct({ ...selectedProduct, variants: next })
                                      }}
                                      className="flex-1 h-8 px-2 rounded bg-background border border-border text-xs font-bold focus:border-orange-500 outline-none"
                                    />
                                    <input
                                      type="number"
                                      value={variant.price}
                                      placeholder="Price (Rs)"
                                      onChange={(e) => {
                                        const next = [...selectedProduct.variants]
                                        next[idx].price = parseFloat(e.target.value) || 0
                                        setSelectedProduct({ ...selectedProduct, variants: next })
                                      }}
                                      className="w-24 h-8 px-2 rounded bg-background border border-border text-xs font-bold focus:border-orange-500 outline-none"
                                    />
                                  </div>
                                )}
                              </div>
                              {drawerMode !== "view" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...selectedProduct.variants]
                                    next.splice(idx, 1)
                                    setSelectedProduct({ ...selectedProduct, variants: next })
                                  }}
                                  className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-[10px] text-muted-foreground font-semibold italic text-center py-4 bg-secondary/20 rounded-xl border border-dashed border-border">
                            No variants defined for this product.
                          </p>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Drawer Footer Actions */}
                  <div className="p-6 border-t border-border bg-card flex justify-end gap-3 shrink-0">
                    {drawerMode === "view" ? (
                      canManageProducts && (
                        <>
                          <button
                            type="button"
                            onClick={() => setDrawerMode("edit")}
                            className="h-10 px-6 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-black transition-colors flex items-center gap-2 shadow-md shadow-primary/10"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit Product
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const newStatusUI = selectedProduct.status === "Active" ? "Hidden" : "Active"
                              const status = newStatusUI === "Active" ? "AVAILABLE" : "UNAVAILABLE"
                              const lifecycle_state = newStatusUI === "Active" ? "ACTIVE" : "HIDDEN"
                              try {
                                const res = await menuService.updateProduct(selectedProduct.id, { status, lifecycle_state })
                                if (res.data) {
                                  // Refresh using the new formatted version
                                  fetchProductsAndCategories()
                                  toast.success(`Product status changed to: ${newStatusUI}`)
                                  setIsDrawerOpen(false)
                                }
                              } catch (err: any) {
                                toast.error("Failed to update status")
                              }
                            }}
                            className="h-10 px-4 bg-secondary hover:bg-border border border-border text-foreground font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                          >
                            {selectedProduct.status === "Active" ? <EyeOff className="w-4 h-4 text-zinc-500" /> : <Eye className="w-4 h-4 text-primary" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(selectedProduct.id)}
                            className="h-10 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => {
                            if (drawerMode === "add") {
                              setIsDrawerOpen(false)
                              setSelectedProduct(null)
                            } else {
                              setDrawerMode("view")
                              setSelectedProduct(products.find(p => p.id === selectedProduct.id))
                            }
                          }}
                          className="h-10 px-6 rounded-xl bg-secondary text-foreground text-xs font-black hover:bg-border transition-colors border border-border disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="h-10 px-6 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-black transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {isSaving ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                            </>
                          ) : (
                            "Save Product"
                          )}
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
