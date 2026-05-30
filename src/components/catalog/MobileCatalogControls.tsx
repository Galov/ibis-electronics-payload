'use client'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { SlidersHorizontal } from 'lucide-react'
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

type Props = {
  children: React.ReactNode
}

type CategoryStep = {
  id: string
  title: string
}

type MobileCatalogControlsContextValue = {
  closeSheet: () => void
  closeCategoryStep: () => void
  focusSearchInput: () => void
  isCategoryListExpanded: boolean
  openCategoryStep: (category: CategoryStep) => void
  registerSearchFocusHandler: (handler: (() => void) | null) => void
  resetControls: () => void
  setCategoryListExpanded: (isExpanded: boolean) => void
}

const MobileCatalogControlsContext = createContext<MobileCatalogControlsContextValue | null>(null)

export function useMobileCatalogControls() {
  return useContext(MobileCatalogControlsContext)
}

export function MobileCatalogStickyFooter({ children }: Props) {
  const mobileCatalogControls = useMobileCatalogControls()
  const hasExpandedCategories = mobileCatalogControls?.isCategoryListExpanded

  return (
    <div
      className={[
        'sticky bottom-0 z-10 bg-white pt-2',
        hasExpandedCategories ? 'shadow-[0_-18px_36px_rgba(15,23,42,0.18)]' : '',
      ].join(' ')}
    >
      <div className="px-1.5">{children}</div>
    </div>
  )
}

export function MobileCatalogControls({ children }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [categoryStep, setCategoryStep] = useState<CategoryStep | null>(null)
  const [isCategoryStepOpen, setIsCategoryStepOpen] = useState(false)
  const [shouldRenderCategoryStep, setShouldRenderCategoryStep] = useState(false)
  const [isCategoryListExpanded, setCategoryListExpanded] = useState(false)
  const searchFocusHandlerRef = useRef<(() => void) | null>(null)

  const closeSheet = useCallback(() => {
    setIsOpen(false)
    setIsCategoryStepOpen(false)
  }, [])

  const closeCategoryStep = useCallback(() => {
    setIsCategoryStepOpen(false)
  }, [])

  const focusSearchInput = useCallback(() => {
    setIsCategoryStepOpen(false)

    window.setTimeout(() => {
      searchFocusHandlerRef.current?.()
    }, 80)
  }, [])

  const openCategoryStep = useCallback((category: CategoryStep) => {
    setCategoryStep(category)
    setIsCategoryStepOpen(true)
  }, [])

  const registerSearchFocusHandler = useCallback((handler: (() => void) | null) => {
    searchFocusHandlerRef.current = handler
  }, [])

  const resetControls = useCallback(() => {
    setIsCategoryStepOpen(false)
  }, [])

  const handleSheetOpenChange = useCallback((nextOpen: boolean) => {
    setIsOpen(nextOpen)

    if (!nextOpen) {
      setIsCategoryStepOpen(false)
    }
  }, [])

  React.useEffect(() => {
    if (isCategoryStepOpen && categoryStep) {
      setShouldRenderCategoryStep(true)
      return
    }

    const timeout = window.setTimeout(() => {
      setShouldRenderCategoryStep(false)
      setCategoryStep(null)
    }, 460)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [categoryStep, isCategoryStepOpen])

  const contextValue = useMemo<MobileCatalogControlsContextValue>(
    () => ({
      closeCategoryStep,
      closeSheet,
      focusSearchInput,
      isCategoryListExpanded,
      openCategoryStep,
      registerSearchFocusHandler,
      resetControls,
      setCategoryListExpanded,
    }),
    [
      closeCategoryStep,
      closeSheet,
      focusSearchInput,
      isCategoryListExpanded,
      openCategoryStep,
      registerSearchFocusHandler,
      resetControls,
      setCategoryListExpanded,
    ],
  )

  return (
    <div className="md:hidden">
      <MobileCatalogControlsContext.Provider value={contextValue}>
        <Sheet onOpenChange={handleSheetOpenChange} open={isOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="fixed right-4 bottom-5 z-40 inline-flex items-center gap-2 rounded-full bg-[rgb(1,55,186)] px-5 py-3 text-sm font-medium text-white shadow-[0_14px_38px_rgba(1,55,186,0.28)] transition hover:bg-[rgb(0,46,158)]"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Намери продукти
            </button>
          </SheetTrigger>

          <SheetContent
            side="bottom"
            className="max-h-[86vh] gap-0 overflow-y-auto rounded-t-3xl border-t border-[rgb(1,55,186)]/12 bg-white px-4 pb-6 pt-2"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <SheetHeader className="px-0 pb-4 pt-3 text-left">
              <SheetTitle className="text-xl font-normal text-primary/85">
                Филтриране и сортиране
              </SheetTitle>
              <SheetDescription className="text-sm text-primary/55">
                Търси, избери категория и подреди каталога.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-2">{children}</div>

            {shouldRenderCategoryStep && categoryStep ? (
              <div
                className={[
                  'absolute inset-0 z-20 flex items-end transition-opacity ease-out',
                  isCategoryStepOpen ? 'opacity-100' : 'opacity-0',
                ].join(' ')}
                style={{ transitionDuration: '420ms' }}
              >
                <div
                  className={[
                    'relative z-10 w-full rounded-t-3xl border-t border-[rgb(1,55,186)]/12 bg-white px-4 pb-6 pt-4 shadow-[0_-18px_40px_rgba(15,23,42,0.12)] transition-transform ease-[cubic-bezier(0.16,1,0.3,1)]',
                    isCategoryStepOpen ? 'translate-y-0' : 'translate-y-8',
                  ].join(' ')}
                  style={{ transitionDuration: '520ms' }}
                >
                  <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[rgb(1,55,186)]/14" />
                  <div className="space-y-3">
                    <Button
                      className="h-12 w-full rounded-md bg-[rgb(1,55,186)] px-4 text-sm font-normal text-white hover:bg-[rgb(1,55,186)]"
                      onClick={closeSheet}
                      type="button"
                    >
                      Разгледай всички {categoryStep.title.toLocaleLowerCase('bg-BG')}
                    </Button>

                    <p className="text-center text-xs font-medium tracking-[0.22em] text-primary/45">
                      ИЛИ
                    </p>

                    <Button
                      className="h-12 w-full rounded-md bg-[rgb(1,55,186)] px-4 text-sm font-normal text-white hover:bg-[rgb(1,55,186)]"
                      onClick={focusSearchInput}
                      type="button"
                    >
                      Търси в {categoryStep.title}
                    </Button>
                  </div>

                  <div className="mt-5 border-t border-[rgb(1,55,186)]/10 pt-4">
                    <Button
                      className="h-11 w-full rounded-md px-4 text-sm font-normal"
                      onClick={closeCategoryStep}
                      type="button"
                      variant="outline"
                    >
                      Назад към категориите
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </SheetContent>
        </Sheet>
      </MobileCatalogControlsContext.Provider>
    </div>
  )
}
