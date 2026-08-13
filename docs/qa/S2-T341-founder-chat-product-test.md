# Founder Chat product check

1. From the T341 SSD worktree, run `pnpm start:s2-t341-chat-product -- --simulator` or replace the final option with `--lan` for Expo Go.
2. Confirm the terminal marker says `route=real-chat-product`, `mode=local_fixture`, `live_authority=false`, `persistence=false`, and `units=false`.
3. The app opens the normal branded Talk screen directly. No fixture dashboard or state label appears inside product pixels.
4. Enter an English or Traditional Chinese reflection and press Send. Confirm the existing reflecting indicator appears, followed by the response in the existing assistant bubble.
5. Restart with `T341_CHAT_FIXTURE_STATE=fallback`, `safety`, or `technical_error` to review the existing fallback/safety/retry surfaces.
6. For Dice handoff, press `Reflect in Chat` from an interpretation result. Confirm Chat opens with a draft and makes no request until Send is pressed.

Local mode is synthetic and zero-network. It proves presentation and integration wiring only. Live Chat remains blocked pending accepted Dice evidence plus separate Chat integration, deployment, and traffic authority.
