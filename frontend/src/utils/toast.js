import { toast } from 'react-hot-toast';

export const success = (msg) => toast.success(msg);
export const error = (msg) => toast.error(msg);
export const info = (msg) => toast(msg);

// Shto këtë rresht që DashboardHome të mos nxjerrë gabim:
export const showError = (msg) => toast.error(msg);