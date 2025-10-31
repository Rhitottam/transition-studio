import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Note: StrictMode is disabled because it runs effects twice in development,
// which is incompatible with canvas.transferControlToOffscreen() that can only be called once
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
