declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

declare module "@supabase/supabase-js" {
  type RpcResponse = Promise<{ data: unknown; error: unknown }>;
  type Client = { rpc(name: string, parameters: Readonly<Record<string, unknown>>): RpcResponse };
  export function createClient(
    url: string,
    key: string,
    options?: Readonly<Record<string, unknown>>,
  ): Client;
}
