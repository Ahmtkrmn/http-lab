#!/usr/bin/env bash
# Canlı http-lab'e karışık trafik üretir — Grafana dashboard'ında RPS, status
# kodu dağılımı ve latency panellerinin dolması için. 5xx üretmeyiz (gerçekçi):
# error-rate paneli normalde ~0 kalmalı, bu sağlıklı bir sistemin işaretidir.
#
# Kullanım:
#   bash monitoring/generate-traffic.sh              # varsayılan: canlı, 60 tur
#   BASE_URL=http://localhost:3000 ROUNDS=100 bash monitoring/generate-traffic.sh

set -u

BASE_URL="${BASE_URL:-https://http-lab.onrender.com}"
ROUNDS="${ROUNDS:-60}"

echo "Hedef: $BASE_URL  |  Tur: $ROUNDS"
echo "Ctrl+C ile durdurabilirsin."

for i in $(seq 1 "$ROUNDS"); do
  # 200: health check
  curl -s -o /dev/null "$BASE_URL/health"

  # 401: token'sız korumalı endpoint
  curl -s -o /dev/null "$BASE_URL/api/items"

  # 404: eşleşmeyen path (route="unmatched" serisine düşer)
  curl -s -o /dev/null "$BASE_URL/rastgele-$RANDOM"

  # Ara sıra bir kayıt + login denemesi (201 / 200 veya 409/401 üretir)
  if (( i % 5 == 0 )); then
    EMAIL="loadtest_$RANDOM@example.com"
    curl -s -o /dev/null -X POST "$BASE_URL/api/auth/register" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"Sifre123!\",\"name\":\"Load Test\"}"
    curl -s -o /dev/null -X POST "$BASE_URL/api/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"Sifre123!\"}"
  fi

  printf "\rtur %d/%d" "$i" "$ROUNDS"
  sleep 1
done

echo ""
echo "Bitti. Grafana'da 'Last 15 minutes' aralığıyla dashboard'a bak."
