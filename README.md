# API REST con Node.js, Express y Prisma

Una API REST completa construida con Node.js, Express y Prisma que se conecta a una base de datos MySQL, implementando las mejores prácticas de desarrollo y seguridad.

## 🚀 Características

- **Arquitectura Modular**: Estructura organizada y escalable
- **Seguridad Robusta**: Helmet, CORS, Rate Limiting, Validación
- **Base de Datos Optimizada**: Prisma ORM con MySQL
- **Logging Avanzado**: Winston con rotación de archivos
- **Validación Completa**: Joi para validación de datos
- **Manejo de Errores**: Sistema centralizado de errores
- **Documentación**: Endpoints documentados y ejemplos
- **Testing Ready**: Preparado para implementar tests

## 📋 Prerrequisitos

- Node.js >= 18.0.0
- MySQL >= 8.0
- npm o yarn

## 🛠️ Instalación

1. **Clonar el repositorio**
```bash
git clone <url-del-repositorio>
cd prisma-dev
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp env.example .env
```

Editar el archivo `.env` con tus configuraciones:
```env
DATABASE_URL="mysql://usuario:password@localhost:3306/nombre_base_datos"
PORT=3000
NODE_ENV=development
JWT_SECRET=tu_jwt_secret_super_seguro_aqui
```

4. **Configurar la base de datos**
```bash
# Generar el cliente de Prisma
npm run db:generate

# Sincronizar el esquema con la base de datos
npm run db:push

# O crear migraciones (recomendado para producción)
npm run db:migrate
```

5. **Iniciar el servidor**
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 📚 Endpoints de la API

### Base URL
```
http://localhost:3000/api/v1
```

### Empresas
- `GET /empresas` - Obtener todas las empresas (con paginación)
- `GET /empresas/:id` - Obtener empresa por ID
- `POST /empresas` - Crear nueva empresa
- `PUT /empresas/:id` - Actualizar empresa
- `DELETE /empresas/:id` - Eliminar empresa (soft delete)
- `GET /empresas/stats` - Estadísticas de empresas

### Usuarios
- `GET /usuarios` - Obtener todos los usuarios (con paginación)
- `GET /usuarios/:id` - Obtener usuario por ID
- `POST /usuarios` - Crear nuevo usuario
- `PUT /usuarios/:id` - Actualizar usuario
- `DELETE /usuarios/:id` - Eliminar usuario (soft delete)
- `POST /usuarios/login` - Autenticar usuario
- `GET /usuarios/stats` - Estadísticas de usuarios

### Productos
- `GET /productos` - Obtener todos los productos (con paginación)
- `GET /productos/:id` - Obtener producto por ID
- `POST /productos` - Crear nuevo producto
- `PUT /productos/:id` - Actualizar producto
- `DELETE /productos/:id` - Eliminar producto (soft delete)
- `GET /productos/empresa/:empresaId` - Productos por empresa
- `GET /productos/status/:status` - Productos por estado
- `GET /productos/stats` - Estadísticas de productos

### Utilidades
- `GET /health` - Health check del servidor
- `GET /` - Información de la API

## 🔧 Scripts Disponibles

```bash
npm run dev          # Iniciar en modo desarrollo
npm start            # Iniciar en modo producción
npm run db:generate  # Generar cliente Prisma
npm run db:push      # Sincronizar esquema
npm run db:migrate   # Crear migraciones
npm run db:studio    # Abrir Prisma Studio
npm test             # Ejecutar tests
npm run lint         # Linting del código
npm run lint:fix     # Corregir errores de linting
```

## 🏗️ Estructura del Proyecto

```
prisma-dev/
├── src/
│   ├── config/
│   │   └── database.js          # Configuración de Prisma
│   │   └── schema.prisma            # Esquema de la base de datos
│   ├── controllers/
│   │   ├── empresaController.js # Controlador de empresas
│   │   ├── usuarioController.js # Controlador de usuarios
│   │   └── productoController.js # Controlador de productos
│   ├── middleware/
│   │   ├── security.js          # Middleware de seguridad
│   │   └── errorHandler.js      # Manejo de errores
│   ├── routes/
│   │   ├── index.js             # Rutas principales
│   │   ├── empresaRoutes.js     # Rutas de empresas
│   │   ├── usuarioRoutes.js     # Rutas de usuarios
│   │   └── productoRoutes.js    # Rutas de productos
│   ├── utils/
│   │   ├── logger.js            # Sistema de logging
│   │   └── validation.js        # Esquemas de validación
│   └── server.js                # Archivo principal
├── logs/                        # Archivos de log
├── .env                         # Variables de entorno
├── package.json
└── README.md
```

## 🔒 Seguridad Implementada

### Rate Limiting
- **General**: 100 requests por 15 minutos
- **Autenticación**: 5 intentos por 15 minutos

### Headers de Seguridad
- Helmet para protección básica
- CORS configurado
- XSS Protection
- Content Type Options
- Frame Options

### Validación
- Validación de entrada con Joi
- Sanitización de datos
- Validación de tipos de datos

## 📊 Logging

El sistema utiliza Winston para logging con:
- Rotación automática de archivos
- Diferentes niveles de log
- Logs separados por tipo (error, combined)
- Logging de requests y errores de base de datos

## 🧪 Testing

Para ejecutar los tests:
```bash
npm test
```

## 🚀 Despliegue

### Variables de Entorno de Producción
```env
NODE_ENV=production
DATABASE_URL="mysql://usuario:password@host:puerto/base_datos"
JWT_SECRET="secret_muy_seguro_y_largo"
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000
```

### Comandos de Despliegue
```bash
# Instalar dependencias de producción
npm ci --only=production

# Generar cliente Prisma
npm run db:generate

# Ejecutar migraciones
npm run db:migrate

# Iniciar servidor
npm start
```

## 🤝 Contribución

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

Si tienes problemas o preguntas:
1. Revisa la documentación
2. Busca en los issues existentes
3. Crea un nuevo issue con detalles del problema

## 🔄 Changelog

### v1.0.0
- Implementación inicial de la API
- CRUD completo para Empresas, Usuarios y Productos
- Sistema de autenticación
- Validación y seguridad
- Logging y manejo de errores 