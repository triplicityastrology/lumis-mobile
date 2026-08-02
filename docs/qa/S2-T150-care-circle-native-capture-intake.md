# S2-T150 Care Circle native capture intake

Place exactly the 13 native iPhone portrait screenshots below in:

`/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work/.lumis-local/s2-t150-care-circle-native-captures`

Use the filenames from `S2-T145-01-caree-landing.png` through `S2-T145-13-generic-invalid-code.png` exactly as listed in `supabase/tests/s2-t150-care-circle-native-capture-states.json`. Do not add `.DS_Store`, web exports, mockups, cropped images, or additional files.

Run from the repository root:

```bash
pnpm care-circle:native-capture-intake
```

With no captures, the command reports `WAITING_FOR_FOUNDER_NATIVE_CAPTURES` and writes nothing. With a complete valid set, it writes a metadata-only `manifest.json` and non-destructive `contact-sheet.html` under `.lumis-local/s2-t150-care-circle-native-evidence`.

The contact sheet includes the two signed-off screenshots and rejected baseline as comparison references only. It does not alter any image and does not claim visual similarity; Founder/QA must perform that review.
