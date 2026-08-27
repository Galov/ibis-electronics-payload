'use client'

import type { CSSProperties } from 'react'

const wrapperStyle: CSSProperties = {
  alignItems: 'flex-start',
  background: 'linear-gradient(135deg, rgba(0, 43, 127, 0.08), rgba(252, 209, 22, 0.12), rgba(206, 17, 38, 0.08))',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: '10px',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.65rem',
  marginBottom: '1rem',
  padding: '1rem',
}

const buttonStyle: CSSProperties = {
  alignItems: 'center',
  background: '#002b7f',
  border: 'none',
  borderRadius: '8px',
  color: '#fff',
  cursor: 'pointer',
  display: 'inline-flex',
  fontWeight: 700,
  gap: '0.5rem',
  padding: '0.75rem 1rem',
}

export function UploadToRomaniaButton() {
  const handleClick = () => {
    window.alert(
      'Боби, малко бързаш! Научи ли румънски, че пращаш продукта към румънския сайт?',
    )
  }

  return (
    <div style={wrapperStyle}>
      <button onClick={handleClick} style={buttonStyle} type="button">
        <span aria-hidden="true">🇷🇴</span>
        <span>Качи в ibis-electronics.ro</span>
      </button>
    </div>
  )
}
