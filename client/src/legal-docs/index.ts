import { privacyPolicyData } from "./privacyPolicyData";
import { termsOfServiceData } from "./termsOfServiceData";
import { schoolServiceAgreementData } from "./schoolServiceAgreementData";
import { dataProcessingAgreementData } from "./dataProcessingAgreementData";
import type { LegalDocument } from "./types";

export * from "./types";
export {
  privacyPolicyData,
  termsOfServiceData,
  schoolServiceAgreementData,
  dataProcessingAgreementData,
};

export const ALL_LEGAL_DOCUMENTS: LegalDocument[] = [
  privacyPolicyData,
  termsOfServiceData,
  schoolServiceAgreementData,
  dataProcessingAgreementData,
];

export function getLegalDocById(id: string): LegalDocument | undefined {
  return ALL_LEGAL_DOCUMENTS.find((doc) => doc.id === id);
}

export function getLegalDocByRoute(routePath: string): LegalDocument | undefined {
  return ALL_LEGAL_DOCUMENTS.find((doc) => doc.routePath === routePath);
}
