const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { generalLimiter } = require('../middleware/security');
const { cacheMedium, cacheShort } = require('../middleware/cache');

// Aplicar rate limiting a todas las rutas de usuario
router.use(generalLimiter);

// Rutas principales de usuario con caché
router.get('/', cacheMedium, usuarioController.getAll);
router.get('/stats', cacheShort, usuarioController.getStats); // Caché corto para stats
router.get('/:id', cacheMedium, usuarioController.getById);
router.post('/', usuarioController.create);
router.put('/:id', usuarioController.update);
router.delete('/:id', usuarioController.delete);

// Rutas especializadas de usuario
router.post('/login', usuarioController.login); // Sin caché para login

module.exports = router; 