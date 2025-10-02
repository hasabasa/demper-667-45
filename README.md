# 🏪 Kaspi Demper Panel

**Панель управления для автоматизации цен на Kaspi.kz**

[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green.svg)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.x-cyan.svg)](https://tailwindcss.com/)

## 🚀 Возможности

- **💰 Автодемпинг цен** - Автоматическое отслеживание и корректировка цен
- **📊 Аналитика продаж** - Подробная статистика по заказам и доходам
- **📦 Управление предзаказами** - Создание и отслеживание предзаказов
- **🔗 Интеграция с Kaspi.kz** - Прямое подключение к вашему магазину
- **📱 Адаптивный дизайн** - Работает на всех устройствах
- **🌙 Темная/светлая тема** - Удобный интерфейс в любое время

## 🛠 Технологии

### Frontend
- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** + **ShadCN UI** 
- **React Router** + **React Query**
- **Sonner** (уведомления)

### Backend  
- **FastAPI** + **Python 3.13**
- **PostgreSQL** + **AsyncPG**
- **Playwright** (автоматизация браузера)
- **Supabase** (аутентификация)

## 📋 Установка

### Требования
- Node.js 18+
- Python 3.11+
- PostgreSQL (опционально)

### 1. Клонирование репозитория
```bash
git clone https://github.com/hasabasa/demper-667-45.git
cd demper-667-45
```

### 2. Установка зависимостей

#### Frontend
```bash
npm install
```

#### Backend
```bash
cd kaspi-backend/backend
pip install -r requirements.txt
playwright install chromium
```

### 3. Настройка переменных окружения

Создайте `.env` файл:
```env
# Frontend
VITE_API_URL=http://localhost:8010
VITE_BACKEND_URL=http://localhost:8010

# Backend (kaspi-backend/backend/.env)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
DATABASE_URL=postgresql://user:password@localhost/dbname
```

## 🚦 Запуск

### Режим разработки

**Frontend** (терминал 1):
```bash
npm run dev
# Доступно на http://localhost:8080
```

**Backend** (терминал 2):
```bash
cd kaspi-backend/backend
uvicorn main:app --host 0.0.0.0 --port 8010 --reload
# API доступно на http://localhost:8010
```

### Быстрый запуск (тестовый режим)
```bash
# Только для демонстрации
python3 real_backend.py
npm run dev
```

## 📱 Использование

### 1. Подключение магазина
- Откройте http://localhost:8080
- Перейдите в **Интеграции**
- Введите данные от Kaspi.kz (email + пароль или SMS)

### 2. Настройка демпера
- Перейдите в **Price Bot**
- Выберите товары для отслеживания
- Установите минимальную маржу и шаг изменения цены

### 3. Анализ продаж
- Откройте **Мои продажи**
- Просматривайте графики и метрики
- Анализируйте топ товары

## 🏗 Структура проекта

```
kaspi-panel/
├── src/                    # Frontend код
│   ├── components/         # UI компоненты
│   ├── pages/             # Страницы приложения
│   ├── services/          # API сервисы
│   └── hooks/             # React хуки
├── kaspi-backend/         # Backend код
│   ├── backend/           # FastAPI приложение
│   ├── routes/            # API маршруты
│   └── migrations/        # Миграции БД
└── public/                # Статические файлы
```

## 🤝 Разработка

### Команды разработки
```bash
# Установка зависимостей
npm install

# Запуск dev сервера
npm run dev

# Сборка проекта
npm run build

# Линтинг
npm run lint

# Превью сборки
npm run preview
```

### API документация
После запуска backend доступна на:
- **Swagger UI**: http://localhost:8010/docs
- **ReDoc**: http://localhost:8010/redoc

## 🔧 Конфигурация

### Настройка демпера
- Минимальная маржа: от 100 ₸
- Шаг изменения цены: 50-500 ₸
- Интервал проверки: 5-60 минут

### Поддерживаемые склады
- Алматы (Склад 1, 2, 3)
- Астана (Склад 4)
- Шымкент (Склад 5)


**⭐ Поставьте звезду если проект оказался полезным!**