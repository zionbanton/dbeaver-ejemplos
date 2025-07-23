require('dotenv').config();
const express = require('express');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');

// Importar middleware y utilidades
const { helmet, cors } = require('./middleware/security');
const { logRequest } = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Importar rutas
const routes = require('./routes');

// Crear aplicación Express
const app = express();
const server = http.createServer(app);
let io = null;

const { setIo } = require('./socket');
io = new Server(server, {
  cors: {
    origin: '*', // Puedes restringir esto según tus necesidades
    methods: ['GET', 'POST']
  }
});
setIo(io);

// Configurar socket.io para que todas las conexiones se unan al grupo 'global'
io.on('connection', (socket) => {
  socket.join('global');
  console.log(`Socket conectado: ${socket.id} unido al grupo 'global'`);
  // Puedes emitir eventos globales aquí si lo necesitas
});

const PORT = process.env.PORT || 3000;

// Configuración de seguridad y middleware básico
app.use(helmet);
 app.use(cors); // CORS deshabilitado
app.use(compression());

// Configuración de logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Middleware personalizado para logging de requests
app.use(logRequest);

// Configuración de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuración de headers de seguridad adicionales
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Rutas de la aplicación
app.use('/', routes);

// Middleware para rutas no encontradas
app.use(notFoundHandler);

// Middleware para manejo de errores (debe ser el último)
app.use(errorHandler);

// Función para iniciar el servidor
const startServer = async () => {
  try {
    // Verificar conexión a la base de datos
    const prisma = require('./config/database');
    await prisma.$connect();
    
    server.listen(PORT, () => {
      console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
      console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 URL: http://localhost:${PORT}`);
      console.log(`📚 API Docs: http://localhost:${PORT}/`);
      console.log(`💚 Health Check: http://localhost:${PORT}/health`);
      console.log(`🟢 Socket.io activo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

// Manejo graceful de cierre
process.on('SIGTERM', async () => {
  console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
  const prisma = require('./config/database');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Recibida señal SIGINT, cerrando servidor...');
  const prisma = require('./config/database');
  await prisma.$disconnect();
  process.exit(0);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Iniciar servidor
startServer();

module.exports = {
  setIo: (ioInstance) => { io = ioInstance; },
  getIo: () => io
}; 