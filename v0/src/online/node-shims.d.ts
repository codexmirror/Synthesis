declare module 'node:crypto' {
  export function randomUUID(): string
  export function randomBytes(size: number): { toString(encoding: string): string }
  export function scryptSync(password: string, salt: unknown, length: number): Buffer
  export function timingSafeEqual(a: unknown, b: unknown): boolean
  export function createHash(name: string): { update(value: string): { digest(encoding: string): string } }
}
declare module 'node:fs/promises' { export function mkdir(path: string, options?: unknown): Promise<void>; export function readFile(path: string, encoding: string): Promise<string>; export function rename(from: string, to: string): Promise<void>; export function writeFile(path: string, data: string, options?: unknown): Promise<void> }
declare module 'node:path' { export function dirname(path: string): string; export function join(...paths: string[]): string }
declare module 'node:fs/promises' { export function mkdtemp(path: string): Promise<string>; export function rm(path: string, options?: unknown): Promise<void> }
declare module 'node:os' { export function tmpdir(): string }
declare class Buffer { static from(value: string, encoding: string): Buffer; readonly length: number; toString(encoding: string): string }
declare namespace NodeJS { interface ErrnoException extends Error { code?: string } }
declare const process: { pid: number; env?: Record<string, string | undefined> }
