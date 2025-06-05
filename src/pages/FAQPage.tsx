import React from 'react';
import { ChevronDown } from 'lucide-react';

const FAQPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Frequently Asked Questions</h1>
      
      <div className="space-y-6">
        <details className="group bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <summary className="flex justify-between items-center p-6 cursor-pointer">
            <h3 className="text-lg font-medium">What is TheRac's Kit Ban Planner?</h3>
            <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-6 pb-6 text-gray-600 dark:text-gray-300">
            TheRac's Kit Ban Planner is a tool designed to help players plan and track kit combinations, taking into account banned kits and providing strategy recommendations.
          </div>
        </details>

        <details className="group bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <summary className="flex justify-between items-center p-6 cursor-pointer">
            <h3 className="text-lg font-medium">How secure is my password?</h3>
            <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-6 pb-6 text-gray-600 dark:text-gray-300">
            Your password is securely encrypted and stored in Supabase.com's infrastructure. We cannot view your password as it is stored using strong encryption. Due to this security measure, we cannot recover lost passwords - if you forget your password, you will need to create a new account.
          </div>
        </details>

        <details className="group bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <summary className="flex justify-between items-center p-6 cursor-pointer">
            <h3 className="text-lg font-medium">How do I create a strategy?</h3>
            <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-6 pb-6 text-gray-600 dark:text-gray-300">
            To create a strategy, sign in to your account and click the "Create Strategy" button. Select 5 kits, give your strategy a name and description, then save it. You can choose to make it public or keep it private.
          </div>
        </details>

        <details className="group bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <summary className="flex justify-between items-center p-6 cursor-pointer">
            <h3 className="text-lg font-medium">How does the ban system work?</h3>
            <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-6 pb-6 text-gray-600 dark:text-gray-300">
            The ban system allows you to simulate kit bans from both teams. Each team can ban up to 2 kits. The system will then show you valid strategies that don't use any of the banned kits.
          </div>
        </details>

        <details className="group bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <summary className="flex justify-between items-center p-6 cursor-pointer">
            <h3 className="text-lg font-medium">What are kit presets?</h3>
            <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-6 pb-6 text-gray-600 dark:text-gray-300">
            Kit presets allow you to save different combinations of owned kits. This is useful if you play on different accounts with different kit collections. You can quickly switch between presets in your dashboard.
          </div>
        </details>
      </div>
    </div>
  );
};

export default FAQPage;