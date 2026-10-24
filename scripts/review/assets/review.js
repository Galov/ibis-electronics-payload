/* Static files only. No database, commerce API, analytics or third-party scripts. */
;(() => {
  const fallback = '/assets/no-image.svg'
  const imageFallback = (image) => {
    if (!image.src.endsWith(fallback)) image.src = fallback
  }
  document.addEventListener(
    'error',
    (event) => {
      if (event.target instanceof HTMLImageElement) imageFallback(event.target)
    },
    true,
  )
  for (const image of document.images)
    if (image.complete && !image.naturalWidth) imageFallback(image)
  const main = document.querySelector('#main-image')
  for (const button of document.querySelectorAll('[data-photo]'))
    button.addEventListener('click', () => {
      if (!main) return
      main.src = button.dataset.photo
      for (const b of document.querySelectorAll('[data-photo]'))
        b.setAttribute('aria-pressed', String(b === button))
    })
  const search = document.querySelector('#search'),
    category = document.querySelector('#category')
  if (!search || !category) return
  const grid = document.querySelector('#products'),
    count = document.querySelector('#result-count'),
    pagination = document.querySelector('#pagination')
  let catalogue,
    ticket = 0,
    timer
  const normalized = (s) =>
    s
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '')
  const element = (tag, className, text) => {
    const e = document.createElement(tag)
    if (className) e.className = className
    if (text) e.textContent = text
    return e
  }
  function card(p) {
    const article = element('article', 'product-card'),
      a = element('a'),
      frame = element('div', 'card-image'),
      img = element('img')
    a.href = p.path
    img.src = p.image || fallback
    img.alt = p.title
    img.loading = 'lazy'
    img.width = 260
    img.height = 215
    frame.append(img)
    const view = element('span', 'view-product', 'View product ')
    view.append(element('span', '', '→'))
    a.append(
      frame,
      element('p', 'sku', p.sku || 'Part reference unavailable'),
      element('h2', '', p.title),
      view,
    )
    article.append(a)
    return article
  }
  async function render(page = 1) {
    const current = ++ticket
    count.textContent = 'Loading products…'
    try {
      catalogue ||= fetch('/assets/catalogue.json', { credentials: 'same-origin' })
        .then((r) => {
          if (!r.ok) throw Error('Catalogue unavailable')
          return r.json()
        })
        .then((rows) =>
          rows.map((p) => ({
            ...p,
            search: normalized(
              [p.title, p.sku, p.originalSku, p.manufacturerCode, p.brand].join(' '),
            ),
          })),
        )
        .catch((e) => {
          catalogue = null
          throw e
        })
      const rows = await catalogue
      if (current !== ticket) return
      const q = search.value.trim().slice(0, 256),
        terms = q.split(/\s+/).map(normalized).filter(Boolean),
        cat = category.value
      const results = rows.filter(
        (p) => (!cat || p.categories.includes(cat)) && terms.every((t) => p.search.includes(t)),
      )
      const pages = Math.max(1, Math.ceil(results.length / 60))
      page = Math.min(Math.max(1, page), pages)
      const start = (page - 1) * 60
      const fragment = document.createDocumentFragment()
      for (const p of results.slice(start, start + 60)) fragment.append(card(p))
      grid.replaceChildren(fragment)
      count.textContent = results.length
        ? `${start + 1}–${Math.min(start + 60, results.length)} of ${results.length.toLocaleString('en')} products`
        : '0 products'
      if (!results.length) {
        const empty = element('div', 'empty')
        empty.append(
          element('h2', '', 'No matching products'),
          element('p', '', 'Try a different name or part number, or clear the category filter.'),
        )
        grid.append(empty)
      }
      const nav = element('nav', 'pagination')
      nav.setAttribute('aria-label', 'Search results pages')
      const move = (label, to) => {
        const b = element('button', '', label)
        b.type = 'button'
        b.addEventListener('click', () => {
          render(to)
          document.querySelector('#catalogue-tools').scrollIntoView({ block: 'start' })
        })
        return b
      }
      nav.append(
        page > 1 ? move('← Previous', page - 1) : element('span'),
        element('span', '', `Page ${page} of ${pages}`),
        page < pages ? move('Next →', page + 1) : element('span'),
      )
      pagination.replaceChildren(nav)
      const url = new URL('/en/', location.origin)
      if (q) url.searchParams.set('q', q)
      if (cat) url.searchParams.set('category', cat)
      if (page > 1) url.searchParams.set('page', String(page))
      history.replaceState(null, '', url.pathname + url.search)
      document.querySelector('#search-error').hidden = true
    } catch {
      if (current === ticket) {
        count.textContent = 'Search is temporarily unavailable'
        document.querySelector('#search-error').hidden = false
      }
    }
  }
  search.addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(() => render(), 150)
  })
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      clearTimeout(timer)
      render()
    }
  })
  category.addEventListener('change', () => render())
  document.querySelector('#reset').addEventListener('click', () => {
    search.value = ''
    category.value = ''
    render()
    search.focus()
  })
  const params = new URLSearchParams(location.search)
  search.value = (params.get('q') || '').slice(0, 256)
  category.value = params.get('category') || ''
  if (search.value || category.value || params.has('page')) render(Number(params.get('page')) || 1)
})()
