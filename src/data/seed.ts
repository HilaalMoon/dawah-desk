import {
  ActiveCaseTab,
  CaseRecord,
  ResponseBite,
  SaveMetadataSuggestion,
  SourceItem,
} from "@/types";

export const sourceItems: SourceItem[] = [];

export const responseBites: ResponseBite[] = [];

export const savedCases: CaseRecord[] = [];

export const activeCaseTabs: ActiveCaseTab[] = [];

export const recurringTopics: string[] = [];

export const saveMetadataSuggestions: Record<string, SaveMetadataSuggestion> = {};
