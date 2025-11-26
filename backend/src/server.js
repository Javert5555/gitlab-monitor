// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { sequelize } = require('./config/database');
const router = require('./routes/router');
const { syncModels } = require('./models/index.model');
const syncProjects = require('./services/syncProjects');


// delete later
// const riskDetector = require('./services/riskDetector');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Routes
app.use('/api', router);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

syncModels().then(() => {
  console.log("📦 DB synced");
  app.listen(3000, () => console.log("Server started on 3000"));
});

(async () => {
  await syncModels();  // создаёт таблицы
  await syncProjects(); // импортирует проекты GitLab
})();

// Инициализация и запуск приложения
async function startServer() {
  try {
    // Подключаемся к базе данных
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    app.listen(PORT, () => {
      console.log(`CI/CD Security Monitor is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Unable to start the application:', error);
    process.exit(1);
  }
}

// Обработка graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await sequelize.close();
  process.exit(0);
});

// Запускаем сервер
startServer();