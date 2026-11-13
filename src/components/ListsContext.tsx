'use client'

import { createContext, useContext } from 'react'
import { DEFAULT_LISTS, type SalesLists } from '@/lib/lists'
import { setPhoneDefaults } from '@/lib/contact'

// Services, platforms and categories from the database, loaded once in the
// dashboard layout and shared with every screen under it.
const ListsContext = createContext<SalesLists>(DEFAULT_LISTS)

export function ListsProvider({ lists, children }: { lists: SalesLists; children: React.ReactNode }) {
  // Numbers typed without a country code are read as the default country (Settings)
  setPhoneDefaults(lists.phone?.country)
  return <ListsContext.Provider value={lists}>{children}</ListsContext.Provider>
}

export const useLists = () => useContext(ListsContext)
