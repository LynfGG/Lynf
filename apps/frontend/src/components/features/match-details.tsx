import type { MatchParticipantSummary, MatchSummary } from '@lynf/shared';
import { useTranslation } from 'react-i18next';

import type { ChampionCatalogue } from '../../api/champion-catalogue';
import { TEAM_POSITION_ORDER } from '../../constants/match-positions';
import { formatNumber } from '../../utils/match-format';
import ChampionPortrait from '../ui/champion-portrait';
import DuelBand from './duel-band';

const TEAM_PORTRAIT_SIZE = 28;

type MatchDetailsProps = {
    match: MatchSummary;
    version: string | undefined;
    catalogue: ChampionCatalogue | undefined;
    viewedPuuid: string;
};

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
    won,
    maxDamage,
    version,
    catalogue,
    language,
}: Readonly<{
    participant: MatchParticipantSummary;
    isViewedPlayer: boolean;
    won: boolean;
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
                        className={`h-1.5 rounded-full ${won ? 'bg-win' : 'bg-loss'}`}
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
                        won={won}
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
 * champion, pseudo, score and a damage bar proportional to the best of the match, drawn
 * in that team's own colour — `win` for whichever side won, `loss` for the other — so
 * the table reads at a glance without reading either header. A roster short of ten — an
 * old match, an unusual queue — simply shows what it has; a mode with more than two
 * teams, Arena among them, shows one column per team instead of assuming exactly two.
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
