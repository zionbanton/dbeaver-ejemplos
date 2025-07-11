const prisma = require('../config/database');
const { empresaSchema, paginationSchema } = require('../utils/validation');
const { logDatabaseError } = require('../utils/logger');

class EmpresaController {
  // Obtener todas las empresas con paginación y filtros
  async getAll(req, res) {
    try {
      // Validar parámetros de paginación
      const { error, value } = paginationSchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Parámetros de paginación inválidos',
          errors: error.details
        });
      }

      const { page = 1, limit = 10, sortBy = 'id', sortOrder = 'asc', search } = value;
      const skip = (page - 1) * limit;

      // Construir filtros de búsqueda
      const where = {};
      if (search) {
        where.OR = [
          { nombreComercial: { contains: search, mode: 'insensitive' } },
          { nombreContacto: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Ejecutar consulta con optimización
      const [empresas, total] = await Promise.all([
        prisma.empresa.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { [sortBy]: sortOrder },
          select: {
            id: true,
            nombreComercial: true,
            domicilioComercial: true,
            nombreContacto: true,
            telefono: true,
            email: true,
            idStatus: true,
            fechaContratacion: true,
            precioVenta: true,
            _count: {
              select: {
                usuarios: true,
                productos: true
              }
            }
          }
        }),
        prisma.empresa.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: empresas,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });

    } catch (error) {
      logDatabaseError(error, 'GET_ALL', 'Empresa');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Obtener una empresa por ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const empresaId = parseInt(id);

      if (isNaN(empresaId)) {
        return res.status(400).json({
          success: false,
          message: 'ID de empresa inválido'
        });
      }

      const empresa = await prisma.empresa.findUnique({
        where: { id: empresaId },
        include: {
          usuarios: {
            select: {
              idUsuario: true,
              username: true,
              nombre: true,
              apellidos: true,
              email: true,
              idStatus: true
            }
          },
          productos: {
            select: {
              idProducto: true,
              nombre: true,
              codigo: true,
              precio: true,
              idEstatus: true
            },
            take: 10 // Limitar productos para evitar sobrecarga
          }
        }
      });

      if (!empresa) {
        return res.status(404).json({
          success: false,
          message: 'Empresa no encontrada'
        });
      }

      res.json({
        success: true,
        data: empresa
      });

    } catch (error) {
      logDatabaseError(error, 'GET_BY_ID', 'Empresa');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Crear una nueva empresa
  async create(req, res) {
    try {
      // Validar datos de entrada
      const { error, value } = empresaSchema.create.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Datos de empresa inválidos',
          errors: error.details
        });
      }

      // Verificar si ya existe una empresa con el mismo email
      if (value.email) {
        const existingEmpresa = await prisma.empresa.findFirst({
          where: { email: value.email }
        });

        if (existingEmpresa) {
          return res.status(409).json({
            success: false,
            message: 'Ya existe una empresa con este email'
          });
        }
      }

      const empresa = await prisma.empresa.create({
        data: value
      });

      res.status(201).json({
        success: true,
        message: 'Empresa creada exitosamente',
        data: empresa
      });

    } catch (error) {
      logDatabaseError(error, 'CREATE', 'Empresa');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Actualizar una empresa
  async update(req, res) {
    try {
      const { id } = req.params;
      const empresaId = parseInt(id);

      if (isNaN(empresaId)) {
        return res.status(400).json({
          success: false,
          message: 'ID de empresa inválido'
        });
      }

      // Validar datos de entrada
      const { error, value } = empresaSchema.update.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Datos de empresa inválidos',
          errors: error.details
        });
      }

      // Verificar si la empresa existe
      const existingEmpresa = await prisma.empresa.findUnique({
        where: { id: empresaId }
      });

      if (!existingEmpresa) {
        return res.status(404).json({
          success: false,
          message: 'Empresa no encontrada'
        });
      }

      // Verificar email único si se está actualizando
      if (value.email && value.email !== existingEmpresa.email) {
        const emailExists = await prisma.empresa.findFirst({
          where: { 
            email: value.email,
            id: { not: empresaId }
          }
        });

        if (emailExists) {
          return res.status(409).json({
            success: false,
            message: 'Ya existe una empresa con este email'
          });
        }
      }

      const empresa = await prisma.empresa.update({
        where: { id: empresaId },
        data: value
      });

      res.json({
        success: true,
        message: 'Empresa actualizada exitosamente',
        data: empresa
      });

    } catch (error) {
      logDatabaseError(error, 'UPDATE', 'Empresa');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Eliminar una empresa (soft delete cambiando status)
  async delete(req, res) {
    try {
      const { id } = req.params;
      const empresaId = parseInt(id);

      if (isNaN(empresaId)) {
        return res.status(400).json({
          success: false,
          message: 'ID de empresa inválido'
        });
      }

      // Verificar si la empresa existe
      const existingEmpresa = await prisma.empresa.findUnique({
        where: { id: empresaId }
      });

      if (!existingEmpresa) {
        return res.status(404).json({
          success: false,
          message: 'Empresa no encontrada'
        });
      }

      // Soft delete - cambiar status a 0 (cancelado)
      const empresa = await prisma.empresa.update({
        where: { id: empresaId },
        data: { idStatus: 0 }
      });

      res.json({
        success: true,
        message: 'Empresa eliminada exitosamente',
        data: empresa
      });

    } catch (error) {
      logDatabaseError(error, 'DELETE', 'Empresa');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Obtener estadísticas de empresas
  async getStats(req, res) {
    try {
      const stats = await prisma.empresa.aggregate({
        _count: {
          id: true
        },
        _avg: {
          precioVenta: true
        },
        where: {
          idStatus: { not: 0 } // Solo empresas activas
        }
      });

      const statusCounts = await prisma.empresa.groupBy({
        by: ['idStatus'],
        _count: {
          id: true
        }
      });

      res.json({
        success: true,
        data: {
          totalEmpresas: stats._count.id,
          precioPromedio: stats._avg.precioVenta,
          porStatus: statusCounts
        }
      });

    } catch (error) {
      logDatabaseError(error, 'GET_STATS', 'Empresa');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new EmpresaController(); 