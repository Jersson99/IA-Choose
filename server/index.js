import { config } from './config.js';
import { createApp } from './app.js';

createApp().listen(config.port, '127.0.0.1', () => {
  console.log(`API lista en http://127.0.0.1:${config.port}`);
});
