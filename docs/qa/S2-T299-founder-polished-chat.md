# S2-T299 Founder polished Companion / Chat

This development-only pre-login route renders the branded Lumis Talk experience. The narrow control band is deliberately outside product pixels. It selects language and one deterministic local response state; the Talk surface contains customer-facing UI only.

## Founder path

1. Start the browser, Simulator, or Expo Go launcher below.
2. In the external band choose English or Traditional Chinese and Reply, Safety, or Fallback.
3. In the product surface type one prompt and press the sunrise send button.
4. Confirm the prompt appears, the reflecting state is visible, and the selected response appears.
5. For Fallback, confirm the exact approved fallback and use Retry. For Safety, confirm the exact approved safety redirect.
6. Enlarge text and open the keyboard. The transcript remains scrollable and the composer remains reachable.

```sh
pnpm start:s2-t299-founder-chat-web       # http://localhost:8171
pnpm start:s2-t299-founder-chat-simulator # Metro 8172
pnpm start:s2-t299-founder-chat-expo      # Expo Go LAN, Metro 8173
```

All responses are deterministic local fixtures. The route cannot call a provider, normal `chat-message`, Supabase, member context, threads/messages, units, or persistence. Future live eligibility remains blocked until accepted Dice Technical evidence and separate Microsoft Chat authority are compiled into source.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`
