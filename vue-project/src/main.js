import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap';

import { createApp } from 'vue';
import App from './App.vue';
import { createPinia } from 'pinia';

const app = createApp(App); // Create the app instance first
const pinia = createPinia(); // Create the Pinia store

app.use(pinia); // Use the Pinia store with the app instance

app.mount('#app'); // Mount the app