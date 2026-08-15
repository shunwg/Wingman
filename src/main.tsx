import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design/tokens/tokens.css';
import './design/tokens/components.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element — index.html is missing its mount point.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
