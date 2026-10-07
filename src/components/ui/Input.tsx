'use client'

import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[rgb(var(--color-text))]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-xl border-2 bg-[rgb(var(--color-surface))]',
            'px-4 py-3 text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))]',
            'transition-colors duration-150',
            'focus:outline-none focus:border-[rgb(var(--color-forest))]',
            error
              ? 'border-red-500 focus:border-red-500'
              : 'border-[rgb(var(--color-border))]',
            className
          )}
          {...props}
        />
        {hint && !error && (
          <p className="text-xs text-[rgb(var(--color-text-muted))]">{hint}</p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

// Textarea variant
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-xl border-2 bg-[rgb(var(--color-surface))]',
            'px-4 py-3 text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))]',
            'resize-none transition-colors duration-150',
            'focus:outline-none focus:border-[rgb(var(--color-forest))]',
            error ? 'border-red-500' : 'border-[rgb(var(--color-border))]',
            className
          )}
          {...props}
        />
        {hint && !error && <p className="text-xs text-[rgb(var(--color-text-muted))]">{hint}</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export { Input, Textarea }
