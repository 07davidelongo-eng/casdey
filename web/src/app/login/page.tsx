import Link from "next/link";

import { AuthForm } from "@/components/app/auth-form";
import { Wordmark } from "@/components/wordmark";
import { safeNextPath } from "@/lib/safe-redirect";

import "@/styles/product.css";

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;

  const next = safeNextPath(params.next);
  const mode = params.mode === "signup" ? "signup" : "signin";
  const notice = typeof params.error === "string" ? params.error : null;

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-[27rem]">
        <Link
          href="/"
          className="mb-7 inline-block text-ink transition-opacity duration-200 hover:opacity-70"
        >
          <Wordmark className="text-[1.75rem]" />
        </Link>

        {notice ? (
          <p role="alert" className="notice notice-error mb-4">
            {notice}
          </p>
        ) : null}

        <AuthForm initialMode={mode} next={next} />

        <p className="mt-6 text-center text-[0.8125rem] text-stone">
          By continuing you agree to how casdey handles your data, set out in
          the{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            privacy notice
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
