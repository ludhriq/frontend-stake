import { createRouter, createWebHistory } from 'vue-router';
import Stake from '@/modules/stake/Stake.vue';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: Stake,
        },
    ],
});

export default router;
