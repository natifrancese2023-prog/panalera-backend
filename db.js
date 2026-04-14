const { Pool } = require('pg');
require('dotenv').config();

let pool;

if (process.env.DATABASE_URL) {
  // CONFIGURACIÓN PARA RENDER (Producción)
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { 
      rejectUnauthorized: false 
    },
  });
} else {
  // CONFIGURACIÓN PARA TU PC (Local)
  pool = new Pool({
    user:     process.env.DB_USER,
    host:     process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port:     process.env.DB_PORT,
  });
}

// Prueba de conexión rápida
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Error de conexión:', err.stack);
  } else {
    const mode = process.env.DATABASE_URL ? 'PRODUCCIÓN (Neon)' : 'LOCAL';
    console.log(`✅ Conexión exitosa en modo: ${mode}`);
  }
});

module.exports = pool;