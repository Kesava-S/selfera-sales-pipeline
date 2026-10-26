import { Beer, Building2, Hotel, Utensils } from 'lucide-react'

// business_categories.icon_name -> icon; any other name shows a building
const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Hotel,
  Utensils,
  Beer,
  Building2,
}

export function CategoryIcon({ name, size, className }: { name: string | null; size?: number; className?: string }) {
  const Icon = ICONS[name ?? ''] ?? Building2
  return <Icon size={size} className={className} />
}
