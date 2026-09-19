import type { MatchParticipantSummary } from '@lynf/shared';
import { useTranslation } from 'react-i18next';

import { formatNumber, formatSignedNumber } from '../../utils/match-format';

/** A non-tied gap never draws thinner than this share of its half of the track. */
const MIN_GAP_WIDTH_PERCENT = 6;
/** A gap never draws past its half of the track, whatever its share of the total is. */
const MAX_GAP_WIDTH_PERCENT = 50;

/**
 * One diverging stat of the lane duel: the player's value on the left, the opponent's
 * on the right, and a bar growing from a central mark toward whoever is ahead.
 *
 * The bar is decorative only — `aria-hidden` — because the two raw values and the gap,
 * written in figures right below it, already say everything it shows. That is also
 * what keeps a perfect tie legible: the gap line reads as an explicit "even" rather than
 * leaving an empty bar with no explanation.
 *
 * Width comes from the gap's share of the combined total (`gapRatio`), not from the raw
 * values — a 10-CS gap on 20 total minions and a 10-CS gap on 400 total minions are very
 * different duels, and only the ratio tells them apart. That ratio is then square-rooted
 * before it is scaled: a duel bar answers "how did the gap feel", not "what fraction of
 * the total was it". Square-rooting boosts a small ratio far more than a large one, so a
 * 10-out-of-400 gap (ratio ≈ 0.025) still draws a clearly visible mark instead of the
 * two-pixel sliver a linear scale would give it, while a total stomp (ratio = 1, one side
 * at zero) still lands exactly at the cap instead of needing a second clamp. A floor
 * width on top of that guarantees even the smallest non-zero gap is never mistaken for
 * rendering noise, and the cap guarantees a crushing gap fills its half without
 * overflowing it.
 */
function DuelStatRow({
    label,
    playerValue,
    opponentValue,
    language,
}: Readonly<{
    label: string;
    playerValue: number;
    opponentValue: number;
    language: string;
}>) {
    const { t } = useTranslation('summoner');
    const diff = playerValue - opponentValue;
    const total = playerValue + opponentValue;
    const isTie = diff === 0;
    const gapRatio = total === 0 ? 0 : Math.abs(diff) / total;
    const widthPercent = isTie
        ? 0
        : Math.min(
              Math.max(Math.sqrt(gapRatio) * MAX_GAP_WIDTH_PERCENT, MIN_GAP_WIDTH_PERCENT),
              MAX_GAP_WIDTH_PERCENT,
          );
    const playerAhead = diff > 0;
    const gapTone = isTie ? 'text-ink-muted' : playerAhead ? 'text-win' : 'text-loss';

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">
                    {formatNumber(playerValue, language)}
                </span>
                <span className="text-ink-muted">{label}</span>
                <span className="font-semibold text-ink">
                    {formatNumber(opponentValue, language)}
                </span>
            </div>

            <div aria-hidden="true" className="relative h-2 rounded-full bg-surface-raised">
                <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
                {!isTie && (
                    <div
                        className={`absolute inset-y-0 rounded-full ${playerAhead ? 'bg-win' : 'bg-loss'}`}
                        style={
                            playerAhead
                                ? { left: '50%', width: `${widthPercent}%` }
                                : { right: '50%', width: `${widthPercent}%` }
                        }
                    />
                )}
            </div>

            <p className={`text-center text-xs font-semibold ${gapTone}`}>
                {isTie
                    ? t('profile.matches.detail.duel.even')
                    : t('profile.matches.detail.duel.gap', {
                          value: formatSignedNumber(diff, language),
                      })}
            </p>
        </div>
    );
}

/**
 * The lane duel band: the player against whoever held the same position on the other
 * team, three diverging stats at a time. `null` whenever Riot's `teamPosition` was
 * empty for this match or no one shared it — Arena among the queues that never carry
 * one — in which case this band simply does not render, and the two-team table below
 * stays the only thing shown.
 */
export default function DuelBand({
    player,
    opponent,
    language,
}: Readonly<{
    player: MatchParticipantSummary;
    opponent: MatchParticipantSummary | null;
    language: string;
}>) {
    const { t } = useTranslation('summoner');

    if (!opponent) {
        return null;
    }

    return (
        <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-ink">
                {t('profile.matches.detail.duel.heading')}
            </h3>

            <DuelStatRow
                label={t('profile.matches.detail.duel.creepScore')}
                playerValue={player.creepScore}
                opponentValue={opponent.creepScore}
                language={language}
            />
            <DuelStatRow
                label={t('profile.matches.detail.duel.gold')}
                playerValue={player.goldEarned}
                opponentValue={opponent.goldEarned}
                language={language}
            />
            <DuelStatRow
                label={t('profile.matches.detail.duel.damage')}
                playerValue={player.totalDamageDealtToChampions}
                opponentValue={opponent.totalDamageDealtToChampions}
                language={language}
            />
        </div>
    );
}
