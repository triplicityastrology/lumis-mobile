# S2-T290 Founder Dice v4 intake and later execution

## Current truth

This is a development-only local authoring and review build. It makes zero provider calls, writes no member data, charges no units, and cannot self-authorize live synthetic execution.

The Founder approved the `lumis_dice_default_off_function_deployment_authorization_v4` **receipt design only**. That approval does not authorize deployment, migration, Azure traffic, normal Chat integration, member data, or public use. Every operational action still requires its own reviewed authorization.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`

## Founder path

1. Open the local build and confirm the full build SHA.
2. Choose English or Traditional Chinese and fill exactly 20 slots in each language.
3. Validate each synthetic customer-style question locally. Names, contact details, birth/account/device data, unsafe requests, bundled questions, and excluded scope stop before freezing.
4. Freeze all 40 questions and download the rating sheet.
5. The next live gate remains blocked until an independently accepted T287 v4 deployment receipt, accepted T289 80-case evidence, and a separate Founder-window authorization are compiled into the reviewed source.
6. During a later authorized window, runtime accepts only `fixture_id`. Question text is never sent by the mobile invocation seam.

## Launchers

Browser, attached on port 8157:

```sh
pnpm start:s2-t290-founder-dice-web
```

iPhone 17 Simulator, Metro 8158:

```sh
pnpm start:s2-t290-founder-dice-simulator
```

Physical iPhone with Expo Go over LAN, Metro 8159:

```sh
pnpm start:s2-t290-founder-dice-expo
```

The launchers refuse a dirty tracked tree, wrong branch, occupied port, or missing exact build marker. They never kill another process.

## Rollback

```sh
git revert <S2-T290-commit>
```
