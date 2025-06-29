import './assets/main.css';

import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import ToastService from 'primevue/toastservice';
import { Buffer } from 'buffer';

if (!(window as any).Buffer) {
    (window as any).Buffer = Buffer;
}

const app = createApp(App);
app.use(PrimeVue, {
    theme: {
        preset: Aura,
        options: {
            darkModeSelector: '.p-dark',
        },
    }
});
app.use(ToastService);
app.use(router);

app.mount('#app');
