'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Building2, Search, Plus, Check } from 'lucide-react'

export interface CompanySummary {
  name: string
  leadCount: number
}

interface CompanyAutocompleteInputProps {
  id?: string
  value: string
  onChange: (val: string) => void
  placeholder?: string
  hasError?: boolean
  autoFocus?: boolean
  onBlur?: () => void
}

export function CompanyAutocompleteInput({
  id = 'business_name',
  value,
  onChange,
  placeholder = 'e.g. Apex Logistics Ltd or The Artisan Bakery',
  hasError = false,
  autoFocus = false,
  onBlur,
}: CompanyAutocompleteInputProps) {
  const [companies, setCompanies] = useState<CompanySummary[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch unique existing companies with lead counts from Supabase
  useEffect(() => {
    let isMounted = true
    const fetchCompanies = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data, error } = await supabase
          .from('leads')
          .select('business_name')

        if (!error && data && isMounted) {
          const countMap = new Map<string, number>()
          data.forEach((row) => {
            const raw = (row.business_name || '').trim()
            if (raw) {
              countMap.set(raw, (countMap.get(raw) || 0) + 1)
            }
          })

          const list: CompanySummary[] = Array.from(countMap.entries())
            .map(([name, leadCount]) => ({ name, leadCount }))
            .sort((a, b) => a.name.localeCompare(b.name))

          setCompanies(list)
        }
      } catch {
        // Ignore fetch errors
      }
    }

    fetchCompanies()
    return () => {
      isMounted = false
    }
  }, [])

  // Filter companies matching current query
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return companies
    return companies.filter((c) => c.name.toLowerCase().includes(q))
  }, [companies, value])

  // Is the current input value an exact match for an existing company?
  const matchedCompany = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return null
    return companies.find((c) => c.name.toLowerCase() === q) || null
  }, [companies, value])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (companyName: string) => {
    onChange(companyName)
    setIsOpen(false)
    setHighlightedIndex(-1)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1))
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
        e.preventDefault()
        handleSelect(filtered[highlightedIndex].name)
      } else if (value.trim()) {
        // Close on enter if typing new
        setIsOpen(false)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setHighlightedIndex(-1)
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setIsOpen(true)
            setHighlightedIndex(-1)
          }}
          onFocus={() => {
            setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          className="input-field"
          style={{
            width: '100%',
            paddingRight: '2rem',
            ...(hasError ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}),
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
        />

        <div
          style={{
            position: 'absolute',
            right: '0.65rem',
            color: matchedCompany ? '#10b981' : '#94a3b8',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {matchedCompany ? <Building2 size={16} /> : <Search size={15} />}
        </div>
      </div>

      {/* Autocomplete Dropdown List */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.06)',
            zIndex: 150,
            maxHeight: '230px',
            overflowY: 'auto',
            animation: 'fadeIn 0.1s ease-out',
          }}
        >
          {filtered.length > 0 && (
            <div
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Existing Companies in Database</span>
              <span>{filtered.length} found</span>
            </div>
          )}

          {filtered.map((company, idx) => {
            const isHighlighted = idx === highlightedIndex
            const isSelected = matchedCompany?.name === company.name

            return (
              <div
                key={company.name}
                onClick={() => handleSelect(company.name)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                style={{
                  padding: '0.65rem 0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  backgroundColor: isHighlighted ? '#f1f5f9' : isSelected ? '#eff6ff' : '#ffffff',
                  borderBottom: '1px solid #f8fafc',
                  transition: 'background-color 0.1s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      backgroundColor: isSelected ? '#dbeafe' : '#f1f5f9',
                      color: isSelected ? 'var(--primary)' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Building2 size={14} />
                  </div>
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? 'var(--primary)' : '#0f172a',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {company.name}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      backgroundColor: isSelected ? '#dbeafe' : '#f1f5f9',
                      color: isSelected ? '#1e40af' : '#64748b',
                      fontWeight: 600,
                    }}
                  >
                    {company.leadCount} existing {company.leadCount === 1 ? 'contact' : 'contacts'}
                  </span>
                  {isSelected && <Check size={14} style={{ color: 'var(--primary)' }} />}
                </div>
              </div>
            )
          })}

          {/* Option to create brand new company if typing something not yet present */}
          {value.trim() && !matchedCompany && (
            <div
              onClick={() => {
                setIsOpen(false)
              }}
              style={{
                padding: '0.65rem 0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                backgroundColor: '#ffffff',
                borderTop: filtered.length > 0 ? '1px solid #e2e8f0' : 'none',
                color: 'var(--primary)',
                fontSize: '0.825rem',
                fontWeight: 600,
              }}
              className="hover:bg-slate-50"
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  backgroundColor: '#eff6ff',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Plus size={14} />
              </div>
              <span>
                Register as new company: <strong>&ldquo;{value.trim()}&rdquo;</strong>
              </span>
            </div>
          )}

          {filtered.length === 0 && !value.trim() && (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
              No existing companies yet. Type a company name to create one.
            </div>
          )}
        </div>
      )}

      {/* Helpful Context Tag below Input */}
      {matchedCompany ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.75rem',
            color: '#059669',
            marginTop: '0.35rem',
            fontWeight: 600,
          }}
        >
          <Building2 size={13} />
          <span>
            Existing account detected: Adding a new contact lead to <strong>{matchedCompany.name}</strong> ({matchedCompany.leadCount} current {matchedCompany.leadCount === 1 ? 'lead' : 'leads'}).
          </span>
        </div>
      ) : value.trim() ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.73rem',
            color: '#64748b',
            marginTop: '0.35rem',
          }}
        >
          <Plus size={12} />
          <span>New company account will be created.</span>
        </div>
      ) : null}
    </div>
  )
}
