'use client'

import { Clock3, MapPin, Phone } from 'lucide-react'
import React from 'react'

type Location = {
  address: string
  label: string
  phone?: string
  workingHours?: string
}

type ContactLocationsProps = {
  location: Location
}

const mapUrlForLocation = (location: Location) => {
  const query = [location.label, location.address].filter(Boolean).join(', ')
  return `https://www.google.com/maps?output=embed&q=${encodeURIComponent(query)}`
}

export const ContactLocations: React.FC<ContactLocationsProps> = ({ location }) => {
  const mapUrl = mapUrlForLocation(location)

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-5 shadow-[0_14px_34px_rgba(17,24,39,0.06)]">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="type-card-title text-primary">{location.label}</p>
          </div>

          <div className="type-body-small space-y-2 text-primary/66">
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 h-4 w-4 shrink-0 text-[rgb(1,55,186)]/75" />
              <span>{location.address}</span>
            </div>
            {location.phone ? (
              <div className="flex items-start gap-3">
                <Phone className="mt-1 h-4 w-4 shrink-0 text-[rgb(1,55,186)]/75" />
                <a className="hover:text-primary" href={`tel:${location.phone.replace(/\s+/g, '')}`}>
                  {location.phone}
                </a>
              </div>
            ) : null}
            {location.workingHours ? (
              <div className="flex items-start gap-3">
                <Clock3 className="mt-1 h-4 w-4 shrink-0 text-[rgb(1,55,186)]/75" />
                <span>{location.workingHours}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/8 bg-white">
        <iframe
          className="h-[28rem] w-full md:h-[36rem]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={mapUrl}
          title={`Карта за ${location.label}`}
        />
      </div>
    </div>
  )
}
