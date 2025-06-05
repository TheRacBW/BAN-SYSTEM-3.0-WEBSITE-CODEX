import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Heart } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-8 py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              © 2025 Meta Guardian. All rights reserved.
            </p>
          </div>
          
          <div className="flex items-center space-x-6">
            <Link 
              to="/faq" 
              className="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 text-sm"
            >
              FAQ
            </Link>
            
            <Link 
              to="/contact" 
              className="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 text-sm"
            >
              Contact
            </Link>

            <Link 
              to="/donate" 
              className="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 text-sm"
            >
              Donate
            </Link>
            
            <a 
              href="https://github.com/TheRaccoonMolester" 
              className="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              aria-label="GitHub"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={20} />
            </a>
            
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <span className="text-sm mr-1">Made with</span>
              <Heart size={16} className="text-red-500 mx-1" />
              <span className="text-sm">by TheRac</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;