# S2-T312 closed Dice Founder registry

The mobile adapter now resolves `fixture_id` through the checksum-sealed 40-record Founder registry before transport construction. A matching shape is not authority. The submitted question must also equal the selected record byte-for-byte.

The registry contains exactly 20 English and 20 Traditional Chinese entries. It excludes only `ZH04` (`我去到澳洲應該讀書定係做嘢？`). `ZH08` remains the bundled-question rejection fixture; `ZH09` remains the accepted single-question control.

Run `pnpm test:s2-t312-closed-dice-registry`. This compiles and executes the mobile fixtures, checks the T302 and T307 source contracts, then validates the T312 seal. No network client or provider is constructed.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`
