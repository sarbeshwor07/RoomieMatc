import { execSync } from 'node:child_process';
import fs from 'node:fs';

const isTargetAdmin =
  process.env.APP === 'admin' ||
  process.env.VITE_APP === 'admin' ||
  (process.env.VERCEL_PROJECT_NAME && process.env.VERCEL_PROJECT_NAME.toLowerCase().includes('admin'));

if (isTargetAdmin) {
  console.log('[Build] Building RoomieMatch Admin Portal...');
  execSync('npm run build:admin', { stdio: 'inherit' });
  if (fs.existsSync('dist/admin')) {
    fs.cpSync('dist/admin', 'dist', { recursive: true });
  }
} else {
  console.log('[Build] Building RoomieMatch Client Portal...');
  execSync('npm run build:client', { stdio: 'inherit' });
  if (fs.existsSync('dist/client')) {
    fs.cpSync('dist/client', 'dist', { recursive: true });
  }
}
