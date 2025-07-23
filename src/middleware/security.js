const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

// Configuración de rate limiting
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Rate limiters específicos
const generalLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  'Demasiadas solicitudes desde esta IP, inténtalo de nuevo más tarde'
);

const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutos
  5, // 5 intentos
  'Demasiados intentos de autenticación, inténtalo de nuevo más tarde'
);

// Configuración de CORS
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://tu-dominio.com'] 
    : ['http://localhost:3000', 'http://localhost:3001','http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Configuración de Helmet
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
};

module.exports = {
  helmet: helmet(helmetConfig),
  cors: cors(corsOptions),
  generalLimiter,
  authLimiter
}; 