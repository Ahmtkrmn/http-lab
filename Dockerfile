# ==========================================
# STAGE 1: BUILD (Derleme Aşaması)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Layer Cache Optimizasyonu: Önce package dosyalarını kopyala
COPY package*.json ./

# YENİ ÇÖZÜM ADIMI: npm ci çalışmadan önce Prisma şemasını kopyala ki postinstall patlamasın
COPY prisma ./prisma/

# 2. Bağımlılıkları kur (Bu adım artık içindeki postinstall'u sorunsuz çalıştıracak)
RUN npm ci

# 3. Kodun geri kalanını kopyala
COPY . .

# ==========================================
# STAGE 2: PRODUCTION (Çalışma Aşaması)
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Güvenlik: Production ortamını belirt
ENV NODE_ENV=production

# Build aşamasından sadece gerekli olanları al (Kaynak kod ve node_modules)
# Build aşamasından sadece gerekli olanları al (Kaynak kod ve node_modules)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma

# YENİ EKLENEN SATIR: Prisma 7 ayar dosyasını kopyalıyoruz
COPY --from=builder /app/prisma.config.ts ./

# Güvenlik: Non-root (Ayrıcalıksız) kullanıcıya geçiş yap
# Alpine imajlarında 'node' adında kısıtlı bir kullanıcı hazır gelir
USER node

EXPOSE 3000

# Container ayağa kalktığında çalışacak komut
# Not: Gerçek production ortamlarında veritabanı migration'ları ayrı bir CI/CD adımında yapılır,
# ancak bu laboratuvar için başlatmadan hemen önce migration'ı tetikleyip uygulamayı açıyoruz.
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]