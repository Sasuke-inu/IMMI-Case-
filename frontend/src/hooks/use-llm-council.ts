import { useMutation } from "@tanstack/react-query";
import { runLlmCouncil } from "@/lib/api";
import type { LlmCouncilRequest, LlmCouncilResponse } from "@/lib/api";

export function useLlmCouncil() {
  return useMutation<LlmCouncilResponse, Error, LlmCouncilRequest>({
    mutationFn: runLlmCouncil,
  });
}

