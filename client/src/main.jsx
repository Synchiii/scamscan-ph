import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './enhancements.css';
import './workflow.css';

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>,
);
