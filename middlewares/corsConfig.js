const corsOptions = {
    origin: [
        'https://mimitos-admin.onrender.com', // Tu frontend en producción
        'http://localhost:3000',              // Para cuando pruebes local
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:8080'               // Por si usas Vite local
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true // Importante para las cookies/tokens
};

module.exports = corsOptions;