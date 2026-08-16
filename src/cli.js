#!/usr/bin/env node
/**
 * dsh-porter CLI 骨架（SPEC v0.6）
 * 命令: inspect | migrate | convert | repair | archive
 * 约定: --json 输出 schema、退出码分级（见 SPEC §3.7/3.8）
 */
import { Command } from './command.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 版本单一事实源：package.json（避免与包版本打架）
const VERSION = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')).version;

const usage = `dsh-porter v${VERSION} — DSH session data ops CLI

Tool for operating on DSH (DeepSeek Harness) session data: migrate sessions
between data roots (with cwd path conversion + workspace sync), health-check,
repair, format-convert. Zero dsh dependency.

USAGE:
  dsh-porter <command> [options]

COMMANDS:

  inspect <session-file | data-root> [--json]
    Health-check sessions: id/cwd/version/frames/lines/status
    (ok | corrupt | unknown-format). Zero writes.
    WHEN: verify a data root before migration; debug an unreadable session.
    EXAMPLES:
      dsh-porter inspect ~/.dsh
      dsh-porter inspect ~/.dsh/sessions/--mnt-f-PROJECTS--/<id>/session.jsonl.zstd --json

  migrate <src-root> <dst-root> --direction to-wsl|to-win|auto [--map TABLE] [--conflict skip|new-id|abort] [--copy-unchanged] [--no-sync-workspace] [--dry-run] [--json]
    Migrate sessions across roots: convert header.cwd (F:\\PROJECTS <-> /mnt/f/PROJECTS),
    rewrite frames in dsh-compliant format, sync target workspace membership.
    Archived sessions stay archived. Does NOT delete sources (use archive).
    WHEN: move sessions between WSL root and Windows root (EAC/desktop/CLI).
    EXAMPLES:
      dsh-porter migrate /mnt/c/Users/1/.dsh ~/.dsh --direction to-wsl --dry-run
      dsh-porter migrate /mnt/c/Users/1/.dsh ~/.dsh --direction to-wsl

  convert <session-file> --format zstd|plain [--out DIR]
    Convert session between zstd-compressed and plain .jsonl.
    Same-format returns noop. WHEN: grep/debug session content.
    EXAMPLE:
      dsh-porter convert session.jsonl.zstd --format plain --out /tmp

  repair <session-file> [--quarantine DIR]
    Repair a corrupt session: truncate torn tail (keep valid prefix),
    or quarantine polluted files. Original file is moved to quarantine first.
    WHEN: session fails to open / dsh reports corrupt log.
    EXAMPLE:
      dsh-porter repair ~/.dsh/sessions/--mnt-f-PROJECTS--/<id>/session.jsonl.zstd

  archive <src-root> <dst-root> [--direction X] [--dry-run] [--json]
    Migrate + two-phase source cleanup: sessions move to .archive-pending,
    then \`archive --finalize <src-root>\` deletes them permanently.
    THE ONLY COMMAND THAT DELETES SOURCES. WHEN: migrate then remove source.
    EXAMPLE:
      dsh-porter archive /mnt/c/Users/1/.dsh ~/.dsh --direction to-wsl --dry-run

  --version | --help

OPTIONS:
  --dry-run    preview only, no writes
  --json       machine-readable output
  --map "SRC=DST,SRC=DST"   custom path mapping rules (longest-prefix match)
  --conflict   same-id session in target: skip (default) | new-id | abort

EXIT CODES:
  0 all ok (incl. skipped) | 1 partial failure | 2 usage error | 3 environment error

RULES (breaking these can crash a running dsh):
  - DSH sessions are multi-frame zstd: NEVER recompress a whole file as one
    frame (first frame must be exactly one header line). Use migrate/convert only.
  - NEVER edit storages/*.json with a text editor (BOM/CRLF breaks dsh parsing).
  - Stop any running dsh (EAC/web) before migrating large sessions.
`;

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') { console.log(usage); process.exit(0); }
  if (args[0] === '--version' || args[0] === '-V') { console.log(VERSION); process.exit(0); }

  const cmd = new Command(args);
  try {
    const result = await cmd.run();
    if (result.json) console.log(JSON.stringify(result.json, null, 2));
    process.exit(result.exitCode ?? 0);
  } catch (e) {
    // 用法错误(2) / 环境错误(3) 分级
    console.error(`错误[${e.code ?? 'E_UNKNOWN'}]: ${e.message}`);
    process.exit(e.exitCode ?? 2);
  }
}

main();
