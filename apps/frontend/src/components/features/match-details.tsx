import type { MatchParticipantSummary, MatchSummary } from '@lynf/shared';
import { useTranslation } from 'react-i18next';

import type { ChampionCatalogue } from '../../api/champion-catalogue';
import { TEAM_POSITION_ORDER } from '../../constants/match-positions';
import { formatNumber, formatSignedNumber } from '../../utils/match-format';
import { ChampionPortrait } from './match-card';

const TEAM_PORTRAIT_SIZE = 28;

type MatchDetailsProps = {
    match: MatchSummary;
    version: string | undefined;
    catalogue: ChampionCatalogue | undefined;
    viewedPuuid: string;
};

/**
 * One diverging stat of the lane duel: the player's value on the left, the opponent's
 * on the right, and a bar growing from a central mark toward whoever is ahead.
 *
 * The bar is decorative only — `aria-hidden` — because the two raw values and the gap,
 * written in figures right below it, already say everything it shows. That is also
 * what keeps a perfect tie legible: the gap line reads as an explicit "even" rather than
 * leaving an empty bar with no explanation.
 *
 * Position and width both come from the gap (`diff`), normalised against the combined
 * total so the result never exceeds half the track in either direction — a negative
 * width is never computed, only ever an absolute one anchored on the correct side.
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
    const ratio = isTie ? 0 : diff / total;
    const widthPercent = Math.min(Math.abs(ratio) * 50, 50);
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
function DuelBand({
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

/** Riot's own lane order, unrecognised or empty positions — Arena among them — last. */
function sortByPosition(
    participants: readonly MatchParticipantSummary[],
): MatchParticipantSummary[] {
    const rank = (participant: MatchParticipantSummary) => {
        const index = TEAM_POSITION_ORDER.indexOf(participant.teamPosition);
        return index === -1 ? TEAM_POSITION_ORDER.length : index;
    };

    return [...participants].sort((a, b) => rank(a) - rank(b));
}

/** Every participant, grouped by `teamId` and kept in the order Riot first reported. */
function groupByTeam(
    participants: readonly MatchParticipantSummary[],
): [number, MatchParticipantSummary[]][] {
    const groups = new Map<number, MatchParticipantSummary[]>();

    for (const participant of participants) {
        const group = groups.get(participant.teamId);

        if (group) {
            group.push(participant);
        } else {
            groups.set(participant.teamId, [participant]);
        }
    }

    return [...groups.entries()].sort(([a], [b]) => a - b);
}

function TeamRow({
    participant,
    isViewedPlayer,
    maxDamage,
    version,
    catalogue,
    language,
}: Readonly<{
    participant: MatchParticipantSummary;
    isViewedPlayer: boolean;
    maxDamage: number;
    version: string | undefined;
    catalogue: ChampionCatalogue | undefined;
    language: string;
}>) {
    const { t } = useTranslation('summoner');
    const damageShare =
        maxDamage > 0 ? (participant.totalDamageDealtToChampions / maxDamage) * 100 : 0;

    return (
        <li
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                isViewedPlayer ? 'bg-surface-raised' : ''
            }`}
        >
            <ChampionPortrait
                championId={participant.championId}
                size={TEAM_PORTRAIT_SIZE}
                version={version}
                catalogue={catalogue}
            />

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1 truncate text-xs font-medium text-ink">
                    <span className="truncate">
                        {participant.riotIdGameName}#{participant.riotIdTagline}
                    </span>
                    {isViewedPlayer && (
                        <span className="shrink-0 text-[10px] font-semibold text-gold uppercase">
                            {t('profile.matches.detail.teams.you')}
                        </span>
                    )}
                </span>
                <span className="text-[11px] text-ink-muted">
                    {t('profile.matches.kda', {
                        kills: participant.kills,
                        deaths: participant.deaths,
                        assists: participant.assists,
                    })}
                </span>
            </div>

            <div className="flex w-24 shrink-0 flex-col items-end gap-0.5">
                <span className="text-[11px] text-ink-muted">
                    <span className="sr-only">{t('profile.matches.detail.teams.damage')}: </span>
                    {formatNumber(participant.totalDamageDealtToChampions, language)}
                </span>
                <div className="h-1.5 w-full rounded-full bg-surface-raised" aria-hidden="true">
                    <div
                        className="h-1.5 rounded-full bg-gold"
                        style={{ width: `${damageShare}%` }}
                    />
                </div>
            </div>
        </li>
    );
}

function TeamColumn({
    teamId,
    members,
    viewedPuuid,
    maxDamage,
    version,
    catalogue,
    language,
}: Readonly<{
    teamId: number;
    members: MatchParticipantSummary[];
    viewedPuuid: string;
    maxDamage: number;
    version: string | undefined;
    catalogue: ChampionCatalogue | undefined;
    language: string;
}>) {
    const { t } = useTranslation('summoner');
    const won = members.some((member) => member.win);

    return (
        <div className="flex flex-col gap-1">
            <h4 className={`text-xs font-semibold uppercase ${won ? 'text-win' : 'text-loss'}`}>
                {t(won ? 'profile.matches.result.win' : 'profile.matches.result.loss')}
            </h4>
            <ul className="flex flex-col gap-1" data-team-id={teamId}>
                {sortByPosition(members).map((participant) => (
                    <TeamRow
                        key={participant.puuid}
                        participant={participant}
                        isViewedPlayer={participant.puuid === viewedPuuid}
                        maxDamage={maxDamage}
                        version={version}
                        catalogue={catalogue}
                        language={language}
                    />
                ))}
            </ul>
        </div>
    );
}

/**
 * The two-team breakdown: every participant Riot reported, grouped by team, each with
 * champion, pseudo, score and a damage bar proportional to the best of the match. A
 * roster short of ten — an old match, an unusual queue — simply shows what it has;
 * a mode with more than two teams, Arena among them, shows one column per team instead
 * of assuming exactly two.
 */
function TeamsSection({
    participants,
    viewedPuuid,
    version,
    catalogue,
    language,
}: Readonly<{
    participants: readonly MatchParticipantSummary[];
    viewedPuuid: string;
    version: string | undefined;
    catalogue: ChampionCatalogue | undefined;
    language: string;
}>) {
    const { t } = useTranslation('summoner');
    const maxDamage = Math.max(0, ...participants.map((p) => p.totalDamageDealtToChampions));
    const teams = groupByTeam(participants);

    return (
        <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-ink">
                {t('profile.matches.detail.teams.heading')}
            </h3>

            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {teams.map(([teamId, members]) => (
                    <TeamColumn
                        key={teamId}
                        teamId={teamId}
                        members={members}
                        viewedPuuid={viewedPuuid}
                        maxDamage={maxDamage}
                        version={version}
                        catalogue={catalogue}
                        language={language}
                    />
                ))}
            </div>
        </div>
    );
}

/**
 * The disclosure panel inside a match card: the lane duel first, the full two-team
 * breakdown below it. Reads exactly what the match history tranche already stored —
 * `match.participants` — so opening a match never calls Riot.
 */
export default function MatchDetails({
    match,
    version,
    catalogue,
    viewedPuuid,
}: Readonly<MatchDetailsProps>) {
    const { i18n } = useTranslation('summoner');

    return (
        <div className="flex flex-col gap-5 border-t border-line pt-3">
            <DuelBand player={match.player} opponent={match.opponent} language={i18n.language} />

            <TeamsSection
                participants={match.participants}
                viewedPuuid={viewedPuuid}
                version={version}
                catalogue={catalogue}
                language={i18n.language}
            />
        </div>
    );
}
