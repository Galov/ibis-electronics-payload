import { getBaseURL } from '@/utilities/getBaseURL'

export const getSocialImageURL = (path = '/ibis_blue_logo.png') => {
  const baseURL = getBaseURL()
  return `${baseURL}${path.startsWith('/') ? path : `/${path}`}`
}
