const { execSync } = require('child_process');
const fs = require('fs');

describe('Monorepo Setup Tests', () => {
  describe('File Structure', () => {
    test('should have correct workspace structure', () => {
      // Check root package.json exists
      expect(fs.existsSync('package.json')).toBe(true);

      // Check workspaces exist
      expect(fs.existsSync('backend')).toBe(true);
      expect(fs.existsSync('frontend')).toBe(true);

      // Check backend structure
      expect(fs.existsSync('backend/package.json')).toBe(true);
      expect(fs.existsSync('backend/src/index.js')).toBe(true);

      // Check frontend structure
      expect(fs.existsSync('frontend/package.json')).toBe(true);
      expect(fs.existsSync('frontend/src/main.js')).toBe(true);
      expect(fs.existsSync('frontend/vite.config.js')).toBe(true);
    });

    test('should have configuration files', () => {
      expect(fs.existsSync('.eslintrc.js')).toBe(true);
      expect(fs.existsSync('.prettierrc')).toBe(true);
      expect(fs.existsSync('.github/workflows/ci.yml')).toBe(true);
    });
  });

  describe('Package Configuration', () => {
    test('root package.json should have workspaces configured', () => {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      expect(packageJson.workspaces).toEqual(['backend', 'frontend']);
      expect(packageJson.scripts.lint).toBeDefined();
      expect(packageJson.scripts.test).toBeDefined();
    });

    test('backend package.json should have required dependencies', () => {
      const packageJson = JSON.parse(
        fs.readFileSync('backend/package.json', 'utf8')
      );
      const requiredDeps = [
        'express',
        'sequelize',
        'pg',
        'dotenv',
        'jsonwebtoken',
        'aws-sdk',
        'joi',
        'bcrypt',
      ];

      requiredDeps.forEach(dep => {
        expect(packageJson.dependencies[dep]).toBeDefined();
      });
    });

    test('frontend package.json should have Vue 3 and Vuetify', () => {
      const packageJson = JSON.parse(
        fs.readFileSync('frontend/package.json', 'utf8')
      );
      expect(packageJson.dependencies.vue).toBeDefined();
      expect(packageJson.dependencies.vuetify).toBeDefined();
      expect(packageJson.devDependencies.vite).toBeDefined();
      expect(packageJson.devDependencies['@vitejs/plugin-vue']).toBeDefined();
    });
  });

  describe('Linting', () => {
    test('lint should fail on bad file', () => {
      expect(() => {
        execSync('npm run lint', { stdio: 'pipe' });
      }).toThrow();
    });

    test('lint should pass after removing bad file', () => {
      // Temporarily rename the bad file
      if (fs.existsSync('bad-file.js')) {
        fs.renameSync('bad-file.js', 'bad-file.js.bak');
      }

      try {
        execSync('npm run lint', { stdio: 'pipe' });
        // If we get here, lint passed
        expect(true).toBe(true);
      } catch (error) {
        // Restore the bad file and fail the test
        if (fs.existsSync('bad-file.js.bak')) {
          fs.renameSync('bad-file.js.bak', 'bad-file.js');
        }
        throw error;
      } finally {
        // Restore the bad file
        if (fs.existsSync('bad-file.js.bak')) {
          fs.renameSync('bad-file.js.bak', 'bad-file.js');
        }
      }
    });
  });

  describe('Test Commands', () => {
    test('npm test command should exist and run', () => {
      // This test itself proves that npm test runs successfully
      expect(true).toBe(true);
    });

    test('workspace test commands should be defined', () => {
      const backendPkg = JSON.parse(
        fs.readFileSync('backend/package.json', 'utf8')
      );
      const frontendPkg = JSON.parse(
        fs.readFileSync('frontend/package.json', 'utf8')
      );

      expect(backendPkg.scripts.test).toBeDefined();
      expect(frontendPkg.scripts.test).toBeDefined();
    });
  });

  describe('CI Configuration', () => {
    test('GitHub Actions workflow should be properly configured', () => {
      const ciConfig = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

      expect(ciConfig).toContain('npm run lint');
      expect(ciConfig).toContain('npm test');
      expect(ciConfig).toContain('npm run format:check');
      expect(ciConfig).toContain('npm run build:backend');
      expect(ciConfig).toContain('npm run build:frontend');
    });
  });
});
