'use client'

import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl font-heading font-semibold',
          'transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // sizes
          size === 'sm' && 'px-4 py-2 text-sm',
          size === 'md' && 'px-6 py-3 text-base',
          size === 'lg' && 'px-8 py-4 text-lg',
          // variants
          variant === 'primary' && [
            'bg-[rgb(var(--color-forest))] text-[rgb(var(--color-cream))]',
            'hover:bg-[rgb(var(--color-forest-light))] active:scale-[0.98]',
            'focus-visible:outline-[rgb(var(--color-blitz))]',
          ],
          variant === 'secondary' && [
            'bg-[rgb(var(--color-blitz))] text-[rgb(var(--color-text))]',
            'hover:brightness-105 active:scale-[0.98]',
          ],
          variant === 'ghost' && [
            'bg-transparent border-2 border-[rgb(var(--color-border))]',
            'hover:border-[rgb(var(--color-forest))] hover:text-[rgb(var(--color-forest))]',
          ],
          variant === 'danger' && [
            'bg-red-600 text-white hover:bg-red-700',
          ],
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
        ) : children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export { Button }
