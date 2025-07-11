const { logger } = require('../utils/logger');

// Middleware para manejo de errores
const errorHandler = (err, req, res, next) => {
  // Log del error
  logger.error('Error no manejado:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Determinar el tipo de error
  let statusCode = 500;
  let message = 'Error interno del servidor';

  // Errores de Prisma
  if (err.code) {
    switch (err.code) {
      case 'P2002':
        statusCode = 409;
        message = 'Conflicto: Ya existe un registro con estos datos';
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Registro no encontrado';
        break;
      case 'P2003':
        statusCode = 400;
        message = 'Error de referencia: Datos relacionados no válidos';
        break;
      case 'P2014':
        statusCode = 400;
        message = 'Error de relación: No se puede eliminar debido a referencias';
        break;
      default:
        statusCode = 400;
        message = 'Error de base de datos';
    }
  }

  // Errores de validación
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Error de validación';
  }

  // Errores de sintaxis JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'JSON inválido en el cuerpo de la petición';
  }

  // Errores de límite de tamaño
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'Archivo demasiado grande';
  }

  // Errores de límite de peticiones
  if (err.status === 429) {
    statusCode = 429;
    message = 'Demasiadas peticiones, inténtalo más tarde';
  }

  // Respuesta de error
  const errorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method
  };

  // Incluir detalles del error solo en desarrollo
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error = err.message;
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

// Middleware para capturar errores asíncronos
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Middleware para manejar errores de rutas no encontradas
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Ruta no encontrada: ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler
}; 