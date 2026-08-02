import {
  shouldRetryStartupAccountError,
  shouldRetryStartupAuthStatus,
  startupRetryDelay,
} from "./startupRestorePolicy";

check(shouldRetryStartupAuthStatus({ isConfigured: true, user: null }, 0), "delayed session hydration retries");
check(!shouldRetryStartupAuthStatus({ isConfigured: true, user: null }, 3), "genuine signed out becomes terminal");
check(!shouldRetryStartupAuthStatus({ isConfigured: false, user: null }, 0), "configuration failure does not retry");
check(shouldRetryStartupAccountError({ code: "ACCOUNT_DATA_TEMPORARILY_UNAVAILABLE" }, 0), "network retry");
check(!shouldRetryStartupAccountError({ code: "ACCOUNT_DATA_INCOMPLETE" }, 1), "confirmed incomplete account does not retry");
check(!shouldRetryStartupAccountError({ code: "ACCOUNT_AUTH_REQUIRED" }, 0), "auth failure terminal");
check(!shouldRetryStartupAccountError({ code: "ACCOUNT_DATA_TEMPORARILY_UNAVAILABLE" }, 3), "bounded terminal failure");
check(startupRetryDelay(0) === 600 && startupRetryDelay(2) === 1800, "bounded delays");
console.log("startup restoration policy fixtures passed");

function check(value: boolean, label: string) { if (!value) throw new Error(label); }
