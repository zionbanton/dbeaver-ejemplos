const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');
const { generalLimiter } = require('../middleware/security');
const { cacheMedium, cacheLong, cacheShort } = require('../middleware/cache');

// Aplicar rate limiting a todas las rutas de producto
router.use(generalLimiter);

// Rutas principales de producto con caché
router.get('/', cacheMedium, productoController.getAll);
router.get('/stream', productoController.getAllStream); // Sin caché para streaming
router.get('/stats', cacheShort, productoController.getStats); // Caché corto para stats
router.get('/:id', cacheMedium, productoController.getById);
router.post('/', productoController.create);
router.put('/:id', productoController.update);
router.delete('/:id', productoController.delete);

// Rutas especializadas de producto con caché
router.get('/empresa/:empresaId', cacheLong, productoController.getByEmpresa); // Caché largo para datos por empresa
router.get('/empresa/:empresaId/stream', productoController.getByEmpresaStream); // Sin caché para streaming
router.get('/status/:status', cacheMedium, productoController.getByStatus);

module.exports = router; 