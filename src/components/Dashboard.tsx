import React from "react";
import { ServiceManager } from "./ServiceManager";
 

export const Dashboard: React.FC = () => {
  

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">داشبورد</h1>
        <p className="text-sm text-gray-600 dark:text-zinc-300">پنل وضعیت و اقدامات سریع</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <ServiceManager />
      </div>
    </div>
  );
};
