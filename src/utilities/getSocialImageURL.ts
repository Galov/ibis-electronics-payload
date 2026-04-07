import { getBaseURL } from '@/utilities/getBaseURL'

export const getSocialImageURL = (path = '/logo.png') => {
  const baseURL = getBaseURL()
  return `${baseURL}${path.startsWith('/') ? path : `/${path}`}`
}
