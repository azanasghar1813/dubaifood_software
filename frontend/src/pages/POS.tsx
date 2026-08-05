import { useState, useEffect, useRef, useMemo } from "react"

import { usePosStore } from "../store/posStore"
import type { CartItem } from "../store/posStore"
import { motion, AnimatePresence } from "framer-motion"
import { useAuthStore } from "../store/authStore"
import { useOrderStore } from "../store/orderStore"
import { 
  Search, Plus, Minus, User, 
  Loader2, Star,
  Utensils, Pizza, CupSoda, CakeSlice, 
  Printer, Monitor,
  Tag, XOctagon, Receipt, FileText, XCircle,
  Hash, Phone, Edit, Edit2,
  Store, UtensilsCrossed, Truck, CircleDot
} from "lucide-react"
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels"
import { menuService } from "../services/menuService"
import { CustomerPanelModal } from "../components/CustomerPanelModal"
import { TableSelectorModal } from "../components/TableSelectorModal"
import { ActiveOrdersSidebar } from "../components/ActiveOrdersSidebar"
import type { PaymentMethod } from "../store/orderStore"

type Product = any
type Modifier = any

// Helper to map category names to generic icons
const getCategoryIcon = (name: string) => {
  const n = (name || '').toLowerCase()
  if (n.includes('burger')) return <Utensils className="w-5 h-5" />
  if (n.includes('pizza')) return <Pizza className="w-5 h-5" />
  if (n.includes('drink')) return <CupSoda className="w-5 h-5" />
  if (n.includes('dessert')) return <CakeSlice className="w-5 h-5" />
  if (n.includes('roll')) return <FileText className="w-5 h-5" />
  if (n.includes('pasta')) return <Utensils className="w-5 h-5" />
  if (n.includes('appetizer')) return <Utensils className="w-5 h-5" />
  if (n.includes('sandwich')) return <Utensils className="w-5 h-5" />
  if (n.includes('shawarma')) return <Utensils className="w-5 h-5" />
  if (n.includes('fav')) return <Star className="w-5 h-5" />
  return <Utensils className="w-5 h-5" />
}

// Generate dynamic background gradients for placeholder images based on category
const getCategoryGradient = (category: string) => {
  const n = (category || '').toLowerCase()
  if (n.includes('burger')) return 'bg-gradient-to-br from-orange-400 to-red-500'
  if (n.includes('pizza')) return 'bg-gradient-to-br from-red-500 to-rose-600'
  if (n.includes('drink')) return 'bg-gradient-to-br from-cyan-400 to-blue-500'
  if (n.includes('dessert')) return 'bg-gradient-to-br from-pink-400 to-purple-500'
  return 'bg-gradient-to-br from-gray-400 to-gray-600'
}

const getCategoryStyles = (category: string) => {
  const n = (category || '').toLowerCase()
  if (n.includes('burger') || n.includes('sandwich')) return 'bg-[var(--cat-burgers-bg)] text-[var(--cat-burgers-text)] border-[length:var(--cat-border-width)] border-[var(--cat-border-color)]'
  if (n.includes('appetizer') || n.includes('fries') || n.includes('side')) return 'bg-[var(--cat-sides-bg)] text-[var(--cat-sides-text)] border-[length:var(--cat-border-width)] border-[var(--cat-border-color)]'
  if (n.includes('drink') || n.includes('beverage')) return 'bg-[var(--cat-drinks-bg)] text-[var(--cat-drinks-text)] border-[length:var(--cat-border-width)] border-[var(--cat-border-color)]'
  if (n.includes('dessert') || n.includes('ice cream')) return 'bg-[var(--cat-desserts-bg)] text-[var(--cat-desserts-text)] border-[length:var(--cat-border-width)] border-[var(--cat-border-color)]'
  return 'bg-[var(--cat-core-bg)] text-[var(--cat-core-text)] border-[length:var(--cat-border-width)] border-[var(--cat-border-color)]'
}

export default function POS() {
  const [activeCategory, setActiveCategory] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)
  const cartTopRef = useRef<HTMLDivElement>(null)
  const orderNotesRef = useRef<HTMLInputElement>(null)
  
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Layout & Panel State
  const [leftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  
  // Modals state
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false)
  const [customizeModalOpen, setCustomizeModalOpen] = useState(false)
  const [orderNotes, setOrderNotes] = useState("")
  const [activeCartItem, setActiveCartItem] = useState<CartItem | null>(null)
  const [tempModifiers, setTempModifiers] = useState<Modifier[]>([])
  const [tempNotes, setTempNotes] = useState("")
  const [isVIP, setIsVIP] = useState(false)

  const [sizeModalOpen, setSizeModalOpen] = useState(false)
  const [activeProductForSize, setActiveProductForSize] = useState<Product | null>(null)
  const [sizeSelectedIndex, setSizeSelectedIndex] = useState(0)
  
  const [gridSelectedIndex, setGridSelectedIndex] = useState(0)
  const gridProductsRef = useRef<Product[]>([])
  
  // Edit Mode state
  const [removingCartItemId, setRemovingCartItemId] = useState<string | null>(null)
  const [removalReason, setRemovalReason] = useState("")
  
  // Restaurant Management Modals
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [tableModalOpen, setTableModalOpen] = useState(false)
  const [recentOrdersModalOpen, setRecentOrdersModalOpen] = useState(false)

  // Payment Selection
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("Cash")
  const [amountReceived, setAmountReceived] = useState<string>("")
  const [isPaidPrint, setIsPaidPrint] = useState(false)

  const { 
    cart, addToCart, removeFromCart, updateQuantity, duplicateItem,
    getSubtotal, getTax, getGrandTotal, clearCart, getNetTotal,
    updateItemModifiers, updateItemNotes, orderType, setOrderType,
    setCustomer, gridDensity, tableNumber, customer,
    isTaxEnabled, toggleTax, menuContext, setMenuContext,
    editingOrderId, clearEditMode, completeOrder,
    deliveryCharges, setDeliveryCharges,
    fetchDraftOrder
  } = usePosStore()
  
  const { orderCounter } = useOrderStore()
  
  const { user } = useAuthStore()

  const handleProceedToPay = () => {
    if (cart.length === 0) return
    if (orderType === 'Delivery' && (!customer || !customer.phone)) {
      setCustomerModalOpen(true)
    } else {
      setCheckoutModalOpen(true)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodsRes, catsRes, dealsRes] = await Promise.all([
          menuService.getProducts(),
          menuService.getCategories(),
          menuService.getDeals().catch(() => ({ data: [] }))
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
        
        const allFetchedCats = flattenCategories(catsRes.data || []);
        const activeCats = allFetchedCats.filter((c: any) => c.status === "Active" || c.lifecycle_state === "ACTIVE")
        
        const loadedProducts = (prodsRes.data || []).map((p: any) => {
          const primaryImage = p.images?.find((img: any) => img.is_primary === 1)?.image_path || p.images?.[0]?.image_path || null;
          let imagePath = p.image || primaryImage;
          if (imagePath && !imagePath.startsWith('http')) {
            const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');
            imagePath = `${baseUrl}${imagePath}`;
          }

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
            category: activeCats.find((c: any) => c.id === p.category_id)?.name || 'Unknown',
            image: imagePath,
            displayPrice: displayPrice
          }
        })
        
        const loadedDeals = (dealsRes.data || []).map((deal: any) => ({
          ...deal,
          isDeal: true,
          category: 'Deals',
          id: deal.id,
          name: deal.name,
          price: deal.price,
          code: deal.code,
        }))

        setProducts([...loadedProducts, ...loadedDeals])
        

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

        const preferredOrder = [
          'Regular Pizza',
          'Premium Pizza',
          'Square Pizza',
          'Burgers',
          'Shawarma',
          'Pratha Rolls',
          'Special Rolls',
          'Pasta',
          'Appetizers',
          'Sandwich',
          'Extra Toppings',
          'Chicken',
          'Mutton',
          'Beef',
          'Bar BQ',
          'Spicy Injected Broast',
          'Rices',
          'Starters',
          'Tandoor',
          'Chinese Gravy',
          'Noodles',
          'Soups',
          'Salads',
          'Hot & Cold Drinks',
          'Special Drinks',
          'Ice Cream',
          'Bar-B-Q Platers'
        ];

        const sortedCats = catsWithContext.sort((a: any, b: any) => {
          const indexA = preferredOrder.indexOf(a.name);
          const indexB = preferredOrder.indexOf(b.name);
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return a.name.localeCompare(b.name);
        });

        setCategories([{ id: "all", name: "All", menuContext: "all" }, { id: "fav", name: "Favorites", menuContext: "all" }, ...sortedCats])

        // Fetch user's current draft order from backend
        await fetchDraftOrder()
      } catch (err) {
        console.error("Failed to load POS data:", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
      setSearchSelectedIndex(0)
    }, 100)
    return () => clearTimeout(timer)
  }, [searchQuery])


  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
      const inputValue = isInput ? (activeElement as HTMLInputElement).value : ""
      const isSearchInput = activeElement === searchInputRef.current
      const isTyping = isInput && (isSearchInput ? inputValue !== "" : true)

      // 1. Modal specific shortcuts that override everything
      if (sizeModalOpen && activeProductForSize) {
        if (e.key === "Escape") {
          setSizeModalOpen(false)
          setTimeout(() => searchInputRef.current?.focus(), 100)
          return
        }
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setSizeSelectedIndex(s => Math.min(s + 1, (activeProductForSize.variants?.length || 1) - 1))
          return
        }
        if (e.key === "ArrowUp") {
          e.preventDefault()
          setSizeSelectedIndex(s => Math.max(s - 1, 0))
          return
        }
        if (e.key === "Enter") {
          e.preventDefault()
          const matchedSize = activeProductForSize.variants?.[sizeSelectedIndex]
          if (matchedSize) {
            addToCart({ ...activeProductForSize, variant_id: matchedSize.id, name: `${activeProductForSize.name} (${matchedSize.name})`, price: matchedSize.price, code: matchedSize.code || activeProductForSize.code });
            setSizeModalOpen(false);
            setActiveProductForSize(null);
            setSearchQuery("");
            searchInputRef.current?.focus();
            scrollToTop();
          }
          return
        }
        const key = e.key.toLowerCase();
        const matchedSizeByLetter = activeProductForSize.variants?.find((s: any) => s.name.charAt(0).toLowerCase() === key);
        if (matchedSizeByLetter) {
          e.preventDefault();
          addToCart({ ...activeProductForSize, variant_id: matchedSizeByLetter.id, name: `${activeProductForSize.name} (${matchedSizeByLetter.name})`, price: matchedSizeByLetter.price, code: matchedSizeByLetter.code || activeProductForSize.code });
          setSizeModalOpen(false);
          setActiveProductForSize(null);
          setSearchQuery("");
          searchInputRef.current?.focus();
          scrollToTop();
        }
        return
      }

      if (checkoutModalOpen || customizeModalOpen) {
        if (e.key === "Escape") {
          setCheckoutModalOpen(false)
          setCustomizeModalOpen(false)
          setTimeout(() => searchInputRef.current?.focus(), 100)
        }
        if (e.key === "F6" && checkoutModalOpen) {
          e.preventDefault()
          setCheckoutModalOpen(false)
          setTimeout(() => searchInputRef.current?.focus(), 100)
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && customizeModalOpen) {
          e.preventDefault()
          setCustomizeModalOpen(false)
          setTimeout(() => searchInputRef.current?.focus(), 100)
        }
        if (e.key === "Enter" && checkoutModalOpen) {
          e.preventDefault()
          document.getElementById('confirm-payment-btn')?.click()
        }
        return
      }

      // 2. Global Shortcuts (Not dependent on isTyping)
      
      // CTRL + TAB: Cycle Order Type (Also Alt + O as fallback since browsers intercept Ctrl+Tab)
      if ((e.ctrlKey && e.key === 'Tab' && !e.shiftKey) || (e.altKey && e.key.toLowerCase() === 'o')) {
        e.preventDefault()
        const types: ('Dine In' | 'Takeaway' | 'Delivery')[] = ['Dine In', 'Takeaway', 'Delivery']
        const currentType = usePosStore.getState().orderType
        const nextIndex = (types.indexOf(currentType as any) + 1) % types.length
        usePosStore.getState().setOrderType(types[nextIndex])
      }

      // CTRL + SHIFT + TAB: Switch Menu Context (Fast Food / Restaurant / Deals)
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault()
        const contexts: ('Fast Food' | 'Restaurant' | 'Deals')[] = ['Fast Food', 'Restaurant', 'Deals']
        const currentContext = usePosStore.getState().menuContext
        const nextIndex = (contexts.indexOf(currentContext as any) + 1) % contexts.length
        usePosStore.getState().setMenuContext(contexts[nextIndex])
        return
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }

      // CTRL + C: Toggle Customer Panel (if not copying text)
      if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        if (!window.getSelection()?.toString()) {
          e.preventDefault()
          setCustomerModalOpen(prev => !prev)
        }
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        setRecentOrdersModalOpen(prev => !prev)
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setIsPaidPrint(prev => !prev)
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        setIsVIP(prev => !prev)
      }

      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleProceedToPay()
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'z' && editingOrderId) {
        e.preventDefault()
        if (confirm("Cancel editing and discard changes?")) {
          clearEditMode()
        }
      }

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        if (cart.length > 0) {
          setActiveCartItem(cart[0])
          setTempNotes(cart[0].notes || "")
          setTempModifiers(cart[0].selectedModifiers)
          setCustomizeModalOpen(true)
        }
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 't':
            e.preventDefault()
            setTableModalOpen(prev => !prev)
            break
          case 'd':
            e.preventDefault()
            if (cart.length > 0) duplicateItem(cart[0].cartItemId)
            break
          case 'n':
            if (!e.shiftKey) { // we already handled shift+n
              e.preventDefault()
              orderNotesRef.current?.focus()
            }
            break
          case 's':
            e.preventDefault()
            toggleTax()
            break
          case 'h':
            e.preventDefault()
            break
        }
      }

      // Function keys & Escape
      switch (e.key) {
        case "F1":
          e.preventDefault()
          clearCart()
          setCustomer(null)
          break
        case "F2":
          e.preventDefault()
          setCustomerModalOpen(prev => !prev)
          break
        case "F3":
          e.preventDefault()
          searchInputRef.current?.focus()
          break
        case "F4":
          e.preventDefault()
          setRecentOrdersModalOpen(prev => !prev)
          break
        case "F6":
          e.preventDefault()
          handleProceedToPay()
          break
        case "F7":
          e.preventDefault()
          usePosStore.getState().setOrderType('Dine In')
          break
        case "F8":
          e.preventDefault()
          usePosStore.getState().setOrderType('Takeaway')
          break
        case "F9":
          e.preventDefault()
          usePosStore.getState().setOrderType('Delivery')
          break
        case "Escape":
          if (customerModalOpen) setCustomerModalOpen(false)
          else if (tableModalOpen) setTableModalOpen(false)
          else if (recentOrdersModalOpen) setRecentOrdersModalOpen(false)
          else {
            e.preventDefault()
            clearCart()
          }
          break
      }

      // 3. Shortcuts that should ONLY run if NOT typing
      if (isTyping) return

      // Autofocus search on any single character key press
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (!checkoutModalOpen && !customizeModalOpen && !sizeModalOpen && !customerModalOpen && !tableModalOpen && !recentOrdersModalOpen) {
          searchInputRef.current?.focus()
        }
      }

      if (e.ctrlKey && e.key === 'Enter') {
        if (cart.length > 0 && !checkoutModalOpen && !customizeModalOpen && !sizeModalOpen) {
          e.preventDefault()
          handleProceedToPay()
        }
      }

      if (e.key === 'Delete') {
        if (cart.length > 0) {
           e.preventDefault()
           clearCart()
        }
      }

      if (e.key === 'Backspace' || e.key === '-' || e.key === 'Subtract') {
        if (e.repeat) return // Prevent holding key from sending multiple requests
        if (usePosStore.getState().isLoadingOrder) return // Prevent multiple requests if already loading
        if (cart.length > 0 && !checkoutModalOpen && !customizeModalOpen && !sizeModalOpen) {
          e.preventDefault()
          const topItem = cart[0]
          if (topItem.quantity > 1) {
            updateQuantity(topItem.cartItemId, topItem.quantity - 1)
          } else {
            removeFromCart(topItem.cartItemId)
          }
        }
      }

      // 4. Grid Navigation (if not typing, not in search bar)
      if (!isTyping && !checkoutModalOpen && !customizeModalOpen && !sizeModalOpen && !customerModalOpen && !tableModalOpen && !recentOrdersModalOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setGridSelectedIndex(s => Math.min(s + 1, Math.max(0, gridProductsRef.current.length - 1)))
        } else if (e.key === "ArrowUp") {
          e.preventDefault()
          setGridSelectedIndex(s => Math.max(s - 1, 0))
        } else if (e.key === "ArrowRight") {
          e.preventDefault()
          const contexts: ('Fast Food' | 'Restaurant' | 'Deals')[] = ['Fast Food', 'Restaurant', 'Deals']
          const currentContext = usePosStore.getState().menuContext
          const nextIndex = (contexts.indexOf(currentContext as any) + 1) % contexts.length
          usePosStore.getState().setMenuContext(contexts[nextIndex])
          setGridSelectedIndex(0)
        } else if (e.key === "ArrowLeft") {
          e.preventDefault()
          const contexts: ('Fast Food' | 'Restaurant' | 'Deals')[] = ['Fast Food', 'Restaurant', 'Deals']
          const currentContext = usePosStore.getState().menuContext
          const nextIndex = (contexts.indexOf(currentContext as any) - 1 + contexts.length) % contexts.length
          usePosStore.getState().setMenuContext(contexts[nextIndex])
          setGridSelectedIndex(0)
        } else if (e.key === "Enter" && !e.ctrlKey) {
          e.preventDefault()
          const selectedProduct = gridProductsRef.current[gridSelectedIndex]
          if (selectedProduct) {
            if (selectedProduct.variants && selectedProduct.variants.length > 0) {
              setActiveProductForSize(selectedProduct)
              setSizeSelectedIndex(0)
              setSizeModalOpen(true)
            } else {
              addToCart(selectedProduct)
              scrollToTop()
            }
          }
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    cart, checkoutModalOpen, customizeModalOpen, sizeModalOpen, 
    customerModalOpen, tableModalOpen, recentOrdersModalOpen, 
    activeProductForSize, clearCart, setCustomer, updateQuantity, 
    removeFromCart, editingOrderId, clearEditMode, duplicateItem,
    sizeSelectedIndex, gridSelectedIndex
  ])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    searchInputRef.current?.focus()
    return () => clearInterval(timer)
  }, [])

  // Refocus search if clicking outside inputs
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!checkoutModalOpen && !customizeModalOpen && !sizeModalOpen) {
        if (target.tagName !== "BUTTON" && target.tagName !== "INPUT" && target.tagName !== "SELECT" && !target.closest('.panel-handle')) {
          searchInputRef.current?.focus()
        }
      }
    }
    window.addEventListener("click", handleGlobalClick)
    return () => window.removeEventListener("click", handleGlobalClick)
  }, [checkoutModalOpen, customizeModalOpen, sizeModalOpen])

  // Grid Category Filtering
  const gridFilteredProducts = products.filter(p => {
    if (p.lifecycle_state === 'HIDDEN' && !p.isDeal) return false;
    let matchCategory = true
    if (activeCategory === "Favorites") {
      matchCategory = !!p.isFavorite
    } else if (activeCategory !== "All") {
      matchCategory = p.category === activeCategory
    } else {
      // If "All" is selected, filter by menuContext
      if (menuContext === 'Deals' && !p.isDeal) return false;
      if (menuContext !== 'Deals' && p.isDeal) return false;
      const catObj = categories.find(c => c.name === p.category)
      if (catObj && catObj.menuContext && catObj.menuContext !== 'all' && catObj.menuContext !== menuContext) {
        matchCategory = false
      }
    }
    return matchCategory
  }).sort((a, b) => {
    // Sort by display_order for products, deals by code number
    if (a.isDeal && b.isDeal) {
      const aNum = parseInt((a.code || '').replace('D', '')) || 0;
      const bNum = parseInt((b.code || '').replace('D', '')) || 0;
      return aNum - bNum;
    }
    
    const codeA = parseInt(a.code || '') || parseInt(a.product_code || '') || 999999;
    const codeB = parseInt(b.code || '') || parseInt(b.product_code || '') || 999999;
    
    if (codeA !== 999999 && codeB !== 999999 && codeA !== codeB) {
      return codeA - codeB;
    }

    const orderA = a.display_order || 9999;
    const orderB = b.display_order || 9999;
    if (orderA !== orderB) return orderA - orderB;
    
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  })

  useEffect(() => {
    gridProductsRef.current = gridFilteredProducts
    if (gridSelectedIndex >= gridFilteredProducts.length) {
      setGridSelectedIndex(Math.max(0, gridFilteredProducts.length - 1))
    }
  }, [gridFilteredProducts, gridSelectedIndex])

  useEffect(() => {
    const element = document.getElementById(`grid-item-${gridSelectedIndex}`)
    if (element) {
      element.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [gridSelectedIndex])

  // Global Search Filtering & Sorting
  const searchResults = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return []
    const q = debouncedSearchQuery.toLowerCase().trim()
    const matches = products.filter(p => {
      if (p.lifecycle_state === 'HIDDEN' && !p.isDeal) return false;
      const pName = p.name.toLowerCase().replace(/\s+/g, '')
      const pCode = (p.code || '').toLowerCase()
      const searchStr = q.replace(/\s+/g, '')
      return pName.includes(searchStr) || pCode.includes(searchStr)
    })

    return matches.sort((a, b) => {
      const aName = a.name.toLowerCase().replace(/\s+/g, '')
      const bName = b.name.toLowerCase().replace(/\s+/g, '')
      const aCode = (a.code || '').toLowerCase()
      const bCode = (b.code || '').toLowerCase()
      const searchStr = q.replace(/\s+/g, '')

      // 1. Exact Code
      if (aCode === searchStr && bCode !== searchStr) return -1
      if (bCode === searchStr && aCode !== searchStr) return 1

      // 2. Exact Name
      if (aName === searchStr && bName !== searchStr) return -1
      if (bName === searchStr && aName !== searchStr) return 1

      // 3. Starts With
      const aStarts = aName.startsWith(searchStr) || aCode.startsWith(searchStr)
      const bStarts = bName.startsWith(searchStr) || bCode.startsWith(searchStr)
      if (aStarts && !bStarts) return -1
      if (bStarts && !aStarts) return 1

      // 5. Popularity
      if (a.isPopular && !b.isPopular) return -1
      if (b.isPopular && !a.isPopular) return 1

      // 6. Alphabetical
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [products, debouncedSearchQuery])

  useEffect(() => {
    if (isSearchFocused && searchResults.length > 0) {
      const activeEl = document.getElementById(`search-item-${searchSelectedIndex}`)
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [searchSelectedIndex, isSearchFocused, searchResults.length])
  const scrollToTop = () => {
    setTimeout(() => {
      cartTopRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 100)
  }

  const handleProductClick = (product: Product) => {
    if (product.variants && product.variants.length > 0) {
      setActiveProductForSize(product)
      setSizeSelectedIndex(0)
      setSizeModalOpen(true)
    } else {
      addToCart(product)
      setSearchQuery("") // Auto clear search
      searchInputRef.current?.focus()
      scrollToTop()
    }
  }

  // Fast Order Entry
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery || searchResults.length === 0) return
    handleProductClick(searchResults[searchSelectedIndex] || searchResults[0])
  }

  const saveCustomize = () => {
    if (activeCartItem) {
      updateItemModifiers(activeCartItem.cartItemId, tempModifiers)
      updateItemNotes(activeCartItem.cartItemId, tempNotes)
    }
    setCustomizeModalOpen(false)
    setTimeout(() => searchInputRef.current?.focus(), 100)
  }

  const toggleTempModifier = (mod: Modifier) => {
    const exists = tempModifiers.find(m => m.name === mod.name)
    if (exists) {
      setTempModifiers(tempModifiers.filter(m => m.name !== mod.name))
    } else {
      setTempModifiers([...tempModifiers, mod])
    }
  }



  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full font-sans overflow-hidden text-foreground selection:bg-orange-500/30">

      {/* Main Content Area */}
      <PanelGroup id="pos-main-layout" orientation="horizontal" className="flex-1 overflow-hidden bg-background">
          
          {/* Left Panel: Categories */}
          <Panel defaultSize="18%" minSize="15%" maxSize="30%" className="flex flex-col z-10 border-r border-border bg-card">
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
              {categories.filter(c => c.menuContext === 'all' || !c.menuContext || c.menuContext === menuContext).map(cat => {
                const isActive = activeCategory === cat.name;
                return (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.1 }}
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.name)}
                    title={cat.name}
                    className={`w-full flex items-center p-3.5 rounded-2xl transition-all duration-200 ${
                      isActive 
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                        : "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                    } ${leftCollapsed ? 'justify-center' : 'justify-start gap-4'}`}
                  >
                    <div className={isActive ? "text-white" : "text-muted-foreground"}>
                      {getCategoryIcon(cat.name)}
                    </div>
                    {!leftCollapsed && (
                      <span className="font-bold text-sm tracking-wide truncate">{cat.name}</span>
                    )}
                  </motion.button>
                )
              })}
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-border/50 hover:bg-orange-500/50 transition-colors cursor-col-resize z-50" />

          {/* Center Panel: Product Grid & Search */}
          <Panel defaultSize="52%" minSize="40%" className="flex flex-col bg-background relative">
            
            {/* Center Header: Search & Filters */}
            <div className="p-4 shrink-0 flex items-center justify-between gap-4">
              <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md" onFocus={() => setIsSearchFocused(true)} onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setIsSearchFocused(false)
                }
              }}>
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      if (searchQuery) {
                        e.preventDefault(); e.stopPropagation(); setSearchQuery("");
                      }
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault(); setSearchSelectedIndex(s => Math.min(s + 1, Math.max(0, searchResults.length - 1)));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault(); setSearchSelectedIndex(s => Math.max(s - 1, 0));
                    } else if (e.key === "Enter" || e.key === "Tab") {
                      if (sizeModalOpen) return; // let global listener handle size selection
                      if (searchQuery) {
                        e.preventDefault(); e.stopPropagation();
                        if (searchResults[searchSelectedIndex]) {
                          handleProductClick(searchResults[searchSelectedIndex])
                        }
                      }
                    } else if (e.key === "Backspace" && e.ctrlKey) {
                      setSearchQuery("")
                    }
                  }}
                  placeholder="Search Product Name, Product Code, Barcode..."
                  className="w-full h-12 pl-12 pr-12 rounded-2xl bg-card border border-border focus:border-orange-500 focus:bg-background outline-none text-base font-bold transition-all placeholder:text-muted-foreground shadow-sm"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-secondary text-muted-foreground text-[10px] font-bold px-2 py-0.5 rounded border border-border pointer-events-none">F3</div>

                {/* Global Search Dropdown */}
                <AnimatePresence>
                  {isSearchFocused && debouncedSearchQuery && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] overflow-hidden z-50 max-h-[60vh] flex flex-col"
                    >
                      {searchResults.length === 0 ? (
                        <div className="p-8 flex flex-col items-center justify-center text-muted-foreground">
                          <Search className="w-12 h-12 opacity-20 mb-3" />
                          <p className="font-bold">No matching products found</p>
                        </div>
                      ) : (
                        <div className="overflow-y-auto custom-scrollbar p-2">
                          {searchResults.map((product, index) => {
                            const isSelected = index === searchSelectedIndex
                            return (
                              <button
                                type="button"
                                id={`search-item-${index}`}
                                key={product.id}
                                onMouseEnter={() => setSearchSelectedIndex(index)}
                                onClick={() => handleProductClick(product)}
                                className={`w-full flex items-center gap-4 p-3 rounded-xl text-left transition-colors ${isSelected ? 'bg-secondary border-orange-500/50' : 'bg-transparent border-transparent'} border`}
                              >
                                <div className={`w-12 h-12 rounded-lg shrink-0 overflow-hidden relative ${!product.image ? getCategoryGradient(product.category) : ''}`}>
                                  {product.image ? (
                                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/50">
                                      {getCategoryIcon(product.category)}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="bg-background px-1.5 py-0.5 rounded text-[10px] font-bold text-muted-foreground border border-border shrink-0">{product.code}</span>
                                    <h4 className="font-bold text-sm truncate">{product.name}</h4>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                    <span className="font-bold text-orange-500">Rs {product.price.toLocaleString()}</span>
                                    <span>•</span>
                                    <span className="truncate">{product.category}</span>
                                    {(product.isPopular || product.isFavorite) && <span>•</span>}
                                    {product.isPopular && <span className="bg-red-500/10 text-red-500 px-1 rounded font-bold text-[10px] uppercase">Popular</span>}
                                    {product.isFavorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                                  </div>
                                </div>
                                {product.stockStatus && (
                                  <div className="shrink-0 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">
                                    {product.stockStatus}
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>

              <div className="flex items-center gap-1 bg-card p-1 rounded-xl border border-border">
                {(['Fast Food', 'Restaurant', 'Deals'] as const).map(context => (
                  <button
                    key={context}
                    onClick={() => { setMenuContext(context); setActiveCategory("All"); }}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors duration-200 ${
                      menuContext === context ? 'bg-orange-500 shadow-sm text-white' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {context}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 p-4 pt-0 overflow-y-auto custom-scrollbar">
              <div className={`grid gap-4 ${
                gridDensity === 'small' ? 'grid-cols-4 md:grid-cols-5 xl:grid-cols-6' :
                gridDensity === 'medium' ? 'grid-cols-3 md:grid-cols-4 xl:grid-cols-5' :
                'grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
              }`}>
                {gridFilteredProducts.map((product, index) => {
                  const isSelected = index === gridSelectedIndex;
                  return (
                  <motion.button
                    id={`grid-item-${index}`}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    key={product.id}
                    onMouseEnter={() => setGridSelectedIndex(index)}
                    onClick={() => handleProductClick(product)}
                    className={`rounded-[1.25rem] shadow-sm overflow-hidden flex flex-col text-left hover:opacity-90 transition-all group relative ${getCategoryStyles(product.category || categories.find(c => c.id === product.category_id)?.name)} ${isSelected ? 'ring-4 ring-orange-500 shadow-[0_8px_30px_rgba(249,115,22,0.3)] scale-[1.02]' : 'hover:shadow-[0_8px_30px_rgba(0,0,0,0.15)]'}`}
                  >
                    {gridDensity !== 'small' && (
                      <div className={`${gridDensity === 'large' ? 'h-40' : 'h-32'} w-full relative overflow-hidden shrink-0 ${!product.image ? getCategoryGradient(product.category || categories.find(c => c.id === product.category_id)?.name) : ''}`}>
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-white/50 mix-blend-overlay">
                            {getCategoryIcon(product.category)}
                          </div>
                        )}
                        {/* Subtle Code Badge */}
                        <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-bold tracking-widest text-foreground shadow-sm">
                          {product.code}
                        </div>
                      </div>
                    )}
                    <div className="p-4 flex flex-col flex-1 relative">
                      {gridDensity === 'small' && (
                        <div className="absolute top-3 right-3 text-[10px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                          {product.code}
                        </div>
                      )}
                      <h4 className={`font-bold line-clamp-2 leading-tight flex-1 pr-8 text-foreground ${gridDensity === 'large' ? 'text-lg' : 'text-sm'}`}>
                        {product.name}
                      </h4>
                      <p className={`text-orange-500 font-black mt-2 ${gridDensity === 'large' ? 'text-2xl' : 'text-lg'}`}>
                        Rs {product.displayPrice !== undefined ? product.displayPrice.toLocaleString() : product.price.toLocaleString()}
                      </p>
                    </div>
                  </motion.button>
                )})}
              </div>
              {gridFilteredProducts.length === 0 && (
                <div className="flex flex-col items-center justify-center text-muted-foreground h-full min-h-[50vh]">
                  <Search className="w-16 h-16 opacity-20 mb-4" />
                  <h2 className="text-2xl font-bold">No products found</h2>
                </div>
              )}
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-border/50 hover:bg-orange-500/50 transition-colors cursor-col-resize z-50" />
          {/* Right Panel: Order Ticket */}
          <Panel defaultSize="30%" minSize="25%" maxSize="45%" className="flex flex-col z-10 shadow-xl border-l border-border bg-card">
            {rightCollapsed ? (
              <div className="flex-1 flex flex-col items-center justify-start p-2 gap-4 pt-4 border-l border-border">
                <button onClick={() => setRightCollapsed(false)} className="p-3 bg-orange-500 text-white rounded-xl shadow-lg hover:bg-orange-400">
                  <Receipt className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header: Order Info */}
                <div className="p-3 border-b border-border flex items-center justify-between bg-secondary/30">
                  <div>
                    <h2 className="font-black tracking-wider uppercase text-muted-foreground text-[10px] mb-2 mt-1">Order #{orderCounter}</h2>
                    <p className="font-black text-lg text-foreground leading-none">{orderType}</p>
                  </div>
                  
                  {isVIP && (
                    <div className="flex flex-col items-center justify-center">
                      <span className="bg-gradient-to-r from-amber-200 to-yellow-500 text-yellow-950 font-black text-[11px] px-3 py-1 rounded-full uppercase tracking-widest shadow-sm border border-yellow-400/50 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-950" /> VIP
                      </span>
                    </div>
                  )}

                  <div className="text-right">
                    <div className="mb-1">
                      <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded uppercase border ${
                        isPaidPrint ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {isPaidPrint ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                       {(['Dine In', 'Takeaway', 'Delivery'] as const).map(type => (
                         <button key={type} onClick={() => setOrderType(type)} className={`p-1.5 rounded-lg transition-colors ${orderType === type ? 'bg-[var(--checkout-bg)] text-white shadow-sm' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
                           {type === 'Dine In' ? <Store className="w-4 h-4" /> : type === 'Takeaway' ? <UtensilsCrossed className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                         </button>
                       ))}
                    </div>
                  </div>
                </div>

                {/* Edit Mode Badge */}
                {editingOrderId && (
                  <div className="px-3 py-2 bg-orange-500/10 border-b border-orange-500/20 flex items-center justify-between shadow-inner">
                    <div className="flex items-center gap-2">
                      <Edit className="w-4 h-4 text-orange-500" />
                      <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Editing Order</span>
                    </div>
                    <button onClick={clearEditMode} className="text-[10px] font-bold bg-orange-500/20 text-orange-600 px-2 py-1 rounded hover:bg-orange-500 hover:text-white transition-colors">
                      Cancel Edit
                    </button>
                  </div>
                )}

                {/* Customer & Table Management */}
                <div className="p-2 border-b border-border bg-card grid grid-cols-2 gap-2">
                  <button onClick={() => setCustomerModalOpen(true)} className="flex items-center gap-2 p-2 rounded-xl border border-border bg-secondary/50 hover:bg-secondary hover:border-orange-500/50 transition-all text-left">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      {usePosStore.getState().customer?.isVip ? <Star className="w-4 h-4 text-orange-500 fill-orange-500" /> : <User className="w-4 h-4" />}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-foreground truncate">{usePosStore.getState().customer?.name || "Select Customer"}</p>
                      <p className="text-[10px] text-muted-foreground font-bold truncate flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" /> {usePosStore.getState().customer?.phone || "Press F2"}
                      </p>
                    </div>
                  </button>
                  <div className="grid grid-cols-1 gap-2">
                    <button onClick={() => setTableModalOpen(true)} className="flex flex-col items-start justify-center p-2 rounded-xl border border-border bg-secondary/50 hover:bg-secondary hover:border-orange-500/50 transition-all w-full">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Hash className="w-3 h-3" /> Table</p>
                      <p className="text-sm font-black text-foreground">{tableNumber || "Ctrl+T"}</p>
                    </button>
                  </div>
                </div>

                <PanelGroup orientation="vertical" className="flex-1 flex flex-col h-full overflow-hidden">
                  {/* Top Panel: Cart Items */}
                  <Panel defaultSize={50} minSize={30} className="flex flex-col relative overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 h-full">
                      <div ref={cartTopRef} />
                      {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center min-h-[200px]">
                          <CircleDot className="w-12 h-12 opacity-20 mb-4 text-orange-500" />
                          <p className="font-bold text-sm">Order is empty</p>
                        </div>
                      ) : (
                        <AnimatePresence initial={false}>
                          {cart.map((item, index) => (
                            <motion.div 
                              layout
                              key={item.cartItemId || `cart-item-${index}`} 
                              className={`border rounded-xl p-3 flex gap-3 relative group ${
                                item.editState === 'removed' ? 'bg-background border-border/50 opacity-50' :
                                item.editState === 'new' ? 'bg-card border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.1)]' :
                                item.editState === 'modified' ? 'bg-card border-orange-500/50' : 'bg-card border-border'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`font-bold text-sm truncate ${item.editState === 'removed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {item.name || "Unknown Item"}
                                  </p>
                                  {item.editState === 'new' && <span className="text-[10px] bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded font-bold">NEW</span>}
                                  {item.editState === 'modified' && <span className="text-[10px] bg-orange-500/20 text-orange-500 px-1.5 py-0.5 rounded font-bold">MODIFIED</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                  <div className={`flex items-center border border-border rounded-lg bg-secondary ${item.editState === 'removed' ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <button onClick={() => {
                                      if (item.quantity > 1) {
                                        updateQuantity(item.cartItemId, item.quantity - 1)
                                      } else {
                                        if (editingOrderId && item.editState !== 'new') {
                                          const pin = prompt("Voiding an existing item requires Authorization. Enter PIN (1234):")
                                          if (pin !== '1234') { alert("Unauthorized."); return }
                                          setRemovingCartItemId(item.cartItemId)
                                        } else {
                                          removeFromCart(item.cartItemId)
                                        }
                                      }
                                    }} className="p-1 hover:bg-background rounded">
                                      <Minus className="w-4 h-4 text-foreground" />
                                    </button>
                                    <span className={`w-8 text-center font-bold text-sm ${item.editState === 'removed' ? 'line-through' : ''}`}>{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)} className="p-1 hover:bg-secondary rounded">
                                      <Plus className="w-4 h-4 text-foreground" />
                                    </button>
                                  </div>
                                </div>
                                {item.removalReason && (
                                  <p className="text-xs text-red-500 mt-1 font-semibold flex items-center gap-1">
                                    <XOctagon className="w-3 h-3" /> {item.removalReason}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className={`font-bold ${item.editState === 'removed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                  Rs {(item.subtotal || 0).toLocaleString()}
                                </p>
                                {item.editState !== 'removed' && (
                                  <button 
                                    onClick={() => {
                                      if (editingOrderId && item.editState !== 'new') {
                                        setRemovingCartItemId(item.cartItemId)
                                      } else {
                                        removeFromCart(item.cartItemId)
                                      }
                                    }} 
                                    className="text-red-500 hover:text-red-600 mt-2 ml-auto block group"
                                  >
                                    <XOctagon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      )}
                    </div>
                  </Panel>

                  <PanelResizeHandle className="h-1 bg-border/50 hover:bg-orange-500/50 transition-colors cursor-row-resize z-50 flex items-center justify-center group relative">
                    <div className="absolute inset-x-0 h-4 -top-1.5 flex items-center justify-center cursor-row-resize">
                      <div className="w-12 h-1 bg-border/80 group-hover:bg-orange-500 rounded-full transition-colors" />
                    </div>
                  </PanelResizeHandle>

                  {/* Bottom Panel: Subtotal & Actions */}
                  <Panel defaultSize={50} minSize={25} className="flex flex-col bg-card z-10">
                    <div className="p-3 flex flex-col h-full overflow-y-auto custom-scrollbar">
                      <div className="space-y-1 mb-2">
                        <div className="flex justify-between text-xs font-bold text-muted-foreground">
                          <span>Subtotal</span>
                          <span>Rs {getSubtotal().toLocaleString()}</span>
                        </div>

                        
                        {orderType === 'Dine In' && isTaxEnabled && (
                          <div className="flex justify-between text-xs font-black text-foreground border-l-2 border-orange-500 pl-2 p-1 -mx-1">
                            <span>Service Charges (7%)</span>
                            <span>Rs {getTax().toLocaleString()}</span>
                          </div>
                        )}

                        {orderType === 'Delivery' && (
                          <div className="flex justify-between items-center text-xs font-black text-foreground border-l-2 border-blue-500 pl-2 p-1 -mx-1">
                            <span>Delivery Charges</span>
                            <div className="flex items-center gap-1">
                              <span>Rs</span>
                                <input 
                                  type="number"
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
                        <div className="flex justify-between text-lg font-black text-foreground pt-1.5 border-t border-border">
                          <span>Total</span>
                          <span>Rs {getNetTotal().toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 mb-2">
                        <button 
                          onClick={handleProceedToPay}
                          disabled={cart.length === 0}
                          className="w-full py-1.5 bg-[var(--checkout-bg)] hover:bg-[var(--checkout-hover)] text-[var(--checkout-text)] font-black text-base rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          PROCEED TO PAY <span className="bg-white/30 text-white text-[10px] px-1.5 py-0.5 rounded-md ml-1 font-bold">CTRL+ENTER</span>
                        </button>
                      </div>

                      <div className="relative mb-2">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <Edit2 className="w-4 h-4" />
                        </div>
                        <input 
                          ref={orderNotesRef}
                          type="text"
                          placeholder="Add Order Notes / Special Instructions."
                          value={orderNotes}
                          onChange={(e) => setOrderNotes(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 bg-secondary/60 hover:bg-secondary border border-border/50 rounded-xl text-xs font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#fcb47c]/50 transition-colors"
                        />
                      </div>

                      <div className="grid grid-cols-5 gap-1.5 pb-1 flex-1">
                        <button 
                          onClick={() => setIsPaidPrint(!isPaidPrint)}
                          className={`p-1 font-black rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors border ${
                            isPaidPrint 
                              ? 'bg-green-100 text-green-700 hover:bg-green-200 border-green-300' 
                              : 'bg-red-100 text-red-700 hover:bg-red-200 border-red-300'
                          }`}
                        >
                          <span className="text-[10px] uppercase">{isPaidPrint ? 'Paid' : 'Unpaid'}</span>
                        </button>
                        <button 
                          onClick={toggleTax}
                          className={`p-1 font-black rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors border ${
                            isTaxEnabled 
                              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-300' 
                              : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground border-transparent hover:border-border'
                          }`}
                        >
                          <Tag className={`w-4 h-4 ${isTaxEnabled ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
                          <span className="text-[9px] uppercase text-center leading-tight font-black">Charges</span>
                        </button>
                        <button 
                          onClick={() => usePosStore.getState().completeOrder([])}
                          disabled={cart.length === 0}
                          className="p-1 bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground font-black rounded-lg disabled:opacity-50 flex flex-col items-center justify-center gap-0.5 transition-colors border border-transparent hover:border-border"
                        >
                          <Monitor className="w-4 h-4 stroke-[1.5]" />
                          <span className="text-[9px] uppercase">KDS</span>
                        </button>
                        <button 
                          onClick={() => window.print()}
                          disabled={cart.length === 0}
                          className="p-1 bg-white hover:bg-orange-50 text-[#ff7b00] border border-[#ff7b00]/30 hover:border-[#ff7b00]/60 font-black rounded-lg disabled:opacity-50 flex flex-col items-center justify-center gap-0.5 transition-colors shadow-sm"
                        >
                          <Printer className="w-4 h-4 stroke-[2]" />
                          <span className="text-[9px] uppercase">Print</span>
                        </button>
                        <button 
                          onClick={() => {
                            clearCart();
                            setCustomer(null);
                            setOrderNotes("");
                          }}
                          disabled={cart.length === 0}
                          className="p-1 bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground font-black rounded-lg disabled:opacity-50 flex flex-col items-center justify-center gap-0.5 transition-colors border border-transparent hover:border-border"
                        >
                          <XCircle className="w-4 h-4 stroke-[1.5]" />
                          <span className="text-[9px] uppercase">Clear</span>
                        </button>
                      </div>
                    </div>
                  </Panel>
                </PanelGroup>
              </div>
            )}
          </Panel>
        
      </PanelGroup>

      {/* Customize Modal */}
      <AnimatePresence>
        {customizeModalOpen && activeCartItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCustomizeModalOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-card border border-border shadow-2xl rounded-[2rem] flex flex-col overflow-hidden max-h-[85vh]">
              <div className="p-6 border-b border-border bg-secondary/30">
                <h2 className="text-2xl font-black tracking-tight text-foreground">{activeCartItem.name}</h2>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                {activeCartItem.modifiers && activeCartItem.modifiers.length > 0 ? (
                  <div>
                    <h3 className="font-bold uppercase text-xs tracking-widest text-muted-foreground mb-4">Add-ons & Modifiers</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {activeCartItem.modifiers.map(mod => {
                        const isSelected = tempModifiers.some(m => m.name === mod.name)
                        return (
                          <button key={mod.name} onClick={() => toggleTempModifier(mod)} className={`flex justify-between p-6 rounded-2xl border-[3px] font-black text-lg transition-all ${isSelected ? 'border-[#00E676] bg-[#00E676]/10 text-[#00E676]' : 'border-border bg-secondary text-foreground hover:border-muted-foreground'}`}>
                            <span>{mod.name}</span><span>+Rs {mod.price.toLocaleString()}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground font-bold">
                    No modifiers available for this item.
                  </div>
                )}
                
                {/* Notes section */}
                <div>
                  <h3 className="font-bold uppercase text-xs tracking-widest text-muted-foreground mb-4">Special Instructions</h3>
                  <textarea
                    value={tempNotes}
                    onChange={(e) => setTempNotes(e.target.value)}
                    placeholder="E.g. No onions, extra spicy..."
                    className="w-full h-24 p-4 rounded-2xl bg-secondary border border-border focus:border-orange-500 outline-none text-sm transition-colors text-foreground placeholder:text-muted-foreground resize-none"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-border flex gap-3 bg-card">
                <button onClick={saveCustomize} className="flex-1 py-4 bg-orange-500 text-white font-black text-lg rounded-2xl hover:bg-orange-400 shadow-lg shadow-orange-500/20 active:scale-95 transition-all">Save Changes</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Size Selection Modal */}
      <AnimatePresence>
        {sizeModalOpen && activeProductForSize && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSizeModalOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-[2rem] flex flex-col overflow-hidden">
              <div className="p-6 border-b border-border bg-secondary/30 text-center">
                <h2 className="text-2xl font-black tracking-tight text-foreground">{activeProductForSize.name}</h2>
                <p className="text-muted-foreground font-bold mt-1">Select Size</p>
              </div>
              <div className="p-6 grid gap-3">
                {activeProductForSize.variants?.map((size: any, index: number) => {
                  // Determine shortcut based on name
                  const shortcut = size.name.charAt(0).toUpperCase();
                  const isSelected = index === sizeSelectedIndex;
                  return (
                    <button 
                      key={size.name} 
                      onMouseEnter={() => setSizeSelectedIndex(index)}
                      onClick={() => {
                        addToCart({ ...activeProductForSize, variant_id: size.id, name: `${activeProductForSize.name} (${size.name})`, price: size.price, code: size.code || activeProductForSize.code });
                        setSizeModalOpen(false);
                        setActiveProductForSize(null);
                        setSearchQuery("");
                        searchInputRef.current?.focus();
                        scrollToTop();
                      }} 
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isSelected ? 'border-orange-500 bg-orange-500/10 text-orange-500 shadow-md scale-[1.02]' : 'border-border bg-secondary text-foreground hover:border-orange-500 hover:text-orange-500'} font-bold`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${isSelected ? 'bg-orange-500 text-white' : 'bg-background'}`}>{shortcut}</span>
                        <span className="text-lg">{size.name}</span>
                      </div>
                      <span className="text-lg">Rs {size.price.toLocaleString()}</span>
                    </button>
                  )
                })}
              </div>
              <div className="p-4 text-center text-muted-foreground text-xs font-bold bg-secondary/20">
                Press S, M, L to quick-select
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Checkout Modal */}
      <AnimatePresence>
        {checkoutModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCheckoutModalOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden">
               <div className="p-4 border-b border-border bg-secondary/30 text-center">
                 <h2 className="text-xl font-black mb-1 text-foreground">Complete Payment</h2>
                 <p className="text-sm text-muted-foreground font-bold">Total Amount Due</p>
               </div>
               
               <div className="p-5 text-center flex flex-col gap-4">
                 <p className="text-4xl font-black text-orange-500 tracking-tighter">Rs {getNetTotal().toLocaleString()}</p>
                 
                 <div className="grid grid-cols-3 gap-2">
                   {(["Cash", "Credit Card", "Debit Card", "JazzCash", "EasyPaisa", "Meezan", "Bank Transfer"] as PaymentMethod[]).map(method => (
                     <button
                       key={method}
                       onClick={() => {
                         setSelectedPaymentMethod(method)
                         if (method !== "Cash") setAmountReceived(getNetTotal().toString())
                       }}
                       className={`p-3 rounded-xl text-xs font-bold border transition-all ${selectedPaymentMethod === method ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20' : 'bg-secondary text-muted-foreground border-border hover:border-orange-500/50 hover:bg-secondary/80'}`}
                     >
                       {method}
                     </button>
                   ))}
                 </div>

                 {selectedPaymentMethod === "Cash" && (
                   <div className="bg-secondary/50 p-4 rounded-2xl border border-border space-y-3">
                     <div className="flex items-center justify-between gap-4">
                       <label className="font-bold text-sm text-muted-foreground">Amount Received:</label>
                       <div className="relative w-1/2">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Rs</span>
                         <input 
                           type="number"
                           value={amountReceived}
                           onChange={(e) => setAmountReceived(e.target.value)}
                           className="w-full h-10 pl-9 pr-3 rounded-lg bg-background border border-border focus:border-orange-500 outline-none font-black text-base text-right"
                           placeholder={getNetTotal().toString()}
                           autoFocus
                         />
                       </div>
                     </div>
                     
                     {Number(amountReceived) >= getNetTotal() && (
                       <div className="flex items-center justify-between text-emerald-500 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                         <span className="font-bold text-sm">Change Due:</span>
                         <span className="font-black text-lg">Rs {(Number(amountReceived) - getNetTotal()).toLocaleString()}</span>
                       </div>
                     )}
                     
                     {Number(amountReceived) > 0 && Number(amountReceived) < getNetTotal() && (
                       <div className="flex items-center justify-between text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
                         <span className="font-bold text-sm">Remaining:</span>
                         <span className="font-black text-lg">Rs {(getNetTotal() - Number(amountReceived)).toLocaleString()}</span>
                       </div>
                     )}

                     {/* Quick Cash Buttons */}
                     <div className="grid grid-cols-4 gap-2 pt-2">
                       {[500, 1000, 5000, getNetTotal()].map(amt => (
                         <button 
                           key={amt}
                           onClick={() => setAmountReceived(amt.toString())}
                           className="py-2 bg-background border border-border rounded-lg text-xs font-bold hover:border-orange-500 hover:text-orange-500 transition-colors"
                         >
                           {amt === getNetTotal() ? "Exact" : amt}
                         </button>
                       ))}
                     </div>
                   </div>
                 )}
               </div>

               <div className="p-4 bg-secondary/30 border-t border-border flex gap-3">
                 <button 
                   id="confirm-payment-btn"
                   disabled={selectedPaymentMethod === "Cash" && (Number(amountReceived) < getNetTotal() && amountReceived !== "")}
                   onClick={() => {
                     const amt = amountReceived ? Number(amountReceived) : getNetTotal()
                     
                     completeOrder(
                       isPaidPrint ? [{ 
                         id: `pay-${Date.now()}`, 
                         method: selectedPaymentMethod, 
                         amount: getNetTotal(),
                         received: amt,
                         change: Math.max(0, amt - getNetTotal()),
                         timestamp: new Date().toISOString(),
                         cashier: user?.name || "Ahmed",
                         status: 'Completed'
                       }] : []
                     );
                     
                     window.print();
                     setTimeout(() => {
                       clearCart(); 
                       setCheckoutModalOpen(false);
                       setIsVIP(false);
                       setOrderNotes("");
                       setSelectedPaymentMethod("Cash");
                       setAmountReceived("");
                     }, 500);
                   }} 
                   className="w-full py-3 bg-orange-500 text-white font-black rounded-xl text-base hover:bg-orange-400 shadow-md shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                 >
                   <Printer className="w-5 h-5" /> Confirm & Print Receipt
                 </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Hidden Receipt for Printing (80mm Thermal Style) */}
      {/* Hidden Receipt for Printing (80mm Thermal Style) */}
      <div className="hidden print:block print-receipt absolute inset-0 bg-white z-[9999] text-black font-sans p-2" style={{ width: '80mm', maxWidth: '300px' }}>
        
        {/* Header section with QR, Title, and Logo */}
        <div className="flex justify-between items-start mb-2">
          {/* Left QR Code */}
          <div className="flex flex-col items-center shrink-0">
            <img src="/qr.png" alt="QR" className="w-14 h-14 object-cover" />
            <span className="text-[7px] mt-0.5">Scan to Pay</span>
          </div>

          {/* Center Title */}
          <div className="text-center font-bold text-[13px] leading-tight flex-1 px-1 mt-4">
            Dubai Food &<br />Resturant
          </div>

          {/* Right Logo & Receipt Num */}
          <div className="flex flex-col items-end shrink-0">
            <span className="text-[9px] mb-1">Receipt - Order #{orderCounter}</span>
            <img src="/logo.jpg" alt="Dubai Food Point Logo" className="w-14 h-14 object-contain shrink-0" />
          </div>
        </div>
        
        {/* Address & Contact */}
        <div className="text-center text-[10px] text-gray-800 leading-tight mb-3 mt-2 font-medium">
          Opposite Akbar Plaza Near Waqas Nazir Printers Layyah<br />Road,<br />
          Chowk Azam (Layyah)<br />
          Contact: 0308-8020784, 0345-6420784
        </div>

        {/* VIP Badge */}
        {isVIP && (
          <div className="flex justify-center mb-3">
            <div className="border border-black px-4 py-1 text-[11px] font-black tracking-widest uppercase flex items-center gap-2 rounded-sm shadow-sm">
              ★ VIP ORDER ★
            </div>
          </div>
        )}



        <div className="w-full border-t border-gray-300 mb-3"></div>

        {/* Order Details */}
        <div className="text-[11px] flex flex-col gap-1 font-medium text-black mb-3">
          <div className="flex"><span className="font-bold w-28">Order ID:</span> #{orderCounter}</div>
          {orderType === 'Dine In' ? (
            <div className="flex"><span className="font-bold w-28">Table No:</span> {tableNumber || 'N/A'}</div>
          ) : (
            <div className="flex"><span className="font-bold w-28">Customer:</span> {usePosStore.getState().customer?.name || 'Dummy'}</div>
          )}
          {orderType !== 'Dine In' && usePosStore.getState().customer?.phone && (
            <div className="flex"><span className="font-bold w-28">Customer Contact:</span> {usePosStore.getState().customer?.phone}</div>
          )}
          {orderType !== 'Dine In' && usePosStore.getState().customer?.notes && (
            <div className="flex"><span className="font-bold w-28">Notes:</span> <span className="flex-1 whitespace-pre-wrap">{usePosStore.getState().customer?.notes}</span></div>
          )}
          <div className="flex"><span className="font-bold w-28">Order Type:</span> {orderType}</div>
          <div className="flex"><span className="font-bold w-28">Cashier:</span> {user?.name || "Cashier"}</div>
          <div className="flex"><span className="font-bold w-28">Status:</span> {isPaidPrint ? 'Paid' : 'Unpaid'}</div>
          <div className="flex">
            <span className="font-bold w-28">Time:</span> 
            {currentTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric'})}, {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit'})}
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-[11px] mb-3 border-collapse border border-black">
          <thead>
            <tr className="border-b border-black font-bold text-center">
              <td className="border-r border-black py-1 px-1">Item</td>
              <td className="border-r border-black py-1 px-1 w-10">Qty</td>
              <td className="py-1 px-1 w-20">Total</td>
            </tr>
          </thead>
          <tbody>
            {cart.map(item => {
              const modifierTotal = item.selectedModifiers.reduce((sum, mod) => sum + mod.price, 0)
              const itemTotal = (item.price + modifierTotal) * item.quantity
              return (
                <tr key={item.cartItemId} className="border-b border-black last:border-b-0">
                  <td className="border-r border-black py-1 px-2 text-left">
                    {item.name}
                    {item.selectedModifiers.map(mod => (
                      <div key={mod.name} className="text-[9px] text-gray-600">+ {mod.name}</div>
                    ))}
                    {item.notes && (
                      <div className="text-[9px] text-gray-800 italic mt-0.5"><span className="font-bold">Note:</span> {item.notes}</div>
                    )}
                  </td>
                  <td className="border-r border-black py-1 px-1 text-center font-bold">{item.quantity}</td>
                  <td className="py-1 px-2 text-right">Rs {itemTotal.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex flex-col items-end text-[11px] mb-2 pr-1">
          <div className="mb-1 text-right">Subtotal: Rs {getSubtotal().toFixed(2)}</div>
          {orderType === 'Dine In' && getTax() > 0 && (
            <div className="mb-1 text-right">Service Charges: Rs {getTax().toFixed(2)}</div>
          )}
          {orderType === 'Delivery' && deliveryCharges > 0 && (
            <div className="mb-1 text-right">Delivery Charges: Rs {deliveryCharges.toFixed(2)}</div>
          )}
          <div className="font-black text-[13px] mt-1 underline decoration-2 underline-offset-2">
            Total Amount: Rs {getNetTotal().toFixed(2)}
          </div>
        </div>

        {/* Order Notes */}
        {orderNotes && (
          <div className="text-[11px] font-medium border-t border-black pt-2 mb-2 italic">
            <span className="font-bold">Order Notes:</span> {orderNotes}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-6 text-[11px] text-gray-800">
          <p>Thank you for your order!</p>
          <p>Please visit again.</p>
        </div>
      </div>
      
      {/* Portals / Global Modals for POS */}
      <CustomerPanelModal 
        isOpen={customerModalOpen} 
        onClose={() => setCustomerModalOpen(false)} 
        onSuccess={() => {
          if (orderType === 'Delivery' && cart.length > 0) {
            setCheckoutModalOpen(true)
          }
        }}
      />
      <TableSelectorModal isOpen={tableModalOpen} onClose={() => setTableModalOpen(false)} />
      <ActiveOrdersSidebar 
        isOpen={recentOrdersModalOpen} 
        onClose={() => setRecentOrdersModalOpen(false)} 
      />

      {/* Removal Reason Modal — shown when removing items in Edit Mode */}
      <AnimatePresence>
        {removingCartItemId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border overflow-hidden"
            >
              <div className="p-4 bg-secondary border-b border-border flex justify-between items-center">
                <h2 className="text-lg font-black text-foreground">Select Removal Reason</h2>
                <button onClick={() => { setRemovingCartItemId(null); setRemovalReason("") }} className="p-1.5 hover:bg-background rounded-lg transition-colors">
                  <XOctagon className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  {["Customer Cancelled", "Kitchen Error", "Manager Override", "Out of Stock", "Wrong Order"].map(reason => (
                    <button 
                      key={reason}
                      onClick={() => setRemovalReason(reason)}
                      className={`p-3 text-left border rounded-xl font-bold transition-all ${
                        removalReason === reason 
                          ? 'bg-orange-500/20 border-orange-500 text-orange-400' 
                          : 'bg-secondary border-border text-foreground hover:bg-background'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <input 
                  type="text"
                  placeholder="Or type custom reason..."
                  value={!["Customer Cancelled", "Kitchen Error", "Manager Override", "Out of Stock", "Wrong Order"].includes(removalReason) ? removalReason : ""}
                  onChange={(e) => setRemovalReason(e.target.value)}
                  className="w-full bg-secondary text-foreground p-3 rounded-xl border border-border focus:border-orange-500 outline-none transition-colors"
                />
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => { setRemovingCartItemId(null); setRemovalReason("") }}
                    className="flex-1 p-3 rounded-xl font-bold bg-secondary text-foreground hover:bg-background transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      if (removalReason && removingCartItemId) {
                        removeFromCart(removingCartItemId, removalReason)
                        setRemovingCartItemId(null)
                        setRemovalReason("")
                      }
                    }}
                    disabled={!removalReason}
                    className="flex-1 p-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Confirm Remove
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
