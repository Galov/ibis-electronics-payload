const redirects = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header',
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  const legacyProductRedirect = {
    destination: '/products/:slug',
    permanent: true,
    source: '/produkt/:slug',
  }

  const homeRedirect = {
    destination: '/magazin',
    permanent: true,
    source: '/',
  }

  const shopRedirect = {
    destination: '/magazin',
    permanent: true,
    source: '/shop',
  }

  const contactRedirect = {
    destination: '/kontakti',
    permanent: true,
    source: '/contact',
  }

  const redirects = [
    legacyProductRedirect,
    homeRedirect,
    shopRedirect,
    contactRedirect,
    internetExplorerRedirect,
  ]

  return redirects
}

export default redirects
