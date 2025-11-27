// server.js
require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const { sequelize, syncModels } = require('./models/index.model');
const router = require('./routes/router');

const app = express();

app.use(cors());

app.use(express.json());
app.use(morgan('dev'));
app.use(helmet());

app.use('/api', router);

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // Установить соединение и синхронизировать модели
    await sequelize.authenticate();
    console.log('Database connected');
    await syncModels(); // sync models (alter true in implementation)
    // Запуск сервера
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });

    // Импорт и запуск планировщика (он сам запускает initial full sync + запустит cron)
    const scheduler = require('./config/cron');
    scheduler.start(); // экспортируем объект CronJob с методом start
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
