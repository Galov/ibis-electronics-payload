'use client'

import * as React from 'react'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/utilities/cn'

type SearchableSelectOption = {
  description?: string
  keywords?: string[]
  label: string
  value: string
}

type Props = {
  disabled?: boolean
  emptyText: string
  onValueChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder: string
  searchPlaceholder: string
  value?: string
}

export const SearchableSelect: React.FC<Props> = ({
  disabled = false,
  emptyText,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  value,
}) => {
  const [open, setOpen] = React.useState(false)

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  )

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className="mb-0 h-11 w-full justify-between rounded-md border-black/8 bg-white px-4 text-left text-sm font-normal text-primary/80 hover:bg-white"
          disabled={disabled}
          role="combobox"
          variant="outline"
        >
          <span className={cn('truncate', !selectedOption && 'text-primary/45')}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-55" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const filterValue = [option.label, option.description, ...(option.keywords || [])]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <CommandItem
                    key={option.value}
                    keywords={option.keywords}
                    onSelect={() => {
                      onValueChange(option.value)
                      setOpen(false)
                    }}
                    value={filterValue}
                  >
                    <CheckIcon
                      className={cn(
                        'size-4 text-[rgb(1,55,186)]',
                        value === option.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{option.label}</div>
                      {option.description ? (
                        <div className="mt-0.5 truncate text-xs text-primary/55">
                          {option.description}
                        </div>
                      ) : null}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
