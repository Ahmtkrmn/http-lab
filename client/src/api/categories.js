import { apiFetch } from './http'

export async function getCategories() {
  const res = await apiFetch('/api/categories')
  return res.data
}
