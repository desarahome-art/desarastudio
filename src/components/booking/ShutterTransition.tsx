'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ShutterProps {
  isOpen: boolean
}

export function ShutterTransition({ isOpen }: ShutterProps) {
  return (
    <AnimatePresence>
      {!isOpen && (
        <>
          {/* Top blade */}
          <motion.div
            key="top"
            className={cn(
              'fixed inset-x-0 top-0 z-50 h-1/2',
              'bg-[rgb(var(--color-forest))]'
            )}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            exit={{ scaleY: 0 }}
            style={{ originY: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          />
          {/* Bottom blade */}
          <motion.div
            key="bottom"
            className={cn(
              'fixed inset-x-0 bottom-0 z-50 h-1/2',
              'bg-[rgb(var(--color-forest))]'
            )}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            exit={{ scaleY: 0 }}
            style={{ originY: 1 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          />
        </>
      )}
    </AnimatePresence>
  )
}

export const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -16 },
}

export const pageTransition = {
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1] as const,
}
