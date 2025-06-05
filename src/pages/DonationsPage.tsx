import React from 'react';
import { DollarSign, Bitcoin, Gift, Youtube } from 'lucide-react';

const DonationsPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-4">Support the Project</h1>
      
      <p className="text-gray-600 dark:text-gray-300 mb-8">
        While you're not obligated to donate, I would greatly appreciate any contributions towards the progress and improvements of all projects.
      </p>
      
      <div className="space-y-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-6 h-6 text-green-500" />
            <h2 className="text-xl font-semibold">PayPal</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Support through PayPal for the most direct way to contribute.
          </p>
          <a 
            href="https://streamlabs.com/pigeonmanm/tip"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-500 text-white px-8 py-3 rounded-lg hover:bg-blue-600 transition-colors text-center w-full md:w-auto"
          >
            Donate via PayPal
          </a>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bitcoin className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-semibold">Bitcoin</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Cryptocurrency donations are welcome through our Bitcoin wallet.
          </p>
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg font-mono text-sm break-all">
            bc1qjclyzwdr439kzcmlt0y5yjcn3rdajnsc0jlmga
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <Gift className="w-6 h-6 text-purple-500" />
            <h2 className="text-xl font-semibold">Robux</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Support through Roblox by purchasing these items:
          </p>
          <div className="space-y-4">
            <a 
              href="https://www.roblox.com/catalog/599857742/Raccoon"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-purple-500 text-white px-8 py-3 rounded-lg hover:bg-purple-600 transition-colors text-center"
            >
              Donate 200 Robux
            </a>
            <a 
              href="https://www.roblox.com/catalog/417688847/Mexico"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-purple-500 text-white px-8 py-3 rounded-lg hover:bg-purple-600 transition-colors text-center"
            >
              Donate 5 Robux
            </a>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <Youtube className="w-6 h-6 text-red-500" />
            <h2 className="text-xl font-semibold">YouTube Stream</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Support during live streams through YouTube's donation features.
          </p>
          <a 
            href="https://www.youtube.com/@PigeonManRac"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-red-500 text-white px-8 py-3 rounded-lg hover:bg-red-600 transition-colors text-center w-full md:w-auto"
          >
            Visit YouTube Channel
          </a>
        </div>
      </div>
    </div>
  );
};

export default DonationsPage;