import {
  useApplyShapeDayMutation,
  useShapeDayPreviewMutation,
} from "../../../shared/lib/api";

export function useShapeDay(date: string) {
  const previewMutation = useShapeDayPreviewMutation(date);
  const applyMutation = useApplyShapeDayMutation(date);

  return {
    preview: previewMutation.data ?? null,
    previewDay: previewMutation.mutateAsync,
    applyPreview: applyMutation.mutateAsync,
    resetPreview: previewMutation.reset,
    isPreviewing: previewMutation.isPending,
    isApplying: applyMutation.isPending,
    error:
      previewMutation.error instanceof Error
        ? previewMutation.error.message
        : applyMutation.error instanceof Error
          ? applyMutation.error.message
          : null,
  };
}
