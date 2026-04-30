import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

export default async function SignInPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-50 to-white px-4">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full text-center">

        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-100 border border-yellow-200 shadow-sm">
          <Sparkles size={26} className="text-amber-500" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Sign in</h1>
          <p className="mt-1 text-sm text-neutral-500">to continue to Smart Whiteboard</p>
        </div>

        <div className="w-full rounded-2xl border border-yellow-200 bg-white shadow-sm p-6 space-y-4">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 hover:shadow-md transition-all"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </form>
        </div>

        <p className="text-xs text-neutral-400">
          By signing in you agree to our terms and privacy policy.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96l3.007 2.332C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}
