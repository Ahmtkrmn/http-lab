// Sunucuyu gerçekten başlatan tek yer burasıdır.
// app.js "ne" olduğunu (Express uygulaması) tanımlar, server.js ise
// onu "nasıl ve nerede" çalıştıracağını (port dinleme) belirler.
const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  // Week 8: `console.log` yerine structured logger. Sunucunun ayağa kalkması da
  // bir "iş olayı"dır (INFO seviyesi) ve JSON olarak loglanması, container
  // log'larında başlangıç anını makine-okur biçimde işaretler.
  logger.info({ port: PORT }, 'server started');
});
