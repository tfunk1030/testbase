import React from 'react';
import { usePresets, type ShotPreset } from '@/lib/preset-context';
import { PlusCircle, Save, Trash2 } from 'lucide-react';

export function PresetSelector() {
  const { presets, activePreset, setActivePreset, addPreset, removePreset } = usePresets();
  const [isCreating, setIsCreating] = React.useState(false);
  const [newPresetName, setNewPresetName] = React.useState('');

  const handleCreatePreset = () => {
    if (!activePreset || !newPresetName) return;
    
    const { id, ...presetData } = activePreset;
    addPreset({
      ...presetData,
      name: newPresetName
    });
    setNewPresetName('');
    setIsCreating(false);
  };

  return (
    <div className="space-y-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Shot Presets</h3>
        <button
          onClick={() => setIsCreating(true)}
          className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <PlusCircle className="w-5 h-5" />
        </button>
      </div>

      {isCreating && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            placeholder="Preset name"
            className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          />
          <button
            onClick={handleCreatePreset}
            disabled={!newPresetName}
            className="p-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="space-y-2">
        {presets.map((preset) => (
          <div
            key={preset.id}
            className={`flex items-center justify-between p-3 rounded-md cursor-pointer ${
              activePreset?.id === preset.id
                ? 'bg-blue-100 dark:bg-blue-900'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            onClick={() => setActivePreset(preset)}
          >
            <div>
              <h4 className="font-medium">{preset.name}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {preset.clubType} - {preset.distance}y
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removePreset(preset.id);
              }}
              className="p-1 text-gray-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
