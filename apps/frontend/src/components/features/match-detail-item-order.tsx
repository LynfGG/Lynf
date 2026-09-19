import { EMatchTimelineItemAction, type MatchTimelineItemEvent } from '@lynf/shared';
import { useTranslation } from 'react-i18next';

import { DATA_DRAGON_BASE_URL } from '../../constants/data-dragon';
import { formatMatchDuration } from '../../utils/match-format';

const ITEM_ICON_SIZE = 24;

type MatchDetailItemOrderProps = {
    itemEvents: readonly MatchTimelineItemEvent[];
    puuid: string;
    version: string | undefined;
};

/**
 * The item purchase order: every purchase or sale of this participant, in the order it
 * happened, each with its item icon and the game time it happened at.
 *
 * Cancelled purchases never reach this list at all — the back end already resolves an
 * `ITEM_UNDO` against the purchase or sale it cancels at extraction time, so nothing
 * here has to guess which entries were later undone.
 */
export default function MatchDetailItemOrder({
    itemEvents,
    puuid,
    version,
}: Readonly<MatchDetailItemOrderProps>) {
    const { t } = useTranslation('summoner');
    const ownEvents = itemEvents
        .filter((event) => event.puuid === puuid)
        .sort((a, b) => a.timestampMs - b.timestampMs);

    return (
        <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-ink">
                {t('profile.matches.detail.stuff.itemOrder.heading')}
            </h3>

            {ownEvents.length === 0 ? (
                <p className="text-sm text-ink-muted">
                    {t('profile.matches.detail.stuff.itemOrder.empty')}
                </p>
            ) : (
                <ol className="flex flex-wrap gap-2">
                    {ownEvents.map((event, index) => {
                        const isSold = event.action === EMatchTimelineItemAction.SOLD;
                        const time = formatMatchDuration(Math.round(event.timestampMs / 1000));

                        return (
                            <li
                                key={index}
                                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1"
                            >
                                {version ? (
                                    <img
                                        src={`${DATA_DRAGON_BASE_URL}/cdn/${version}/img/item/${event.itemId}.png`}
                                        alt=""
                                        width={ITEM_ICON_SIZE}
                                        height={ITEM_ICON_SIZE}
                                        className={`rounded object-cover ${isSold ? 'opacity-50' : ''}`}
                                    />
                                ) : (
                                    <div
                                        className="rounded bg-surface-raised"
                                        style={{ width: ITEM_ICON_SIZE, height: ITEM_ICON_SIZE }}
                                    />
                                )}

                                <div className="flex flex-col">
                                    <span
                                        className={`text-[10px] font-semibold uppercase ${isSold ? 'text-loss' : 'text-win'}`}
                                    >
                                        {t(
                                            isSold
                                                ? 'profile.matches.detail.stuff.itemOrder.sold'
                                                : 'profile.matches.detail.stuff.itemOrder.bought',
                                        )}
                                    </span>
                                    <span className="text-[10px] text-ink-muted">
                                        {t('profile.matches.detail.stuff.itemOrder.item', {
                                            id: event.itemId,
                                        })}
                                        {' · '}
                                        {time}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}
