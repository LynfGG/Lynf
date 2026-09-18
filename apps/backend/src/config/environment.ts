import { z } from 'zod';

/**
 * Environment variables are always strings, so every non-string value is coerced
 * here rather than at each call site. The application refuses to start when one
 * is missing or malformed — see `validateEnvironment`.
 */
export const environmentSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),

    DATABASE_URL: z.string().min(1),

    RIOT_API_KEY: z.string().min(1),

    /** How long a stored profile is considered fresh before Riot is asked again. */
    SUMMONER_PROFILE_TTL_SECONDS: z.coerce.number().int().positive().default(600),

    /** How long stored ranked standings are considered fresh before Riot is asked again. */
    SUMMONER_RANKS_TTL_SECONDS: z.coerce.number().int().positive().default(900),

    /** How long stored champion masteries are considered fresh before Riot is asked again. */
    SUMMONER_MASTERIES_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
});

export type Environment = z.infer<typeof environmentSchema>;

export class EnvironmentValidationError extends Error {}

/**
 * Parses the process environment, or throws with every problem listed at once —
 * fixing one variable per restart is a waste of everyone's time.
 */
export function validateEnvironment(source: NodeJS.ProcessEnv): Environment {
    const result = environmentSchema.safeParse(source);

    if (result.success) {
        return result.data;
    }

    const problems = result.error.issues
        .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n');

    throw new EnvironmentValidationError(
        `Invalid environment.\n\n${problems}\n\nSee .env.example for the expected variables.`,
    );
}
