const express = require('express');
const router = express.Router();
const empresaController = require('../controllers/empresaController');
const { generalLimiter } = require('../middleware/security');
const { cacheMedium, cacheLong, cacheShort } = require('../middleware/cache');

// Aplicar rate limiting a todas las rutas de empresa
router.use(generalLimiter);

// Rutas principales de empresa con caché
router.get('/', cacheMedium, empresaController.getAll);
router.get('/stats', cacheShort, empresaController.getStats); // Caché corto para stats
router.get('/:id', cacheLong, empresaController.getById); // Caché largo para datos de empresa específica
router.post('/', empresaController.create);
router.put('/:id', empresaController.update);
router.delete('/:id', empresaController.delete);

module.exports = router; 