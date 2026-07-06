"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { stopSmsAction, resubscribeAction } from "./actions";

export function UnsubscribeActions({
  token,
  hasSms,
  smsSubscribed,
}: {
  token: string;
  hasSms: boolean;
  smsSubscribed: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [smsStopped, setSmsStopped] = useState(!smsSubscribed);
  const [resubscribed, setResubscribed] = useState(false);

  if (resubscribed) {
    return (
      <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
        You&apos;re re-subscribed to marketing emails — welcome back!
      </p>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      {hasSms && !smsStopped && (
        <div>
          <p className="text-sm">Want to stop text message reminders too?</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await stopSmsAction(token);
                setSmsStopped(true);
              })
            }
          >
            Also stop SMS
          </Button>
        </div>
      )}
      {hasSms && smsStopped && <p className="text-xs text-muted-foreground">SMS reminders are stopped too.</p>}

      <div className="border-t pt-4">
        <p className="text-sm">Changed your mind?</p>
        <Button
          size="sm"
          className="mt-2"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await resubscribeAction(token);
              setResubscribed(true);
            })
          }
        >
          Re-subscribe to marketing emails
        </Button>
      </div>
    </div>
  );
}
