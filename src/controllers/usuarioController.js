const prisma = require('../config/database');
const { usuarioSchema, paginationSchema } = require('../utils/validation');
const { logDatabaseError } = require('../utils/logger');
const bcrypt = require('bcryptjs');

class UsuarioController {
  // Obtener todos los usuarios con paginación y filtros
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

      const { page = 1, limit = 10, sortBy = 'idUsuario', sortOrder = 'asc', search } = value;
      const skip = (page - 1) * limit;

      // Construir filtros de búsqueda
      const where = {};
      if (search) {
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { nombre: { contains: search, mode: 'insensitive' } },
          { apellidos: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Ejecutar consulta con optimización
      const [usuarios, total] = await Promise.all([
        prisma.usuario.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { [sortBy]: sortOrder },
          select: {
            idUsuario: true,
            username: true,
            nombre: true,
            apellidos: true,
            email: true,
            celular: true,
            idRol: true,
            idStatus: true,
            createdAt: true,
            empresa: {
              select: {
                id: true,
                nombreComercial: true
              }
            }
          }
        }),
        prisma.usuario.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: usuarios,
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
      logDatabaseError(error, 'GET_ALL', 'Usuario');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Obtener un usuario por ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const usuarioId = parseInt(id);

      if (isNaN(usuarioId)) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario inválido'
        });
      }

      const usuario = await prisma.usuario.findUnique({
        where: { idUsuario: usuarioId },
        include: {
          empresa: {
            select: {
              id: true,
              nombreComercial: true,
              domicilioComercial: true,
              telefono: true,
              email: true
            }
          }
        }
      });

      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // No enviar la contraseña en la respuesta
      const { password, ...usuarioSinPassword } = usuario;

      res.json({
        success: true,
        data: usuarioSinPassword
      });

    } catch (error) {
      logDatabaseError(error, 'GET_BY_ID', 'Usuario');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Crear un nuevo usuario
  async create(req, res) {
    try {
      // Validar datos de entrada
      const { error, value } = usuarioSchema.create.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Datos de usuario inválidos',
          errors: error.details
        });
      }

      // Verificar si ya existe un usuario con el mismo username o email
      const existingUsuario = await prisma.usuario.findFirst({
        where: {
          OR: [
            { username: value.username },
            { email: value.email }
          ]
        }
      });

      if (existingUsuario) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un usuario con este username o email'
        });
      }

      // Verificar si la empresa existe si se proporciona
      if (value.idEmpresa) {
        const empresa = await prisma.empresa.findUnique({
          where: { id: value.idEmpresa }
        });

        if (!empresa) {
          return res.status(400).json({
            success: false,
            message: 'La empresa especificada no existe'
          });
        }
      }

      // Encriptar contraseña
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(value.password, saltRounds);

      const usuario = await prisma.usuario.create({
        data: {
          ...value,
          password: hashedPassword
        },
        select: {
          idUsuario: true,
          username: true,
          nombre: true,
          apellidos: true,
          email: true,
          celular: true,
          idRol: true,
          idStatus: true,
          createdAt: true,
          empresa: {
            select: {
              id: true,
              nombreComercial: true
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente',
        data: usuario
      });

    } catch (error) {
      logDatabaseError(error, 'CREATE', 'Usuario');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Actualizar un usuario
  async update(req, res) {
    try {
      const { id } = req.params;
      const usuarioId = parseInt(id);

      if (isNaN(usuarioId)) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario inválido'
        });
      }

      // Validar datos de entrada
      const { error, value } = usuarioSchema.update.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Datos de usuario inválidos',
          errors: error.details
        });
      }

      // Verificar si el usuario existe
      const existingUsuario = await prisma.usuario.findUnique({
        where: { idUsuario: usuarioId }
      });

      if (!existingUsuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar username y email únicos si se están actualizando
      if (value.username || value.email) {
        const whereClause = {
          idUsuario: { not: usuarioId }
        };

        if (value.username) {
          whereClause.username = value.username;
        }
        if (value.email) {
          whereClause.email = value.email;
        }

        const duplicateUser = await prisma.usuario.findFirst({
          where: whereClause
        });

        if (duplicateUser) {
          return res.status(409).json({
            success: false,
            message: 'Ya existe un usuario con este username o email'
          });
        }
      }

      // Verificar si la empresa existe si se proporciona
      if (value.idEmpresa) {
        const empresa = await prisma.empresa.findUnique({
          where: { id: value.idEmpresa }
        });

        if (!empresa) {
          return res.status(400).json({
            success: false,
            message: 'La empresa especificada no existe'
          });
        }
      }

      // Encriptar contraseña si se está actualizando
      let updateData = { ...value };
      if (value.password) {
        const saltRounds = 12;
        updateData.password = await bcrypt.hash(value.password, saltRounds);
      }

      const usuario = await prisma.usuario.update({
        where: { idUsuario: usuarioId },
        data: updateData,
        select: {
          idUsuario: true,
          username: true,
          nombre: true,
          apellidos: true,
          email: true,
          celular: true,
          idRol: true,
          idStatus: true,
          updatedAt: true,
          empresa: {
            select: {
              id: true,
              nombreComercial: true
            }
          }
        }
      });

      res.json({
        success: true,
        message: 'Usuario actualizado exitosamente',
        data: usuario
      });

    } catch (error) {
      logDatabaseError(error, 'UPDATE', 'Usuario');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Eliminar un usuario (soft delete cambiando status)
  async delete(req, res) {
    try {
      const { id } = req.params;
      const usuarioId = parseInt(id);

      if (isNaN(usuarioId)) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario inválido'
        });
      }

      // Verificar si el usuario existe
      const existingUsuario = await prisma.usuario.findUnique({
        where: { idUsuario: usuarioId }
      });

      if (!existingUsuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Soft delete - cambiar status a 0 (inactivo)
      const usuario = await prisma.usuario.update({
        where: { idUsuario: usuarioId },
        data: { idStatus: 0 },
        select: {
          idUsuario: true,
          username: true,
          nombre: true,
          apellidos: true,
          email: true,
          idStatus: true
        }
      });

      res.json({
        success: true,
        message: 'Usuario eliminado exitosamente',
        data: usuario
      });

    } catch (error) {
      logDatabaseError(error, 'DELETE', 'Usuario');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Autenticar usuario
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username y password son requeridos'
        });
      }

      // Buscar usuario por username o email
      const usuario = await prisma.usuario.findFirst({
        where: {
          OR: [
            { username: username },
            { email: username }
          ],
          idStatus: { not: 0 } // Solo usuarios activos
        },
        include: {
          empresa: {
            select: {
              id: true,
              nombreComercial: true
            }
          }
        }
      });

      if (!usuario) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // Verificar contraseña
      const isPasswordValid = await bcrypt.compare(password, usuario.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // No enviar la contraseña en la respuesta
      const { password: _, ...usuarioSinPassword } = usuario;

      res.json({
        success: true,
        message: 'Autenticación exitosa',
        data: usuarioSinPassword
      });

    } catch (error) {
      logDatabaseError(error, 'LOGIN', 'Usuario');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Obtener estadísticas de usuarios
  async getStats(req, res) {
    try {
      const stats = await prisma.usuario.aggregate({
        _count: {
          idUsuario: true
        },
        where: {
          idStatus: { not: 0 } // Solo usuarios activos
        }
      });

      const statusCounts = await prisma.usuario.groupBy({
        by: ['idStatus'],
        _count: {
          idUsuario: true
        }
      });

      const roleCounts = await prisma.usuario.groupBy({
        by: ['idRol'],
        _count: {
          idUsuario: true
        },
        where: {
          idStatus: { not: 0 }
        }
      });

      res.json({
        success: true,
        data: {
          totalUsuarios: stats._count.idUsuario,
          porStatus: statusCounts,
          porRol: roleCounts
        }
      });

    } catch (error) {
      logDatabaseError(error, 'GET_STATS', 'Usuario');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new UsuarioController(); 