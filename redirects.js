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

  const redirects = [legacyProductRedirect, internetExplorerRedirect]

  return redirects
}

export default redirects
