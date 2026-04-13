const cors = require('cors');
module.exports = cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', // ✅ dinámico para Render
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
});
 