import React from 'react'

export function AccountNotSetup() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Account Not Set Up</h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          Your account isn't set up yet. You have logged in successfully, but you need a profile in the system to access the dashboard.
        </p>
        <p className="text-sm font-semibold text-slate-700">
          Ask an admin to add you.
        </p>
      </div>
    </div>
  )
}
