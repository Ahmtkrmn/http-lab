// Tüm testlerden önce çalışır: test ortamı için .env.test dosyasını yükler.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.test'), quiet: true });
