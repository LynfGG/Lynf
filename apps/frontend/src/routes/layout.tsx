import { Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';

import LanguageSwitcher from '../components/features/language-switcher';
import RiotLegalNotice from '../components/features/riot-legal-notice';

export default function RootLayout() {
    const { t } = useTranslation();

    return (
        <div className="flex min-h-screen flex-col bg-ground text-ink">
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
                <div>
                    <h1 className="font-display text-lg uppercase tracking-[3px] text-gold">
                        {t('appName')}
                    </h1>
                    <p className="text-xs text-ink-muted">{t('tagline')}</p>
                </div>
                <LanguageSwitcher />
            </header>

            <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
                <Outlet />
            </main>

            <footer className="border-t border-line px-5 py-6">
                <RiotLegalNotice />
            </footer>
        </div>
    );
}
