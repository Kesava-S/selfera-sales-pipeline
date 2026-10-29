'use client'

import { DotLottieReact } from '@lottiefiles/dotlottie-react'

export function ServerErrorView({
  animationSrc = '/animations/500.lottie',
}: {
  animationSrc?: string
} = {}) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-white text-slate-900 overflow-x-hidden">
      <div className="flex flex-col items-center justify-center text-center max-w-lg w-full mx-auto animate-fadeIn">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3 mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Selfera Logo"
            className="h-9 w-9 object-contain"
          />
          <div className="flex flex-col text-left">
            <span className="text-xl font-extrabold leading-tight tracking-tight text-slate-900">
              Selfera<span className="text-primary">.</span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Sales Pipeline
            </span>
          </div>
        </div>

        {/* Animated Lottie from LottieFiles */}
        <div className="w-full max-w-[280px] sm:max-w-xs md:max-w-sm aspect-square flex items-center justify-center overflow-hidden [&_canvas]:!max-w-full [&_canvas]:!max-h-full [&_canvas]:!object-contain">
          <DotLottieReact
            src={animationSrc}
            loop
            autoplay
            className="w-full h-full object-contain"
          />
        </div>

        {/* Error Identifier (Plain text, no badge pill) */}
        <span className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">
          500 · Server Error
        </span>

        {/* Error Explanation */}
        <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 px-4 text-balance">
          Something went wrong on our end
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-500 max-w-sm px-4 leading-relaxed text-balance">
          An unexpected server issue occurred. Please try again.
        </p>
      </div>
    </div>
  )
}
