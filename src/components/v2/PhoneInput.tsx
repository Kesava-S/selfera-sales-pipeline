'use client'

// Phone number with a country picker. Every country is offered; the ones in
// Settings ('phone_defaults'.first) are listed first. The number is checked with
// the same phone rules as the rest of the app (lib/contact).

import React, { useMemo, useState } from 'react'
import { getCountries, getCountryCallingCode, getExampleNumber, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max'
import examples from 'libphonenumber-js/examples.mobile.json'
import { ChevronDown, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { getPhoneType } from '@/lib/contact'
import { useLists } from '@/components/ListsContext'

export interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  disabled?: boolean
  id?: string
  name?: string
  autoFocus?: boolean
  showStatus?: boolean // the "WhatsApp ready / Landline" line under the box (off when the form shows its own)
}

type CountryOption = { iso: CountryCode; code: string; name: string; flag: string }

const flagOf = (iso: string) => String.fromCodePoint(...[...iso.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))

function countryOptions(first: string[]): CountryOption[] {
  let names: Intl.DisplayNames | null = null
  try { names = new Intl.DisplayNames(['en'], { type: 'region' }) } catch { names = null }
  const all = getCountries().map(iso => ({
    iso, code: `+${getCountryCallingCode(iso)}`, name: names?.of(iso) || iso, flag: flagOf(iso),
  }))
  const firstSet = first.filter(c => all.some(o => o.iso === c))
  const top = firstSet.map(c => all.find(o => o.iso === c)!)
  const rest = all.filter(o => !firstSet.includes(o.iso)).sort((a, b) => a.name.localeCompare(b.name))
  return [...top, ...rest]
}

export function PhoneInput({ value = '', onChange, error, placeholder, disabled = false, id, name, autoFocus, showStatus = true }: PhoneInputProps) {
  const { phone } = useLists()
  const options = useMemo(() => countryOptions(phone?.first ?? []), [phone?.first])
  // Default country (Settings), else the first listed country, else the browser's region
  const fallback = useMemo<CountryCode>(() => {
    const browser = typeof navigator !== 'undefined' ? navigator.language?.split('-')[1]?.toUpperCase() : undefined
    for (const c of [phone?.country, phone?.first?.[0], browser]) {
      const hit = options.find(o => o.iso === c)
      if (hit) return hit.iso
    }
    return options[0].iso
  }, [options, phone?.country, phone?.first])

  // The country of a number that has a code; otherwise the one picked (or the default)
  const fromValue = (raw: string): CountryCode | null => {
    const v = raw.trim()
    if (!v.startsWith('+')) return null
    const p = parsePhoneNumberFromString(v)
    if (p?.country) return p.country
    // Not complete yet: the longest calling code that matches
    const hit = [...options].sort((a, b) => b.code.length - a.code.length).find(o => v.startsWith(o.code))
    return hit?.iso ?? null
  }

  const [picked, setPicked] = useState<CountryCode>(() => fromValue(value) ?? fallback)
  // A number with a different code (editing an existing lead) moves the picker with it
  const fromVal = fromValue(value)
  const [lastVal, setLastVal] = useState(value)
  if (value !== lastVal) {
    setLastVal(value)
    if (fromVal && getCountryCallingCode(fromVal) !== getCountryCallingCode(picked)) setPicked(fromVal)
  }

  const active = options.find(o => o.iso === picked) ?? options[0]
  const localNumber = useMemo(() => {
    const raw = (value || '').trim()
    if (!raw) return ''
    if (raw.startsWith(active.code)) return raw.slice(active.code.length).trim()
    return raw.replace(/^\+/, '')
  }, [value, active.code])

  const emit = (iso: CountryCode, local: string) => {
    const text = local.trim()
    if (!text) { onChange(''); return }
    const code = `+${getCountryCallingCode(iso)}`
    // Numbers typed the national way (e.g. with a leading 0) lose that prefix
    const national = /^0/.test(text) ? parsePhoneNumberFromString(text, iso) : undefined
    onChange(`${code} ${national?.isValid() ? national.nationalNumber : text}`)
  }

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const iso = e.target.value as CountryCode
    setPicked(iso)
    if (localNumber.trim()) emit(iso, localNumber)
  }

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value
    // A pasted full number (+…) picks its own country
    if (inputVal.trim().startsWith('+')) {
      const iso = fromValue(inputVal)
      if (iso) {
        setPicked(iso)
        const code = `+${getCountryCallingCode(iso)}`
        onChange(`${code} ${inputVal.trim().slice(code.length).trim()}`)
        return
      }
    }
    emit(picked, inputVal)
  }

  const phoneInfo = useMemo(() => {
    if (!localNumber.trim() || localNumber.replace(/\D/g, '').length < 6) return null
    return getPhoneType(`${active.code} ${localNumber.trim()}`)
  }, [active.code, localNumber])

  const example = useMemo(() => {
    try { return getExampleNumber(picked, examples)?.formatNational().replace(/^0\s?/, '') } catch { return undefined }
  }, [picked])

  return (
    <div className="w-full">
      <div className="flex w-full rounded-lg shadow-xs">
        {/* Closed: just the flag and code. Open: the full list with country names */}
        <div
          className={`relative flex shrink-0 items-center gap-1 rounded-l-lg border border-r-0 bg-slate-50 px-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-within:border-primary focus-within:bg-white ${
            error ? '!border-red-400' : 'border-slate-300'
          } ${disabled ? 'opacity-60' : ''}`}
          title={active.name}
        >
          <span aria-hidden="true">{active.flag}</span>
          <span>{active.code}</span>
          <ChevronDown size={14} className="text-slate-400" aria-hidden="true" />
          <select
            value={picked}
            onChange={handleCountryChange}
            disabled={disabled}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            aria-label={`Country code: ${active.name} ${active.code}`}
          >
            {options.map(c => (
              <option key={c.iso} value={c.iso}>
                {c.flag} {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          value={localNumber}
          onChange={handleNumberChange}
          placeholder={placeholder || example || 'Phone number'}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`input !rounded-l-none !py-2 text-sm ${error ? '!border-red-400' : ''}`}
        />
      </div>

      {showStatus && !error && phoneInfo && (
        <div className="mt-1 flex items-center gap-1.5 text-xs">
          {phoneInfo.isWhatsApp ? (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              WhatsApp ready ({phoneInfo.label})
            </span>
          ) : phoneInfo.type === 'landline' ? (
            <span className="inline-flex items-center gap-1 font-medium text-amber-700">
              <AlertTriangle size={13} className="text-amber-500 shrink-0" />
              Landline: can&apos;t receive WhatsApp messages
            </span>
          ) : phoneInfo.type === 'invalid' ? (
            <span className="inline-flex items-center gap-1 font-medium text-rose-600">
              <XCircle size={13} className="text-rose-500 shrink-0" />
              {phoneInfo.label}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}
