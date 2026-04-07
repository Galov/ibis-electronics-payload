'use client'

import clsx from 'clsx'
import { Clock3, MapPin, Phone } from 'lucide-react'
import React, { useMemo, useState } from 'react'

type Location = {
  address: string
  label: string
  phone: string
  workingHours: string
}

type ContactLocationsProps = {
  locations: [Location, Location]
}

const mapUrlForLocation = (location?: Location) => {
  if (!location) return 'https://www.google.com/maps?output=embed&q=Bulgaria'

  const query = [location.label, location.address, 'България'].filter(Boolean).join(', ')
  return `https://www.google.com/maps?output=embed&q=${encodeURIComponent(query)}`
}

export const ContactLocations: React.FC<ContactLocationsProps> = ({ locations }) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedLocation = useMemo(() => locations[selectedIndex] ?? locations[0], [locations, selectedIndex])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {locations.map((location, index) => {
          const isActive = index === selectedIndex

          return (
            <button
              key={location.label}
              className={clsx(
                'w-full cursor-pointer rounded-xl bg-white p-3.5 text-left transition duration-200 ease-in-out',
                'hover:border-black/10 hover:shadow-[0_14px_34px_rgba(17,24,39,0.06)]',
                isActive && 'border border-[rgb(1,55,186)]/15 shadow-[0_14px_34px_rgba(17,24,39,0.06)]',
              )}
              onClick={() => setSelectedIndex(index)}
              type="button"
            >
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <p className="text-xl font-normal tracking-[-0.02em] text-primary">{location.label}</p>
                </div>

                <div className="space-y-1 text-sm leading-5 text-primary/66">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-1 h-4 w-4 shrink-0 text-[rgb(1,55,186)]/75" />
                    <span>{location.address}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="mt-1 h-4 w-4 shrink-0 text-[rgb(1,55,186)]/75" />
                    <a className="hover:text-primary" href={`tel:${location.phone.replace(/\s+/g, '')}`}>
                      {location.phone}
                    </a>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-1 h-4 w-4 shrink-0 text-[rgb(1,55,186)]/75" />
                    <span>{location.workingHours}</span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-black/8 bg-white">
        <iframe
          className="h-[28rem] w-full md:h-[36rem]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={mapUrlForLocation(selectedLocation)}
          title={selectedLocation ? `Карта за ${selectedLocation.label}` : 'Карта'}
        />
      </div>
    </div>
  )
}
