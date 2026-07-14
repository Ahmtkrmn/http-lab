// Sunucuyu gerçekten başlatan tek yer burasıdır.
// app.js "ne" olduğunu (Express uygulaması) tanımlar, server.js ise
// onu "nasıl ve nerede" çalıştıracağını (port dinleme) belirler.
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[SYSTEM] Server is running successfully on http://localhost:${PORT}`);
});
