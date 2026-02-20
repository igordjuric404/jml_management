"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  variant?: "default" | "destructive";
  confirmLabel?: string;
  onConfirm: () => void;
}

const defaultState: ConfirmDialogState = {
  open: false,
  title: "",
  description: "",
  onConfirm: () => {},
};

let globalSetState: React.Dispatch<React.SetStateAction<ConfirmDialogState>> | null = null;

export function confirmAction(opts: {
  title: string;
  description: string;
  variant?: "default" | "destructive";
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  if (globalSetState) {
    globalSetState({
      open: true,
      title: opts.title,
      description: opts.description,
      variant: opts.variant ?? "destructive",
      confirmLabel: opts.confirmLabel ?? "Confirm",
      onConfirm: opts.onConfirm,
    });
  }
}

export function ConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>(defaultState);
  globalSetState = setState;

  const handleClose = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    state.onConfirm();
    setState((s) => ({ ...s, open: false }));
  }, [state]);

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          <DialogDescription>{state.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant={state.variant ?? "destructive"}
            onClick={handleConfirm}
          >
            {state.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
