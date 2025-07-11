const apicache = require('apicache-extra');

// Configuraciones de caché predefinidas
const cacheConfigs = {
  // Caché corto para datos que cambian frecuentemente
  short: {
    duration: '1 minute',
    statusCodes: { include: [200, 201] }
  },
  
  // Caché medio para datos que cambian ocasionalmente
  medium: {
    duration: '5 minutes',
    statusCodes: { include: [200, 201] }
  },
  
  // Caché largo para datos que cambian raramente
  long: {
    duration: '15 minutes',
    statusCodes: { include: [200, 201] }
  },
  
  // Caché muy largo para datos estáticos
  static: {
    duration: '1 hour',
    statusCodes: { include: [200, 201] }
  }
};

// Middleware de caché personalizado
const createCacheMiddleware = (duration = '5 minutes', options = {}) => {
  const defaultOptions = {
    statusCodes: { include: [200, 201] },
    headers: {
      'cache-control': 'no-cache'
    },
    ...options
  };
  
  return apicache.middleware(duration, (req, res) => {
    // Solo cachear rutas GET
    if (req.method !== 'GET') return false;
    
    // No cachear rutas de streaming
    if (req.path.includes('/stream')) return false;
    
    // No cachear rutas de estadísticas si se especifica
    if (options.noStats && req.path.includes('/stats')) return false;
    
    return true;
  });
};

// Middlewares predefinidos
const cacheShort = createCacheMiddleware('1 minute');
const cacheMedium = createCacheMiddleware('5 minutes');
const cacheLong = createCacheMiddleware('15 minutes');
const cacheStatic = createCacheMiddleware('1 hour');

// Middleware para invalidar caché
const clearCache = (req, res, next) => {
  apicache.clear();
  next();
};

// Middleware para invalidar caché específico
const clearCacheByPattern = (pattern) => {
  return (req, res, next) => {
    apicache.clear(pattern);
    next();
  };
};

// Función para obtener estadísticas de caché
const getCacheStats = () => {
  return apicache.getStats();
};

module.exports = {
  createCacheMiddleware,
  cacheShort,
  cacheMedium,
  cacheLong,
  cacheStatic,
  clearCache,
  clearCacheByPattern,
  getCacheStats,
  cacheConfigs
}; 