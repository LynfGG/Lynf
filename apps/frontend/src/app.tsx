import { createBrowserRouter, RouterProvider } from 'react-router';

import AppProviders from './providers/app-providers';
import RootLayout from './routes/layout';
import HomePage from './routes/page';

/**
 * Routes are declared here, explicitly. The `routes/` tree mirrors the URLs, but
 * nothing derives routing from the file system: the whole map is readable at once.
 */
const router = createBrowserRouter([
    {
        path: '/',
        Component: RootLayout,
        children: [{ index: true, Component: HomePage }],
    },
]);

export default function App() {
    return (
        <AppProviders>
            <RouterProvider router={router} />
        </AppProviders>
    );
}
