"use client";

import { RecordActionButton } from "@/components/record-action-button";
import { linkToCustomerAction, createCustomerFromEnquiryAction } from "../actions";

export function LinkToCustomerButton({ enquiryId, customerId }: { enquiryId: string; customerId: string }) {
  return (
    <RecordActionButton
      label="Link"
      pendingLabel="Linking…"
      variant="outline"
      size="sm"
      action={() => linkToCustomerAction(enquiryId, customerId)}
    />
  );
}

export function ConvertToCustomerButton({ enquiryId, label }: { enquiryId: string; label: string }) {
  return (
    <RecordActionButton
      label={label}
      pendingLabel="Converting…"
      variant="default"
      size="sm"
      fullWidth
      action={() => createCustomerFromEnquiryAction(enquiryId)}
    />
  );
}
