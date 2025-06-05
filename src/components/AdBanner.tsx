import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AdSettings {
  enabled: boolean;
  ad_type: 'google' | 'custom';
  ad_client: string;
  ad_slot: string;
}

interface CustomAd {
  id: string;
  name: string;
  image_url: string;
  link_url: string;
  weight: number;
}

const AdBanner: React.FC = () => {
  const [settings, setSettings] = useState<AdSettings | null>(null);
  const [customAds, setCustomAds] = useState<CustomAd[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: settingsData } = await supabase
        .from('ad_settings')
        .select('*')
        .eq('id', 'global')
        .single();

      if (settingsData) {
        setSettings(settingsData);

        if (settingsData.ad_type === 'custom') {
          const { data: adsData } = await supabase
            .from('custom_ads')
            .select('*')
            .eq('enabled', true);

          if (adsData) {
            setCustomAds(adsData);
          }
        }
      }
    };

    fetchSettings();

    // Subscribe to changes
    const subscription = supabase
      .channel('ad_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'ad_settings',
          filter: 'id=eq.global'
        }, 
        () => {
          fetchSettings();
        }
      )
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'custom_ads'
        },
        () => {
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (settings?.ad_type === 'custom' && customAds.length > 0) {
      // Rotate ads every 10 seconds
      const interval = setInterval(() => {
        setCurrentAdIndex((prev) => (prev + 1) % customAds.length);
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [settings?.ad_type, customAds]);

  useEffect(() => {
    if (settings?.enabled && settings.ad_type === 'google' && settings.ad_client && settings.ad_slot) {
      // Load Google AdSense script
      const script = document.createElement('script');
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);

      return () => {
        document.head.removeChild(script);
      };
    }
  }, [settings]);

  if (!settings?.enabled) {
    return null;
  }

  if (settings.ad_type === 'custom' && customAds.length > 0) {
    const currentAd = customAds[currentAdIndex];
    return (
      <div className="w-full flex justify-center my-4">
        <a
          href={currentAd.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block max-w-4xl w-full"
        >
          <img
            src={currentAd.image_url}
            alt={currentAd.name}
            className="w-full h-auto rounded-lg shadow-md"
          />
        </a>
      </div>
    );
  }

  if (settings.ad_type === 'google' && settings.ad_client && settings.ad_slot) {
    return (
      <div className="w-full flex justify-center my-4">
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={settings.ad_client}
          data-ad-slot={settings.ad_slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  return null;
};

export default AdBanner;