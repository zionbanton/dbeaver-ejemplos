const prisma = require('../config/database');
const { productoSchema, paginationSchema } = require('../utils/validation');
const { logDatabaseError } = require('../utils/logger');
const mysql = require('mysql2');

const { getIo } = require('../socket');


class ProductoController {
  // Obtener todos los productos con paginación y filtros

  async getAll(req, res) {
    try {
      console.log("********** getAll **********");
      // Validar parámetros de paginación
      const { error, value } = paginationSchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Parámetros de paginación inválidos',
          errors: error.details
        });
      }

      const { page = 1, limit = 100000, sortBy = 'idProducto', sortOrder = 'asc', search } = value;
      
      const skip = (page - 1) * limit;

      // Construir filtros de búsqueda
      const where = {};
      if (search) {
        where.OR = [
          { nombre: { contains: search, mode: 'insensitive' } },
          { codigo: { contains: search, mode: 'insensitive' } },
          { codigoProducto: { contains: search, mode: 'insensitive' } },
          { claveProveedor: { contains: search, mode: 'insensitive' } },
          { descripcion: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Ejecutar consulta con optimización
      const [productos, total] = await Promise.all([
        prisma.producto.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { [sortBy]: sortOrder },
          select: {
            idProducto: true,
            codigo: true,
            nombre: true,
            descripcion: true,
            precio: true,
            costo: true,
            peso: true,
            idEstatus: true,
            isRenta: true,
            visibleInEcomerce: true,
            publicadoPorMarketplace: true,
            createdAt: true,
            empresa: {
              select: {
                id: true,
                nombreComercial: true
              }
            }
          }
        }),
        prisma.producto.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: productos,
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
      logDatabaseError(error, 'GET_ALL', 'Producto');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Obtener un producto por ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const productoId = parseInt(id);


      if (isNaN(productoId)) {
        return res.status(400).json({
          success: false,
          message: 'ID de producto inválido'
        });
      }
      const producto = await prisma.producto.findUnique({
        where: { idProducto: productoId },
        include: {
          empresa: {
            select: {
              id: true,
              nombreComercial: true,
              domicilioComercial: true
            }
          }
        }
      });
      if (!producto) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }


      // Obtener los precios relacionados a este producto
      const precios = await prisma.productoServicioPrecio.findMany({
        where: { idProducto: producto.idProducto }
      });

      const inventario = await prisma.productoInventario.findMany({
        where: { idProducto: producto.idProducto }
      }); 


      producto.precios = precios;
      producto.inventario = inventario;
      

      console.log("producto",producto);

      res.json({
        success: true,
        data: producto
      });

    } catch (error) {
      logDatabaseError(error, 'GET_BY_ID', 'Producto');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Crear un nuevo producto
  async create(req, res) {
    try {
      // El body debe tener la forma: { ...camposProducto, precios: [...], inventario: [...] }
      const { error, value } = productoSchema.create.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Datos de producto inválidos',
          errors: error.details
        });
      }

      // Verificar si ya existe un producto con el mismo código
      const existingProducto = await prisma.producto.findFirst({
        where: {
          OR: [
            { codigo: value.codigo },
            { codigoProducto: value.codigoProducto }
          ]
        }
      });

      if (existingProducto) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un producto con este código'
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

      // Generar slug si no se proporciona
      if (!value.slug && value.nombre) {
        value.slug = value.nombre
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }

      // Extraer listas y quitar del objeto principal
      const { precios, inventario, ...productoData } = value;

      // Transacción para crear producto, precios e inventario
      const resultado = await prisma.$transaction(async (tx) => {
        // Crear producto


        console.log("productoData a insertar: ",productoData)
        const productoCreado = await tx.producto.create({
          data: productoData
        });

        console.log("productoCreado:" , productoCreado);
        
        // Insertar precios si existen
        let preciosCreados = [];
        if (Array.isArray(precios) && precios.length > 0) {

          console.log("precios: ",precios, 
            "productoCreado.idProducto: " , productoCreado.idProducto,
          "productoCreado.idEmpresa:" , productoCreado.idEmpresa);

          preciosCreados = [];
          for (const precio of precios) {
            const precioCreado = await tx.productoServicioPrecio.create({
              data: {
                ...precio,
                idProducto: productoCreado.idProducto,
                idEmpresa: productoCreado.idEmpresa
              }
            });
            console.log("precioCreado: ",precioCreado);
            preciosCreados.push(precioCreado);
          }
        }

        // Insertar inventario si existe
        let inventarioCreado = [];
        if (Array.isArray(inventario) && inventario.length > 0) {
          inventarioCreado = await Promise.all(
            inventario.map(item =>
              tx.productoInventario.create({
                data: {
                  ...item,
                  idProducto: productoCreado.idProducto
                }
              })
            )
          );
        }

        console.log("productoCreado: " , productoCreado);

        return {
          ...productoCreado,
          precios: preciosCreados,
          inventario: inventarioCreado
        };
      });

      getIo().to('global').emit('nuevo_producto', resultado);
      
      res.status(201).json({
        success: true,
        message: 'Producto creado exitosamente',
        data: resultado
      });

      // Emitir evento a todos los clientes del grupo 'global' por socket.io

    } catch (error) {
      logDatabaseError(error, 'CREATE', 'Producto');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Actualizar un producto
  async update(req, res) {
    try {
      const { id } = req.params;
      const productoId = parseInt(id);

      if (isNaN(productoId)) {
        return res.status(400).json({
          success: false,
          message: 'ID de producto inválido'
        });
      }

      
      // Validar datos de entrada
      const { error, value } = productoSchema.update.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Datos de producto inválidos',
          errors: error.details
        });
      }

      // Verificar si el producto existe
      const existingProducto = await prisma.producto.findUnique({
        where: { idProducto: productoId }
      });

      if (!existingProducto) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }

      // Verificar código único si se está actualizando
      if (value.codigo || value.codigoProducto) {
        const whereClause = {
          idProducto: { not: productoId }
        };

        if (value.codigo) {
          whereClause.codigo = value.codigo;
        }
        if (value.codigoProducto) {
          whereClause.codigoProducto = value.codigoProducto;
        }

        console.log("whereClause: " , whereClause);
        const duplicateProducto = await prisma.producto.findFirst({
          where: whereClause
        });

        if (duplicateProducto) {
          return res.status(409).json({
            success: false,
            message: 'Ya existe un producto con este código'
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

      // Generar slug si se actualiza el nombre y no se proporciona slug
      if (value.nombre && !value.slug) {
        value.slug = value.nombre
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }


      const { precios, inventario, empresa, ...productoData } = value;

      console.log("productoData: ", productoData);

      delete productoData.idEmpresa
      delete productoData.idProducto
      

      const producto = await prisma.producto.update({
        where: { idProducto: productoId },
        data: productoData,
        
      });

      getIo().to('global').emit('producto_actualizado', producto);
      
      res.json({
        success: true,
        message: 'Producto actualizado exitosamente',
        data: producto
      });

      // Emitir evento a todos los clientes del grupo 'global' por socket.io
      

    } catch (error) {
      logDatabaseError(error, 'UPDATE', 'Producto');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Eliminar un producto (soft delete cambiando status)
  async delete(req, res) {
    try {
      const { id } = req.params;
      const productoId = parseInt(id);

      if (isNaN(productoId)) {
        return res.status(400).json({
          success: false,
          message: 'ID de producto inválido'
        });
      }

      // Verificar si el producto existe
      const existingProducto = await prisma.producto.findUnique({
        where: { idProducto: productoId }
      });

      if (!existingProducto) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }

      // Soft delete - cambiar status a 0 (inactivo)
      const producto = await prisma.producto.update({
        where: { idProducto: productoId },
        data: { idEstatus: 0 },
        select: {
          idProducto: true,
          codigo: true,
          nombre: true,
          idEstatus: true
        }
      });

      res.json({
        success: true,
        message: 'Producto eliminado exitosamente',
        data: producto
      });

    } catch (error) {
      logDatabaseError(error, 'DELETE', 'Producto');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Buscar productos por empresa
  async getByEmpresa(req, res) {
    try {
      const { empresaId } = req.params;
      const { page = 1, limit = 10, sortBy = 'nombre', sortOrder = 'asc' } = req.query;
      const skip = (page - 1) * limit;

      const empresaIdInt = parseInt(empresaId);
      if (isNaN(empresaIdInt)) {
        return res.status(400).json({
          success: false,
          message: 'ID de empresa inválido'
        });
      }

      // Verificar si la empresa existe
      const empresa = await prisma.empresa.findUnique({
        where: { id: empresaIdInt }
      });

      if (!empresa) {
        return res.status(404).json({
          success: false,
          message: 'Empresa no encontrada'
        });
      }

      const [productos, total] = await Promise.all([
        prisma.producto.findMany({
          where: { idEmpresa: empresaIdInt },
          skip,
          take: parseInt(limit),
          orderBy: { [sortBy]: sortOrder },
          select: {
            idProducto: true,
            codigo: true,
            nombre: true,
            descripcion: true,
            precio: true,
            costo: true,
            idEstatus: true,
            visibleInEcomerce: true,
            publicadoPorMarketplace: true
          }
        }),
        prisma.producto.count({ where: { idEmpresa: empresaIdInt } })
      ]);

      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: productos,
        empresa: {
          id: empresa.id,
          nombreComercial: empresa.nombreComercial
        },
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
      logDatabaseError(error, 'GET_BY_EMPRESA', 'Producto');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Obtener productos por categoría/estado
  async getByStatus(req, res) {
    try {
      const { status } = req.params;
      const { page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      const statusInt = parseInt(status);
      if (isNaN(statusInt)) {
        return res.status(400).json({
          success: false,
          message: 'Status inválido'
        });
      }

      const [productos, total] = await Promise.all([
        prisma.producto.findMany({
          where: { idEstatus: statusInt },
          skip,
          take: parseInt(limit),
          orderBy: { nombre: 'asc' },
          select: {
            idProducto: true,
            codigo: true,
            nombre: true,
            precio: true,
            idEstatus: true,
            empresa: {
              select: {
                id: true,
                nombreComercial: true
              }
            }
          }
        }),
        prisma.producto.count({ where: { idEstatus: statusInt } })
      ]);

      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: productos,
        status: statusInt,
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
      logDatabaseError(error, 'GET_BY_STATUS', 'Producto');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Obtener estadísticas de productos
  async getStats(req, res) {
    try {
      const stats = await prisma.producto.aggregate({
        _count: {
          idProducto: true
        },
        _avg: {
          precio: true,
          costo: true
        },
        _sum: {
          precio: true
        },
        where: {
          idEstatus: { not: 0 } // Solo productos activos
        }
      });

      const statusCounts = await prisma.producto.groupBy({
        by: ['idEstatus'],
        _count: {
          idProducto: true
        }
      });

      const empresaCounts = await prisma.producto.groupBy({
        by: ['idEmpresa'],
        _count: {
          idProducto: true
        },
        where: {
          idEstatus: { not: 0 }
        },
        orderBy: {
          _count: {
            idProducto: 'desc'
          }
        },
        take: 10
      });

      res.json({
        success: true,
        data: {
          totalProductos: stats._count.idProducto,
          precioPromedio: stats._avg.precio,
          costoPromedio: stats._avg.costo,
          valorTotal: stats._sum.precio,
          porStatus: statusCounts,
          topEmpresas: empresaCounts
        }
      });

    } catch (error) {
      logDatabaseError(error, 'GET_STATS', 'Producto');
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Obtener todos los productos usando streaming para grandes volúmenes
  async getAllStream(req, res) {
    // Requiere tener instalada la librería mysql2: npm install mysql2
    // Puedes mover esta configuración a un archivo de config si lo prefieres
    const connection = mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'nombre_de_tu_base',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    });

    // Obtener el parámetro 'limit' del query string, con valor por defecto si no está presente
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    
    try {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Iniciar el JSON
      res.write('{"success":true,"data":[');
      let isFirst = true;
      let totalCount = 0;

      const query = 'SELECT id_producto, codigo, nombre, descripcion, precio, costo, peso, id_estatus, is_renta, visible_in_ecomerce, publicado_por_marketplace, created_at id_empresa FROM c_producto LIMIT 0,?';
      const stream = connection.query(query,limit).stream({ highWaterMark: 1000 });

      stream.on('data', (row) => {
        if (!isFirst) {
          res.write(',');
        }
        res.write(JSON.stringify(row));
        isFirst = false;
        totalCount++;
      });

      stream.on('end', () => {
        res.write(`],"total":${totalCount}}`);
        res.end();
        connection.end();
      });

      stream.on('error', (error) => {
        logDatabaseError(error, 'GET_ALL_STREAM', 'Producto');
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        } else {
          res.write(`],"error":"Error interno del servidor"}`);
          res.end();
        }
        connection.end();
      });
    } catch (error) {
      logDatabaseError(error, 'GET_ALL_STREAM', 'Producto');
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error interno del servidor',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      } else {
        res.write(`],"error":"Error interno del servidor"}`);
        res.end();
      }
      connection.end();
    }
  }

  // Obtener productos por empresa usando streaming
  async getByEmpresaStream(req, res) {
    try {
      const { empresaId } = req.params;
      const { page = 1, limit = 1000, sortBy = 'nombre', sortOrder = 'asc' } = req.query;
      const skip = (page - 1) * limit;

      const empresaIdInt = parseInt(empresaId);
      if (isNaN(empresaIdInt)) {
        return res.status(400).json({
          success: false,
          message: 'ID de empresa inválido'
        });
      }

      // Verificar si la empresa existe
      const empresa = await prisma.empresa.findUnique({
        where: { id: empresaIdInt }
      });

      if (!empresa) {
        return res.status(404).json({
          success: false,
          message: 'Empresa no encontrada'
        });
      }

      // Configurar headers para streaming
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Iniciar respuesta JSON
      res.write(`{"success":true,"empresa":{"id":${empresa.id},"nombreComercial":"${empresa.nombreComercial}"},"data":[`);

      let isFirst = true;
      let totalCount = 0;

      // Usar cursor para streaming
      const cursor = await prisma.producto.findMany({
        where: { idEmpresa: empresaIdInt },
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        select: {
          idProducto: true,
          codigo: true,
          nombre: true,
          descripcion: true,
          precio: true,
          costo: true,
          idEstatus: true,
          visibleInEcomerce: true,
          publicadoPorMarketplace: true
        }
      });

      // Procesar cada producto y enviarlo como chunk
      for (const producto of cursor) {
        if (!isFirst) {
          res.write(',');
        }
        res.write(JSON.stringify(producto));
        isFirst = false;
        totalCount++;
      }

      // Obtener total de registros para paginación
      const total = await prisma.producto.count({ where: { idEmpresa: empresaIdInt } });
      const totalPages = Math.ceil(total / limit);

      // Cerrar respuesta JSON con metadata
      res.write(`],"pagination":{"page":${parseInt(page)},"limit":${parseInt(limit)},"total":${total},"totalPages":${totalPages},"hasNext":${page < totalPages},"hasPrev":${page > 1}},"streamedCount":${totalCount}}`);
      res.end();

    } catch (error) {
      logDatabaseError(error, 'GET_BY_EMPRESA_STREAM', 'Producto');
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error interno del servidor',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      } else {
        res.write(`],"error":"Error interno del servidor"}`);
        res.end();
      }
    }
  }
}

module.exports = new ProductoController(); 