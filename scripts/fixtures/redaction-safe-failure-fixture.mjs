import {
  runRedactedEvidenceMain,
  safeCheck
} from "../lib/redaction-safe-evidence.mjs";

const mode = process.argv[2];
const sensitive = {
  pairingCode: "PAIR-RAW-7X9Q",
  fingerprint: "fingerprint-private-44f9",
  userId: "82acfd0a-7e5b-4ccb-a8fb-d61152adc475",
  email: "fixture-private@example.invalid",
  token: "token-private-7dce",
  responseBody: "{\"private\":\"database-payload\"}",
  ciphertext: "ciphertext-private-77aa"
};

await runRedactedEvidenceMain(
  {
    getRunId: () => "1785000000000-acde1234",
    boundaryCheck: "fixture_boundary",
    boundaryCode: "FIXTURE_INTERNAL_FAILURE"
  },
  async () => {
    if (mode === "care") {
      const replayedCode = `${sensitive.pairingCode}-mismatch`;
      safeCheck(
        replayedCode === sensitive.pairingCode,
        "pairing_code_replay",
        "CARE_PAIRING_CODE_MISMATCH"
      );
      return;
    }

    if (mode === "notification") {
      safeCheck(
        sensitive.ciphertext === sensitive.token
          && sensitive.fingerprint === sensitive.token,
        "notification_encryption",
        "NOTIFICATION_ENCRYPTION_MISMATCH"
      );
      return;
    }

    throw new Error(Object.values(sensitive).join("|"));
  }
);
