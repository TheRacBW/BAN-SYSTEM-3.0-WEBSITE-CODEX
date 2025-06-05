import React from 'react';
import { Mail, MessageSquare, AlertCircle, Youtube } from 'lucide-react';

const ContactPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Contact Us</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Get in Touch
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Have questions, suggestions, or found a bug? We'd love to hear from you!
        </p>
        
        <div className="space-y-6">
          <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <Mail className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-medium text-green-900 dark:text-green-100">Email</h3>
              <a 
                href="mailto:theracscreationscontact@gmail.com"
                className="text-green-800 dark:text-green-200 hover:underline"
              >
                theracscreationscontact@gmail.com
              </a>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <MessageSquare className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100">Discord</h3>
              <div className="space-y-2">
                <p className="text-blue-800 dark:text-blue-200">
                  Contact me directly on Discord: <span className="font-mono">therac</span>
                </p>
                <p className="text-blue-800 dark:text-blue-200">
                  Or join our Discord server:
                </p>
                <a 
                  href="https://discord.gg/mY2T3sPvZN" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block text-blue-600 dark:text-blue-400 hover:underline"
                >
                  discord.gg/mY2T3sPvZN
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <Youtube className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-medium text-red-900 dark:text-red-100">YouTube Channel</h3>
              <div className="space-y-2">
                <p className="text-red-800 dark:text-red-200">
                  You can catch my livestream here every once and a while:
                </p>
                <a 
                  href="https://www.youtube.com/@PigeonManRac" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block text-red-600 dark:text-red-400 hover:underline"
                >
                  youtube.com/@PigeonManRac
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <AlertCircle className="w-6 h-6 text-purple-500 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-medium text-purple-900 dark:text-purple-100">Bug Reports</h3>
              <p className="text-purple-800 dark:text-purple-200">
                Found a bug? Please report it on our Discord server in the #bug-reports channel.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;