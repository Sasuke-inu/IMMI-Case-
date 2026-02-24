import { useMutation } from "@tanstack/react-query";
import { checkLlmCouncilHealth, runLlmCouncil } from "@/lib/api";
import type {
  LlmCouncilHealthResponse,
  LlmCouncilRequest,
  LlmCouncilResponse,
} from "@/lib/api";

export function useLlmCouncil() {
  return useMutation<LlmCouncilResponse, Error, LlmCouncilRequest>({
    mutationFn: runLlmCouncil,
  });
}

export function useLlmCouncilHealthCheck() {
  return useMutation<LlmCouncilHealthResponse, Error, { live: boolean }>({
    mutationFn: ({ live }) => checkLlmCouncilHealth(live),
  });
}
