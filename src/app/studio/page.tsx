"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { ToastNotification, type ToastState } from "@/components/toast-notification";
import { VideoEditor } from "@/components/studio/video-editor";
import { useStudioBatchImages } from "@/components/studio/use-studio-batch-images";
import { useStudioProject } from "@/components/studio/use-studio-project";

export default function StudioEditorPage() {
  const {
    project,
    isLoaded,
    saveStatus,
    setProject,
    updateProject,
    updateClip,
  } = useStudioProject();
  const [toast, setToast] = React.useState<ToastState | null>(null);

  const notify = React.useCallback(
    (message: string, kind: "info" | "error" | "success" = "info") => {
      const id = Date.now();
      setToast({ id, message, kind });
      window.setTimeout(() => {
        setToast((curr) => (curr?.id === id ? null : curr));
      }, 4000);
    },
    [],
  );

  const { batchFileInputRef, handleBatchFileChange, openBatchFileDialog } =
    useStudioBatchImages({
      clips: project.clips,
      setProject,
      notify,
    });

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-editor-chrome text-foreground">
      {!isLoaded ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading your project…
        </div>
      ) : (
        <VideoEditor
          project={project}
          onUpdateProject={updateProject}
          onUpdateClip={updateClip}
          notify={notify}
          onImportImagesClick={openBatchFileDialog}
          saveStatus={saveStatus}
        />
      )}

      <input
        ref={batchFileInputRef}
        type="file"
        multiple
        accept="image/*,video/mp4,video/webm,video/quicktime"
        className="sr-only"
        onChange={handleBatchFileChange}
      />

      <ToastNotification toast={toast} />
    </div>
  );
}
