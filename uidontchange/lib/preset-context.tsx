import React, { createContext, useContext, useState, useEffect } from 'react';
import { DEFAULT_PRESETS } from './default-presets';

export interface ShotPreset {
  id: string;
  name: string;
  distance: number;
  height: number;
  spin: number;
  launchAngle: number;
  windSpeed?: number;
  windDirection?: number;
  clubType?: string;
}

interface PresetContextType {
  presets: ShotPreset[];
  activePreset: ShotPreset | null;
  addPreset: (preset: Omit<ShotPreset, 'id'>) => void;
  removePreset: (id: string) => void;
  setActivePreset: (preset: ShotPreset | null) => void;
  updatePreset: (id: string, updates: Partial<ShotPreset>) => void;
}

const PresetContext = createContext<PresetContextType | undefined>(undefined);

export function PresetProvider({ children }: { children: React.ReactNode }) {
  const [presets, setPresets] = useState<ShotPreset[]>([]);
  const [activePreset, setActivePreset] = useState<ShotPreset | null>(null);

  useEffect(() => {
    const savedPresets = localStorage.getItem('shot-presets');
    if (savedPresets) {
      setPresets(JSON.parse(savedPresets));
    } else {
      setPresets(DEFAULT_PRESETS);
      localStorage.setItem('shot-presets', JSON.stringify(DEFAULT_PRESETS));
    }
  }, []);

  const addPreset = (preset: Omit<ShotPreset, 'id'>) => {
    const newPreset = {
      ...preset,
      id: `preset-${Date.now()}`
    };
    const updatedPresets = [...presets, newPreset];
    setPresets(updatedPresets);
    localStorage.setItem('shot-presets', JSON.stringify(updatedPresets));
  };

  const removePreset = (id: string) => {
    const updatedPresets = presets.filter(p => p.id !== id);
    setPresets(updatedPresets);
    localStorage.setItem('shot-presets', JSON.stringify(updatedPresets));
    if (activePreset?.id === id) {
      setActivePreset(null);
    }
  };

  const updatePreset = (id: string, updates: Partial<ShotPreset>) => {
    const updatedPresets = presets.map(p => 
      p.id === id ? { ...p, ...updates } : p
    );
    setPresets(updatedPresets);
    localStorage.setItem('shot-presets', JSON.stringify(updatedPresets));
    if (activePreset?.id === id) {
      setActivePreset({ ...activePreset, ...updates });
    }
  };

  return (
    <PresetContext.Provider 
      value={{ 
        presets, 
        activePreset, 
        addPreset, 
        removePreset, 
        setActivePreset,
        updatePreset
      }}
    >
      {children}
    </PresetContext.Provider>
  );
}

export function usePresets() {
  const context = useContext(PresetContext);
  if (context === undefined) {
    throw new Error('usePresets must be used within a PresetProvider');
  }
  return context;
}
