# Catalog V0 - Full-Stack Monorepo

A modern full-stack monorepo built with Express.js, Vue 3, and Vuetify, featuring comprehensive CI/CD setup and testing infrastructure.

## 🏗️ Architecture

This monorepo consists of two main workspaces:

- **Backend**: Express.js API server with Sequelize ORM
- **Frontend**: Vue 3 application with Vuetify UI framework

## 📦 Tech Stack

### Backend

- **Express.js** - Web framework
- **Sequelize** - ORM for PostgreSQL
- **PostgreSQL** - Database
- **JWT** - Authentication
- **AWS SDK** - Cloud services integration
- **Joi** - Schema validation
- **bcrypt** - Password hashing

### Frontend

- **Vue 3** - Progressive JavaScript framework
- **Vuetify 3** - Material Design component library
- **Vite** - Build tool and dev server
- **Vue Router** - Client-side routing
- **Pinia** - State management
- **Axios** - HTTP client

### Development Tools

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Jest/Vitest** - Testing frameworks
- **GitHub Actions** - CI/CD pipeline

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm (comes with Node.js)
- PostgreSQL (for backend development)

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd catalog-v0
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
# Backend
cp backend/env.example backend/.env
# Edit backend/.env with your configuration
```

4. Start development servers:

```bash
# Start backend (runs on http://localhost:3000)
npm run dev:backend

# Start frontend (runs on http://localhost:5173)
npm run dev:frontend
```

## 📋 Available Scripts

### Root Level

- `npm run install:all` - Install all dependencies
- `npm run lint` - Run ESLint on all workspaces
- `npm run lint:fix` - Fix linting issues automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm test` - Run tests in all workspaces
- `npm run dev:backend` - Start backend development server
- `npm run dev:frontend` - Start frontend development server
- `npm run build:backend` - Build backend for production
- `npm run build:frontend` - Build frontend for production

### Backend

- `npm run dev --workspace=backend` - Start development server
- `npm run test --workspace=backend` - Run backend tests
- `npm run test:watch --workspace=backend` - Run tests in watch mode

### Frontend

- `npm run dev --workspace=frontend` - Start development server
- `npm run build --workspace=frontend` - Build for production
- `npm run preview --workspace=frontend` - Preview production build
- `npm run test --workspace=frontend` - Run frontend tests

## 🧪 Testing

The project includes comprehensive testing setup:

- **Jest** for backend testing with Supertest for API testing
- **Vitest** for frontend testing with Vue Test Utils
- **Setup tests** that verify the monorepo configuration

Run all tests:

```bash
npm test
```

## 🔧 Configuration

### ESLint

- Configured for TypeScript, Vue 3, and Node.js
- Includes Prettier integration
- Custom rules for code quality

### Prettier

- Consistent code formatting across the monorepo
- Integrated with ESLint

### CI/CD

- GitHub Actions workflow for automated testing
- Runs on multiple Node.js versions (18.x, 20.x)
- Includes linting, formatting checks, and testing
- Security audit with yarn audit

## 📁 Project Structure

```
catalog-v0/
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI workflow
├── backend/
│   ├── src/
│   │   └── index.js           # Express server entry point
│   ├── __tests__/
│   │   └── app.test.js        # Backend tests
│   ├── package.json           # Backend dependencies
│   └── env.example            # Environment variables template
├── frontend/
│   ├── src/
│   │   ├── components/        # Vue components
│   │   ├── views/             # Page components
│   │   ├── plugins/           # Vue plugins (Vuetify)
│   │   ├── router/            # Vue Router configuration
│   │   ├── test/              # Test utilities
│   │   ├── App.vue            # Root component
│   │   └── main.js            # Application entry point
│   ├── public/                # Static assets
│   ├── package.json           # Frontend dependencies
│   ├── vite.config.js         # Vite configuration
│   └── index.html             # HTML template
├── .eslintrc.js               # ESLint configuration
├── .prettierrc                # Prettier configuration
├── .gitignore                 # Git ignore rules
├── package.json               # Root package.json with workspaces
├── setup.test.js              # Monorepo setup tests
├── bad-file.js                # Deliberately bad file for testing linting
└── README.md                  # This file
```

## 🔄 Development Workflow

1. **Make changes** to backend or frontend code
2. **Run linting** to check code quality:
   ```bash
   npm run lint
   ```
3. **Fix formatting** if needed:
   ```bash
   npm run lint:fix
   npm run format
   ```
4. **Run tests** to ensure everything works:
   ```bash
   npm test
   ```
5. **Commit changes** (CI will run automatically on push)

## 🚢 Deployment

### Backend

The backend can be deployed to any Node.js hosting platform:

- Heroku
- AWS EC2/ECS
- DigitalOcean
- Railway

### Frontend

The frontend builds to static files and can be deployed to:

- Netlify
- Vercel
- AWS S3 + CloudFront
- GitHub Pages

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and ensure tests pass: `npm test`
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ using modern web technologies
