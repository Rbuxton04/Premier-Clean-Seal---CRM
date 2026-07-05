/**
 * Auth helper. Clerk is used when keys are present; otherwise the app runs
 * in OPEN DEV MODE so you can explore the UI before creating a Clerk account.
 */
export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
