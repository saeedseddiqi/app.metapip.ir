import ScreenshotPresetsPanel from "@/components/ScreenshotPresetsPanel";

export default function ScreenshotPresetsPage() {
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">مدیریت پریست‌های اسکرین‌شات</h1>
        <p className="text-gray-600 dark:text-gray-400">
          در این بخش می‌توانید تنظیمات ذخیره شده برای اسکرین‌شات‌ها را مدیریت کنید.
        </p>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-2">
        <ScreenshotPresetsPanel />
      </div>
    </div>
  );
}
