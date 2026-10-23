'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { getPhoneType } from '@/lib/contact'

export interface CountryCodeItem {
  code: string
  name: string
  flag: string
  placeholder?: string
}

export const COUNTRY_CODES: CountryCodeItem[] = [
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧', placeholder: '7123 456789' },
  { code: '+1', name: 'United States / Canada', flag: '🇺🇸', placeholder: '202 555 0123' },
  { code: '+353', name: 'Ireland', flag: '🇮🇪', placeholder: '87 123 4567' },
  { code: '+61', name: 'Australia', flag: '🇦🇺', placeholder: '412 345 678' },
  { code: '+64', name: 'New Zealand', flag: '🇳🇿', placeholder: '21 123 4567' },
  { code: '+91', name: 'India', flag: '🇮🇳', placeholder: '98765 43210' },
  { code: '+971', name: 'United Arab Emirates', flag: '🇦🇪', placeholder: '50 123 4567' },
  { code: '+49', name: 'Germany', flag: '🇩🇪', placeholder: '151 12345678' },
  { code: '+33', name: 'France', flag: '🇫🇷', placeholder: '6 12 34 56 78' },
  { code: '+34', name: 'Spain', flag: '🇪🇸', placeholder: '612 34 56 78' },
  { code: '+39', name: 'Italy', flag: '🇮🇹', placeholder: '312 345 6789' },
  { code: '+31', name: 'Netherlands', flag: '🇳🇱', placeholder: '6 12345678' },
  { code: '+41', name: 'Switzerland', flag: '🇨🇭', placeholder: '78 123 45 67' },
  { code: '+32', name: 'Belgium', flag: '🇧🇪', placeholder: '470 12 34 56' },
  { code: '+46', name: 'Sweden', flag: '🇸🇪', placeholder: '70 123 45 67' },
  { code: '+47', name: 'Norway', flag: '🇳🇴', placeholder: '412 34 567' },
  { code: '+45', name: 'Denmark', flag: '🇩🇰', placeholder: '20 12 34 56' },
  { code: '+358', name: 'Finland', flag: '🇫🇮', placeholder: '40 1234567' },
  { code: '+48', name: 'Poland', flag: '🇵🇱', placeholder: '512 345 678' },
  { code: '+351', name: 'Portugal', flag: '🇵🇹', placeholder: '912 345 678' },
  { code: '+30', name: 'Greece', flag: '🇬🇷', placeholder: '691 234 5678' },
  { code: '+27', name: 'South Africa', flag: '🇿🇦', placeholder: '71 234 5678' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬', placeholder: '8123 4567' },
  { code: '+852', name: 'Hong Kong', flag: '🇭🇰', placeholder: '9123 4567' },
  { code: '+81', name: 'Japan', flag: '🇯🇵', placeholder: '90 1234 5678' },
  { code: '+86', name: 'China', flag: '🇨🇳', placeholder: '138 1234 5678' },
  { code: '+55', name: 'Brazil', flag: '🇧🇷', placeholder: '11 91234 5678' },
  { code: '+52', name: 'Mexico', flag: '🇲🇽', placeholder: '55 1234 5678' },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦', placeholder: '50 123 4567' },
]

export interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  disabled?: boolean
  id?: string
  name?: string
  autoFocus?: boolean
}

export function PhoneInput({
  value = '',
  onChange,
  error,
  placeholder,
  disabled = false,
  id,
  name,
  autoFocus,
}: PhoneInputProps) {
  // Sort country codes by length descending for greedy prefix matching
  const sortedCodes = useMemo(() => {
    return [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length)
  }, [])

  // Helper to extract country code from a raw string
  const extractCode = (raw: string): { code: string; local: string } | null => {
    const trimmed = (raw || '').trim()
    for (const item of sortedCodes) {
      if (trimmed.startsWith(item.code)) {
        return { code: item.code, local: trimmed.slice(item.code.length).trim() }
      }
    }
    return null
  }

  // Active country code in local state, preserving user selection even when input is empty
  const [selectedCountry, setSelectedCountry] = useState<string>(() => {
    const match = extractCode(value || '')
    return match ? match.code : '+44'
  })

  // Synchronize selectedCountry if an external value with another code is passed (e.g. editing existing lead)
  useEffect(() => {
    const match = extractCode(value || '')
    if (match && match.code !== selectedCountry) {
      setSelectedCountry(match.code)
    }
  }, [value, sortedCodes])

  // Extract the local portion of the number based on the selected country code
  const localNumber = useMemo(() => {
    const raw = (value || '').trim()
    if (!raw) return ''
    if (raw.startsWith(selectedCountry)) {
      return raw.slice(selectedCountry.length).trim()
    }
    const match = extractCode(raw)
    if (match) return match.local
    return raw.replace(/^\+/, '')
  }, [value, selectedCountry, sortedCodes])

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCode = e.target.value
    setSelectedCountry(newCode)
    if (localNumber.trim()) {
      onChange(`${newCode} ${localNumber.trim()}`)
    }
  }

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value

    // If user pasted a full number with a plus sign, detect and switch country code automatically
    if (inputVal.trim().startsWith('+')) {
      for (const item of sortedCodes) {
        if (inputVal.trim().startsWith(item.code)) {
          const rest = inputVal.trim().slice(item.code.length).trim()
          setSelectedCountry(item.code)
          onChange(`${item.code} ${rest}`)
          return
        }
      }
    }

    // Strip leading trunk 0 if UK domestic (+44 07... -> +44 7...)
    let cleaned = inputVal
    if (selectedCountry === '+44' && cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1)
    }

    if (!cleaned.trim()) {
      onChange('')
    } else {
      onChange(`${selectedCountry} ${cleaned.trim()}`)
    }
  }

  const phoneInfo = useMemo(() => {
    if (!localNumber.trim() || localNumber.replace(/\D/g, '').length < 6) return null
    return getPhoneType(`${selectedCountry} ${localNumber.trim()}`)
  }, [selectedCountry, localNumber])

  const activeCountry = useMemo(() => {
    return COUNTRY_CODES.find(c => c.code === selectedCountry)
  }, [selectedCountry])

  const activePlaceholder = placeholder || activeCountry?.placeholder || 'Local phone number'

  return (
    <div className="w-full">
      <div className="flex w-full rounded-lg shadow-xs">
        {/* Country Code Select */}
        <div className="relative">
          <select
            value={selectedCountry}
            onChange={handleCountryChange}
            disabled={disabled}
            className={`h-full cursor-pointer appearance-none rounded-l-lg border border-r-0 bg-slate-50 px-2.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:border-primary focus:bg-white focus:outline-none ${
              error ? '!border-red-400' : 'border-slate-300'
            }`}
            aria-label="Country Code"
          >
            {COUNTRY_CODES.map(c => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.code}
              </option>
            ))}
          </select>
        </div>

        {/* Local Number Input */}
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          value={localNumber}
          onChange={handleNumberChange}
          placeholder={activePlaceholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`input !rounded-l-none !py-2 text-sm ${
            error ? '!border-red-400' : ''
          }`}
        />
      </div>

      {!error && phoneInfo && (
        <div className="mt-1 flex items-center gap-1.5 text-xs">
          {phoneInfo.isWhatsApp ? (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              WhatsApp ready ({phoneInfo.label.replace(' (WhatsApp Ready)', '')})
            </span>
          ) : phoneInfo.type === 'landline' ? (
            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
              ⚠️ Landline format detected (landlines cannot receive standard WhatsApp messages)
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}
