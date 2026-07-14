// Load environment variables from the .env file into process.env
require('dotenv').config({ quiet: true });

// Import Express framework
const express = require('express');

// Import our custom middlewares
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');

// Import our route definitions
const itemsRouter = require('./routes/items');
const authRouter = require('./routes/auth');

// SOLID / SRP notu:
// Refactor öncesinde bu dosya hem "Express uygulamasını inşa et" hem de
// "sunucuyu belirli bir portta dinlemeye başlat" sorumluluklarını aynı anda
// taşıyordu (dosyanın en altında app.listen(...) çağrısı vardı). Bu, dosyanın
// import edilmesinin OTOMATİK olarak gerçek bir ağ portu açması anlamına
// geliyordu — bu da Supertest gibi araçlarla in-process (portsuz) HTTP
// testi yazmayı imkansız hale getiriyordu. Artık bu dosya SADECE app'i
// inşa edip dışa aktarıyor; sunucuyu başlatma sorumluluğu server.js'e ait.

// Initialize the Express application
const app = express();

// 1. Built-in Middleware: Parse incoming JSON payloads
// This MUST come before our routes so that req.body is populated
app.use(express.json());

// 2. Custom Middleware: Log every incoming request
// Placed after express.json() so we could theoretically log body size accurately
app.use(requestLogger);

// 3. Route Handlers: Mount the items router to the '/api/items' path
app.use('/api/items', itemsRouter);
app.use('/api/auth', authRouter);

// 4. Health Check Endpoint: A simple route to verify the API is running
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// 5. 404 Handler: Catch-all for requests that didn't match any route above
// Since Express reads top-to-bottom, if a request reaches here, it means no route matched it.
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path,
  });
});

// 6. Global Error Handler: Must be the absolute LAST middleware
// Catches any errors passed via next(err) from previous handlers
app.use(errorHandler);

module.exports = app;
