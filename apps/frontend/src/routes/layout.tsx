import { Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';

import LanguageSwitcher from '../components/features/language-switcher';
import RiotLegalNotice from '../components/features/riot-legal-notice';

export default function RootLayout() {
    const { t } = useTranslation();

    return (
        <div className="flex min-h-screen flex-col bg-slate-950 text-slate-200">
            <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                <div>
                    <h1 className="text-lg font-bold text-slate-100">{t('appName')}</h1>
                    <p className="text-xs text-slate-500">{t('tagline')}</p>
                </div>
                <LanguageSwitcher />
            </header>

            <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
                <Outlet />
            </main>

            <footer className="border-t border-slate-800 px-5 py-6">
                <RiotLegalNotice />
            </footer>
        </div>
    );
}
