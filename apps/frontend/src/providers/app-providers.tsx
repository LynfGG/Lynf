import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import '../i18n';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // The back end already caches Riot data; the browser only needs to
            // avoid refetching the same profile on every focus change.
            staleTime: 60_000,
            refetchOnWindowFocus: false,
        },
    },
});

export default function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
