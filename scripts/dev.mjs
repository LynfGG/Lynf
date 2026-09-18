#!/usr/bin/env node
/**
 * Runs the development stack so that stopping it actually stops it.
 *
 * Three watchers start, and two of them spawn the process that really holds a port:
 * Nest launches the compiled server, Vite serves the front end. Ctrl-C signals only
 * the terminal's foreground process group, and those grandchildren are not in it —
 * so the launcher dies while the servers keep 3000 and 5173, and the next `pnpm dev`
 * cannot bind. Each orphan then has to be hunted down by hand.
 *
 * Signalling one process group is not enough either: `pnpm --parallel` gives each
 * workspace script a process group of its own, so a group kill reaches pnpm and
 * nothing else. What every descendant does share is the *session*, and a session
 * survives a process being orphaned. So the stack is started in a session of its
 * own, and stopping means signalling every process in that session.
 *
 * The children are given no standard input, because a process group that is not the
 * terminal's foreground one is stopped by the kernel the moment it reads from the
 * terminal. The cost is Vite's keyboard shortcuts; the gain is a stack that always
 * stops.
 */
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

/** Long enough for a watcher to close what it is writing, short enough to go unnoticed. */
const GRACE_PERIOD_MS = 3000;

const STEPS = [
    // The applications import the shared package from its dist/, so it has to exist
    // before they start.
    ['pnpm', ['--filter', '@lynf/shared', 'build']],
    [
        'pnpm',
        [
            '--parallel',
            '--filter',
            '@lynf/shared',
            '--filter',
            '@lynf/backend',
            '--filter',
            '@lynf/frontend',
            'dev',
        ],
    ],
];

let current;
let stopping = false;

/**
 * Every process in one session, read from /proc.
 *
 * `comm` sits in parentheses and may itself contain spaces, so the fields are taken
 * after the last closing parenthesis: state, ppid, pgrp, then session.
 */
function sessionMembers(session) {
    const members = [];

    for (const entry of readdirSync('/proc')) {
        if (!/^\d+$/.test(entry)) {
            continue;
        }

        try {
            const stat = readFileSync(`/proc/${entry}/stat`, 'utf8');
            const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');

            if (Number(fields[3]) === session) {
                members.push(Number(entry));
            }
        } catch {
            // The process ended while we were reading it.
        }
    }

    return members;
}

function signalStack(signal) {
    if (!current?.pid) {
        return;
    }

    // `detached` made the child a session leader, so its pid is the session id.
    for (const pid of sessionMembers(current.pid)) {
        if (pid === process.pid) {
            continue;
        }

        try {
            process.kill(pid, signal);
        } catch {
            // Already gone.
        }
    }
}

function stop(exitCode) {
    if (stopping) {
        return;
    }
    stopping = true;

    signalStack('SIGTERM');

    // Whatever has not exited by then is not going to.
    const forced = setTimeout(() => {
        signalStack('SIGKILL');
        process.exit(exitCode);
    }, GRACE_PERIOD_MS);
    forced.unref();

    if (!current) {
        process.exit(exitCode);
        return;
    }

    current.once('exit', () => {
        // The leader can exit while a watcher it started is still winding down.
        signalStack('SIGKILL');
        clearTimeout(forced);
        process.exit(exitCode);
    });
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => stop(0));
}

// A crash of this script must not leave the stack running either. Nothing here can be
// asynchronous, which is why the session is read rather than waited on.
process.on('exit', () => signalStack('SIGKILL'));

function run([command, args]) {
    return new Promise((resolve, reject) => {
        current = spawn(command, args, {
            stdio: ['ignore', 'inherit', 'inherit'],
            detached: true,
        });

        current.on('error', reject);
        current.on('exit', (code, signal) => {
            if (signal) {
                reject(new Error(`${command} was stopped by ${signal}`));
            } else if (code !== 0) {
                reject(new Error(`${command} exited with code ${code}`));
            } else {
                resolve();
            }
        });
    });
}

try {
    for (const step of STEPS) {
        await run(step);
    }
} catch (error) {
    if (!stopping) {
        console.error(error instanceof Error ? error.message : String(error));
        stop(1);
    }
}
