# ==========================================
# STAGE 1: BUILD — React uygulamasını statik dosyalara derle
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Layer cache: önce package dosyaları (backend Dockerfile'ındaki desenle aynı)
COPY package*.json ./
RUN npm ci

COPY . .

# KRİTİK FARK (backend'den): Vite env değişkenleri RUNTIME'da değil, BUILD
# anında string olarak bundle'a gömülür. Statik dosyalarda "process yok" —
# container'a sonradan env vermek işe yaramaz. Bu yüzden değer build ARG'ı
# olarak gelir (docker-compose.yml -> build.args). Farklı bir API adresi
# isteniyorsa imajı yeniden build etmek gerekir.
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ==========================================
# STAGE 2: SERVE — Nginx ile statik dosya sunumu
# ==========================================
# Node imajı (~200MB) yerine nginx:alpine (~50MB): statik dosya sunmak için
# Node runtime'ına gerek yok; Nginx bu iş için hem küçük hem hızlıdır.
FROM nginx:alpine AS runner

# SPA fallback kuralı içeren özel config (bkz. nginx.conf açıklamaları)
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
