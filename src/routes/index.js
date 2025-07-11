const express = require('express');
const router = express.Router();

// Importar todas las rutas
const empresaRoutes = require('./empresaRoutes');
const usuarioRoutes = require('./usuarioRoutes');
const productoRoutes = require('./productoRoutes');

// Definir rutas principales con versionado
const API_VERSION = '/api/v1';

// Rutas de la API
router.use(`${API_VERSION}/empresas`, empresaRoutes);
router.use(`${API_VERSION}/usuarios`, usuarioRoutes);
router.use(`${API_VERSION}/productos`, productoRoutes);

// Ruta de health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ruta de información de la API
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API REST con Node.js, Express y Prisma',
    version: '1.0.0',
    endpoints: {
      empresas: `${API_VERSION}/empresas`,
      usuarios: `${API_VERSION}/usuarios`,
      productos: `${API_VERSION}/productos`,
      health: '/health'
    },
    documentation: 'Documentación disponible en /docs (cuando se implemente)'
  });
});

// Middleware para manejar rutas no encontradas
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /api/v1/empresas',
      'GET /api/v1/usuarios',
      'GET /api/v1/productos'
    ]
  });
});

module.exports = router; 