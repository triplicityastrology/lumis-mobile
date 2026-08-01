export const FIXED_TEMPLATE_REGISTRY_VERSION =
  "ai_routing_fixed_template_wording_v0.2" as const;

export type FixedTemplateLanguage = "en" | "zh-Hant";
export type FixedTemplateFamilyId =
  | "ROUTER_UNAVAILABLE"
  | "ROUTE_UNAVAILABLE"
  | "OUT_OF_SCOPE"
  | "OUT_OF_SCOPE_SOLAR_RETURN"
  | "PROFESSIONAL_BOUNDARY"
  | "PROFESSIONAL_REFLECTIVE_DISCLAIMER"
  | "CRISIS_IMMINENT"
  | "DISTRESS_SAFETY_CHECK"
  | "ILLEGAL_BOUNDARY";

export type FixedTemplateFailureCode =
  | "FIXED_TEMPLATE_VERSION_UNKNOWN"
  | "FIXED_TEMPLATE_ID_UNKNOWN"
  | "FIXED_TEMPLATE_LANGUAGE_UNKNOWN"
  | "FIXED_TEMPLATE_RUNTIME_UNKNOWN"
  | "FIXED_TEMPLATE_PRODUCTION_WORDING_REQUIRED"
  | "FIXED_TEMPLATE_CLINICAL_REVIEW_REQUIRED";

type ControlledStatus =
  | "founder_approved_fixed_wording"
  | "provisional_production_wording_pending"
  | "provisional_clinical_review_required";

type RegistryRecord = {
  status: ControlledStatus;
  clinicalReviewRequired: boolean;
  templates: Record<
    FixedTemplateLanguage,
    { templateId: string; text: string }
  >;
};

export type FixedTemplateLookup = {
  registryVersion: typeof FIXED_TEMPLATE_REGISTRY_VERSION;
  familyId: FixedTemplateFamilyId;
  language?: FixedTemplateLanguage;
  runtime: "development" | "staging" | "production";
};

export type FixedTemplateLookupResult =
  | {
      ok: true;
      value: {
        registryVersion: typeof FIXED_TEMPLATE_REGISTRY_VERSION;
        familyId: FixedTemplateFamilyId;
        templateId: string;
        language: FixedTemplateLanguage;
        text: string;
        status: ControlledStatus;
        languageFallbackApplied: boolean;
        generated: false;
      };
    }
  | { ok: false; error: { code: FixedTemplateFailureCode } };

const REGISTRY: Record<FixedTemplateFamilyId, RegistryRecord> = {
  ROUTER_UNAVAILABLE: {
    status: "founder_approved_fixed_wording",
    clinicalReviewRequired: false,
    templates: {
      en: {
        templateId: "ROUTER_UNAVAILABLE_EN",
        text: "I am temporarily unable to process that message. Please try again shortly.",
      },
      "zh-Hant": {
        templateId: "ROUTER_UNAVAILABLE_ZH_HANT",
        text: "我暫時未能正確理解這則訊息，請稍後再試一次。",
      },
    },
  },
  ROUTE_UNAVAILABLE: {
    status: "provisional_production_wording_pending",
    clinicalReviewRequired: false,
    templates: {
      en: {
        templateId: "ROUTE_UNAVAILABLE_EN",
        text: "That Lumis feature is not available right now. Please try again later.",
      },
      "zh-Hant": {
        templateId: "ROUTE_UNAVAILABLE_ZH_HANT",
        text: "這項 Lumis 功能目前未能使用，請稍後再試。",
      },
    },
  },
  OUT_OF_SCOPE: {
    status: "provisional_production_wording_pending",
    clinicalReviewRequired: false,
    templates: {
      en: {
        templateId: "OUT_OF_SCOPE_EN",
        text: "That request is outside Lumis's scope. I can help you reflect on the feelings or decision around it, without presenting the excluded service as something Lumis provides.",
      },
      "zh-Hant": {
        templateId: "OUT_OF_SCOPE_ZH_HANT",
        text: "這項要求不屬於 Lumis 的服務範圍。我可以陪你整理相關的感受或抉擇，但不會把不屬於 Lumis 的服務當作可提供的功能。",
      },
    },
  },
  OUT_OF_SCOPE_SOLAR_RETURN: {
    status: "founder_approved_fixed_wording",
    clinicalReviewRequired: false,
    templates: {
      en: {
        templateId: "OUT_OF_SCOPE_SOLAR_RETURN_EN",
        text: "Solar Return is not part of Lumis.",
      },
      "zh-Hant": {
        templateId: "OUT_OF_SCOPE_SOLAR_RETURN_ZH_HANT",
        text: "Solar Return 不屬於 Lumis 的服務範圍。",
      },
    },
  },
  PROFESSIONAL_BOUNDARY: {
    status: "provisional_production_wording_pending",
    clinicalReviewRequired: false,
    templates: {
      en: {
        templateId: "PROFESSIONAL_BOUNDARY_EN",
        text: "Lumis cannot diagnose, prescribe, or guarantee legal or financial outcomes. Please consult a qualified professional. I can help you organise questions to bring to them, but I will not provide a diagnosis, treatment instruction, legal advice, or financial guarantee.",
      },
      "zh-Hant": {
        templateId: "PROFESSIONAL_BOUNDARY_ZH_HANT",
        text: "Lumis 不能作出診斷、處方，亦不能保證法律或財務結果。請諮詢合資格的專業人士。我可以協助你整理需要向專業人士提出的問題，但不會提供診斷、治療指示、法律意見或財務保證。",
      },
    },
  },
  PROFESSIONAL_REFLECTIVE_DISCLAIMER: {
    status: "provisional_production_wording_pending",
    clinicalReviewRequired: false,
    templates: {
      en: {
        templateId: "PROFESSIONAL_REFLECTIVE_DISCLAIMER_EN",
        text: "This is a non-authoritative reflection, not medical, legal, or financial advice. For decisions that affect your health, rights, or money, please consult a qualified professional.",
      },
      "zh-Hant": {
        templateId: "PROFESSIONAL_REFLECTIVE_DISCLAIMER_ZH_HANT",
        text: "以下內容只屬非權威性的反思，並非醫療、法律或財務意見。如決定涉及你的健康、權利或金錢，請諮詢合資格的專業人士。",
      },
    },
  },
  CRISIS_IMMINENT: {
    status: "provisional_clinical_review_required",
    clinicalReviewRequired: true,
    templates: {
      en: {
        templateId: "CRISIS_IMMINENT_EN",
        text: "I am really sorry you are going through this. Your immediate safety matters more than this conversation. Please contact local emergency services or a crisis support service now, and tell someone you trust that you need help. If you can, move away from anything you could use to hurt yourself and stay with another person. Lumis will not continue with astrology while there may be immediate danger.",
      },
      "zh-Hant": {
        templateId: "CRISIS_IMMINENT_ZH_HANT",
        text: "很抱歉你正承受這些痛苦。你此刻的安全比這段對話更重要。請立即聯絡當地緊急服務或危機支援服務，並告訴一位你信任的人你需要協助。如情況許可，請遠離任何可能用來傷害自己的物品，並與其他人留在一起。在可能有即時危險的情況下，Lumis 不會繼續提供占星內容。",
      },
    },
  },
  DISTRESS_SAFETY_CHECK: {
    status: "provisional_clinical_review_required",
    clinicalReviewRequired: true,
    templates: {
      en: {
        templateId: "DISTRESS_SAFETY_CHECK_EN",
        text: "I am here with you. Before we continue, are you in immediate danger or thinking about hurting yourself right now?",
      },
      "zh-Hant": {
        templateId: "DISTRESS_SAFETY_CHECK_ZH_HANT",
        text: "我會陪你一起面對。在繼續之前，我想直接確認：你現在是否有即時危險，或正想着傷害自己？",
      },
    },
  },
  ILLEGAL_BOUNDARY: {
    status: "provisional_production_wording_pending",
    clinicalReviewRequired: false,
    templates: {
      en: {
        templateId: "ILLEGAL_BOUNDARY_EN",
        text: "I cannot help plan or carry out harm or illegal activity. I can help you step back, reduce risk, or find a lawful and safer next step.",
      },
      "zh-Hant": {
        templateId: "ILLEGAL_BOUNDARY_ZH_HANT",
        text: "我不能協助策劃或進行傷害他人或違法的行為。我可以協助你停下來、降低風險，或尋找合法且較安全的下一步。",
      },
    },
  },
};

export function loadFixedTemplate(
  lookup: FixedTemplateLookup | Record<string, unknown>
): FixedTemplateLookupResult {
  if (lookup.registryVersion !== FIXED_TEMPLATE_REGISTRY_VERSION) {
    return failure("FIXED_TEMPLATE_VERSION_UNKNOWN");
  }
  if (
    typeof lookup.familyId !== "string" ||
    !Object.prototype.hasOwnProperty.call(REGISTRY, lookup.familyId)
  ) {
    return failure("FIXED_TEMPLATE_ID_UNKNOWN");
  }
  if (
    lookup.language !== undefined &&
    lookup.language !== "en" &&
    lookup.language !== "zh-Hant"
  ) {
    return failure("FIXED_TEMPLATE_LANGUAGE_UNKNOWN");
  }
  if (
    lookup.runtime !== "development" &&
    lookup.runtime !== "staging" &&
    lookup.runtime !== "production"
  ) {
    return failure("FIXED_TEMPLATE_RUNTIME_UNKNOWN");
  }

  const familyId = lookup.familyId as FixedTemplateFamilyId;
  const record = REGISTRY[familyId];
  if (lookup.runtime === "production") {
    if (record.clinicalReviewRequired) {
      return failure("FIXED_TEMPLATE_CLINICAL_REVIEW_REQUIRED");
    }
    if (record.status !== "founder_approved_fixed_wording") {
      return failure("FIXED_TEMPLATE_PRODUCTION_WORDING_REQUIRED");
    }
  }

  const language = (lookup.language ?? "en") as FixedTemplateLanguage;
  const template = record.templates[language];
  return {
    ok: true,
    value: {
      registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION,
      familyId,
      templateId: template.templateId,
      language,
      text: template.text,
      status: record.status,
      languageFallbackApplied: lookup.language === undefined,
      generated: false,
    },
  };
}

function failure(code: FixedTemplateFailureCode): FixedTemplateLookupResult {
  return { ok: false, error: { code } };
}
