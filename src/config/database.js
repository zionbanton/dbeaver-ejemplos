const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  errorFormat: 'pretty',
  // Configuración del pool de conexiones para MySQL
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Configuración específica del pool de conexiones
  // Estos parámetros se pueden configurar en la URL de conexión o aquí
});

// Middleware para logging de queries en desarrollo
if (process.env.NODE_ENV === 'development') {
  prisma.$use(async (params, next) => {
    const before = Date.now();
    const result = await next(params);
    const after = Date.now();
    console.log(`Query ${params.model}.${params.action} took ${after - before}ms`);
    return result;
  });
}

// Manejo de errores de conexión
prisma.$connect()
  .then(() => {
    console.log('✅ Conexión a la base de datos establecida');
    console.log('📊 Pool de conexiones configurado');
  })
  .catch((error) => {
    console.error('❌ Error conectando a la base de datos:', error);
    process.exit(1);
  });

// Manejo graceful de desconexión
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma; 