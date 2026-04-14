const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const multer = require('multer'); // 👈 Importamos multer
const path = require('path');

const productosController = require('../controllers/productosController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');


// 1. Configuración de Credenciales (Vienen de tu .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Configuración del Almacenamiento en la Nube
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mimitos_productos', // Se crea sola en Cloudinary
    allowed_formats: ['jpeg', 'jpg', 'png', 'webp'],
    public_id: (req, file) => Date.now() + '-' + file.originalname.split('.')[0] // Nombre único
  },
});

// 3. El Middleware de Multer actualizado
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // Seguimos manteniendo el límite de 2MB
  },
  fileFilter: (req, file, cb) => {
    // Tus validaciones de tipo de archivo siguen siendo válidas y necesarias
    const tiposPermitidos = /jpeg|jpg|png|webp/;
    const mimetype = tiposPermitidos.test(file.mimetype);
    const extname = tiposPermitidos.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('El archivo debe ser una imagen válida (jpg, png o webp)'));
  }
});

// --- VALIDACIONES ---
const validarProducto = [
  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio'),

  body('id_categoria')
    .notEmpty()
    .toInt() // 👈 ESTO es la clave: convierte "1" (string) a 1 (int)
    .isInt({ min: 1 })
    .withMessage('Debe indicar una categoría válida'),

  // Podés agregar validaciones para las variantes si querés ser más estricta
  body('variantes')
    .optional()
    .custom((value) => {
        // Si viene como string desde el FormData, tratamos de parsearlo
        try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            if (parsed && !Array.isArray(parsed)) throw new Error();
            return true;
        } catch (e) {
            throw new Error('Las variantes deben ser un formato válido');
        }
    })
];
// --- RUTAS ---
router.get('/catalogo', productosController.listarCatalogo);
router.get('/', verificarToken, verificarRol(['dueno']), productosController.listarProductos);

// 🚀 POST: Agregamos upload.single('imagen')
// 'imagen' es el nombre del campo que usaremos en el FormData del frontend
router.post('/', 
  verificarToken, 
  verificarRol(['dueno']), 
  upload.single('imagen'), 
  validarProducto, 
  productosController.crearProducto
);

// 🚀 PUT: También lo agregamos para poder cambiar la foto después
router.put('/:id', 
  verificarToken, 
  verificarRol(['dueno']), 
  upload.single('imagen'), 
  validarProducto, 
  productosController.actualizarProducto
);

router.delete('/:id', verificarToken, verificarRol(['dueno']), productosController.eliminarProducto);

module.exports = router;