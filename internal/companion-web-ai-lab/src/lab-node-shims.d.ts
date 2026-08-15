// Minimal Node built-in type shims for the Lab.
// This repository intentionally has no @types/node (it targets React Native + Deno edge
// functions and shims Node built-ins locally, e.g. supabase/functions/chat-synthetic/node-test.d.ts).
// The Lab follows that convention and declares only the small surface it actually uses.

declare module "node:http" {
  export interface IncomingMessage {
    method?: string;
    url?: string;
    on(event: "data", cb: (chunk: Buffer) => void): void;
    on(event: "end", cb: () => void): void;
    destroy(): void;
  }
  export interface ServerResponse {
    writeHead(status: number, headers?: Record<string, string>): void;
    end(data?: string | Buffer): void;
  }
  export interface Server {
    listen(port: number, cb?: () => void): void;
  }
  export function createServer(
    handler: (req: IncomingMessage, res: ServerResponse) => void,
  ): Server;
}

declare module "node:fs/promises" {
  export function readFile(path: string): Promise<Buffer>;
}

declare module "node:path" {
  export function resolve(...parts: string[]): string;
  export function join(...parts: string[]): string;
}

declare module "node:test" {
  export default function test(name: string, fn: () => void | Promise<void>): void;
}

declare module "node:assert" {
  const strict: {
    equal(actual: unknown, expected: unknown, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): void;
    throws(fn: () => unknown, message?: string): void;
  };
  export { strict };
}

declare var process: {
  env: Record<string, string | undefined>;
  stdout: { write(text: string): void };
  argv: string[];
  cwd(): string;
  exit(code?: number): void;
};

declare class Buffer extends Uint8Array {
  static concat(list: Buffer[]): Buffer;
  static from(input: string, encoding?: string): Buffer;
  toString(encoding?: string): string;
}
