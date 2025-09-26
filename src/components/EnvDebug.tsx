export default function EnvDebug() {
  const env = {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_BASE_URL: process.env.NEXT_PUBLIC_CLERK_BASE_URL,
    CLERK_HOSTED_URL: process.env.NEXT_PUBLIC_CLERK_HOSTED_URL,
    CLERK_CLIENT_ID: process.env.NEXT_PUBLIC_CLERK_CLIENT_ID,
    SESSION_ENABLED: process.env.NEXT_PUBLIC_SUPABASE_SESSION_ENABLED,
  };

  return (
    <div className="p-4 border rounded bg-gray-50 dark:bg-zinc-900" dir="rtl">
      <h3 className="font-semibold mb-2">دیباگ متغیرهای محیطی</h3>
      <div className="space-y-1 text-sm">
        {Object.entries(env).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="font-mono">{key}:</span>
            <span className={value ? "text-green-600" : "text-red-600"}>
              {value ? `${value.slice(0, 20)}...` : "NOT SET"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
