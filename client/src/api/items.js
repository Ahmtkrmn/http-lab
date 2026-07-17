import { apiFetch } from './http'

// Backend { data, total } zarfı döndürüyor; component'ların zarfı bilmesine
// gerek yok — bu katman soyar, UI sadece diziyle çalışır.
export async function getItems() {
  const res = await apiFetch('/api/items')
  return res.data
}

export async function createItem({ name, price, categoryId, description }) {
  const res = await apiFetch('/api/items', {
    method: 'POST',
    body: { name, price, categoryId, description },
  })
  return res.data
}
