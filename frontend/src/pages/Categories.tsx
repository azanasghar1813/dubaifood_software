import { useState, useEffect } from "react"
import { Search, Plus, MoreVertical, Edit2, Trash2, Loader2 } from "lucide-react"
import { api } from "../services/api"

export default function Categories() {
  const [categories, setCategories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await api.getCategories()
        setCategories(result)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center min-h-[calc(100vh-100px)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground text-sm">Organize your menu into categories.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search categories..."
              className="w-full h-10 pl-9 pr-4 rounded-lg bg-card/60 backdrop-blur-md border border-border/50 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 whitespace-nowrap shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-5 hover:border-primary/50 transition-colors group shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold">{cat.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{cat.itemsCount} items attached</p>
              </div>
              <button className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-1">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
            <div className="flex justify-between items-center mt-6">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                cat.status === "Active" ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
              }`}>
                {cat.status}
              </span>
              <div className="flex gap-2">
                <button className="p-2 bg-secondary text-muted-foreground hover:text-foreground rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button className="p-2 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
