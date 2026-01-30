/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                'convex-dark': '#0f0f0f',
                'convex-darker': '#0a0a0a',
                'convex-border': '#2a2a2a',
                'convex-accent': '#f97316',
                'convex-accent-hover': '#ea580c',
                'convex-success': '#22c55e',
                'convex-error': '#ef4444',
                'convex-warning': '#eab308',
            },
        },
    },
    plugins: [],
};
