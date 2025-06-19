import React, { useState, useEffect, useCallback } from 'react';
import { Save, Palette, RefreshCw, EyeIcon } from 'lucide-react';
import { useUiSettings } from '../hooks/useUiSettings';

interface ColorCustomizerProps {
  isAdmin: boolean;
}

interface ColorState {
  headerBg: string;
  contentBg: string;
  accentColor: string;
  secondaryAccent: string;
  songBorderColor: string;
  navBgColor: string;
  highlightColor: string;
}

export function ColorCustomizer({ isAdmin }: ColorCustomizerProps) {
  const { settings, updateSettings } = useUiSettings();
  const [colors, setColors] = useState<ColorState>({
    headerBg: '#13091f',
    contentBg: '#0f051d', 
    accentColor: '#ff00ff',
    secondaryAccent: '#9d00ff',
    songBorderColor: '#ff00ff',
    navBgColor: '#0f051d',
    highlightColor: '#ff00ff'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Initialize colors from settings
  useEffect(() => {
    if (settings) {
      setColors({
        headerBg: settings.frontend_header_bg || '#13091f',
        contentBg: settings.frontend_bg_color || '#0f051d',
        accentColor: settings.frontend_accent_color || '#ff00ff',
        secondaryAccent: settings.frontend_secondary_accent || '#9d00ff',
        songBorderColor: settings.song_border_color || settings.frontend_accent_color || '#ff00ff',
        navBgColor: settings.nav_bg_color || '#0f051d',
        highlightColor: settings.highlight_color || '#ff00ff'
      });
    }
  }, [settings]);

  // Preview changes in real-time
  const handleColorChange = useCallback((key: keyof ColorState, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
    
    const root = document.documentElement;
    
    switch(key) {
      case 'headerBg':
        root.style.setProperty('--frontend-header-bg', value);
        break;
      case 'contentBg':
        root.style.setProperty('--frontend-bg-color', value);
        break;
      case 'accentColor':
        root.style.setProperty('--frontend-accent-color', value);
        root.style.setProperty('--neon-pink', value);
        break;
      case 'secondaryAccent':
        root.style.setProperty('--frontend-secondary-accent', value);
        root.style.setProperty('--neon-purple', value);
        break;
      case 'songBorderColor':
        root.style.setProperty('--song-border-color', value);
        break;
      case 'navBgColor':
        root.style.setProperty('--nav-bg-color', value);
        break;
      case 'highlightColor':
        root.style.setProperty('--highlight-color', value);
        break;
    }
  }, []);

  const handleSave = async () => {
    if (!isAdmin) return;
    
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      await updateSettings({
        frontend_header_bg: colors.headerBg,
        frontend_bg_color: colors.contentBg,
        frontend_accent_color: colors.accentColor,
        frontend_secondary_accent: colors.secondaryAccent,
        song_border_color: colors.songBorderColor,
        nav_bg_color: colors.navBgColor,
        highlight_color: colors.highlightColor,
        updated_at: new Date().toISOString()
      });
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving colors:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    const defaults = {
      headerBg: '#13091f',
      contentBg: '#0f051d',
      accentColor: '#ff00ff',
      secondaryAccent: '#9d00ff',
      songBorderColor: '#ff00ff',
      navBgColor: '#0f051d',
      highlightColor: '#ff00ff'
    };
    
    setColors(defaults);
    
    const root = document.documentElement;
    Object.entries(defaults).forEach(([key, value]) => {
      switch(key) {
        case 'headerBg':
          root.style.setProperty('--frontend-header-bg', value);
          break;
        case 'contentBg':
          root.style.setProperty('--frontend-bg-color', value);
          break;
        case 'accentColor':
          root.style.setProperty('--frontend-accent-color', value);
          root.style.setProperty('--neon-pink', value);
          break;
        case 'secondaryAccent':
          root.style.setProperty('--frontend-secondary-accent', value);
          root.style.setProperty('--neon-purple', value);
          break;
        case 'songBorderColor':
          root.style.setProperty('--song-border-color', value);
          break;
        case 'navBgColor':
          root.style.setProperty('--nav-bg-color', value);
          break;
        case 'highlightColor':
          root.style.setProperty('--highlight-color', value);
          break;
      }
    });
  };

  if (!isAdmin) return null;

  return (
    <div className="glass-effect rounded-lg p-4 mb-4">
      <h3 className="text-sm font-medium text-white mb-2 flex items-center justify-between">
        <div className="flex items-center">
          <Palette className="w-4 h-4 mr-1" />
          Front-end Colors
        </div>
        <button 
          onClick={() => setShowPreview(!showPreview)} 
          className="text-xs bg-neon-purple/20 hover:bg-neon-purple/30 text-neon-pink px-2 py-1 rounded flex items-center"
        >
          <EyeIcon className="w-3 h-3 mr-1" />
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
      </h3>
      
      {showPreview && (
        <div className="p-3 mb-4 rounded-lg overflow-hidden" style={{ backgroundColor: colors.headerBg }}>
          <div className="flex items-center justify-between text-white mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-gray-300"></div>
              <span>Header Preview</span>
            </div>
          </div>
          
          <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: colors.contentBg }}>
            <div className="flex justify-between items-center mb-2">
              <div className="text-white">Content Area</div>
              <button 
                style={{ backgroundColor: colors.accentColor, color: 'white' }}
                className="px-3 py-1 rounded-md text-sm"
              >
                Accent Button
              </button>
            </div>
            <div className="mt-2 p-2 rounded-md" style={{ backgroundColor: `${colors.secondaryAccent}30` }}>
              <div className="text-white text-sm">Secondary Accent Background</div>
            </div>
            
            <div className="mt-4 p-2 rounded-lg" 
              style={{ 
                background: 'rgba(26, 11, 46, 0.3)',
                border: `2px solid ${colors.songBorderColor}`,
                boxShadow: `0 0 8px ${colors.songBorderColor}50`
              }}
            >
              <div className="text-white text-sm">Song Item with Custom Border</div>
            </div>

            <div className="mt-4 p-2 rounded-lg" 
              style={{ 
                backgroundColor: colors.navBgColor,
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className="flex justify-between items-center">
                <div className="text-white text-sm">Navigation Bar</div>
                <div 
                  style={{ color: colors.highlightColor }}
                  className="text-sm"
                >
                  Highlight Text
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Header Background
          </label>
          <div className="flex items-center space-x-2">
            <div className="color-picker-container w-10 h-10 border border-gray-500 rounded overflow-hidden">
              <input
                type="color"
                value={colors.headerBg}
                onChange={(e) => handleColorChange('headerBg', e.target.value)}
                className="w-full h-full cursor-pointer"
                style={{ margin: '-5px', padding: 0, width: 'calc(100% + 10px)', height: 'calc(100% + 10px)' }}
              />
            </div>
            <input
              type="text"
              value={colors.headerBg}
              onChange={(e) => handleColorChange('headerBg', e.target.value)}
              className="input-field text-sm py-1 px-2 h-8 text-gray-800"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Content Background
          </label>
          <div className="flex items-center space-x-2">
            <div className="color-picker-container w-10 h-10 border border-gray-500 rounded overflow-hidden">
              <input
                type="color"
                value={colors.contentBg}
                onChange={(e) => handleColorChange('contentBg', e.target.value)}
                className="w-full h-full cursor-pointer"
                style={{ margin: '-5px', padding: 0, width: 'calc(100% + 10px)', height: 'calc(100% + 10px)' }}
              />
            </div>
            <input
              type="text"
              value={colors.contentBg}
              onChange={(e) => handleColorChange('contentBg', e.target.value)}
              className="input-field text-sm py-1 px-2 h-8 text-gray-800"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Accent Color
          </label>
          <div className="flex items-center space-x-2">
            <div className="color-picker-container w-10 h-10 border border-gray-500 rounded overflow-hidden">
              <input
                type="color"
                value={colors.accentColor}
                onChange={(e) => handleColorChange('accentColor', e.target.value)}
                className="w-full h-full cursor-pointer"
                style={{ margin: '-5px', padding: 0, width: 'calc(100% + 10px)', height: 'calc(100% + 10px)' }}
              />
            </div>
            <input
              type="text"
              value={colors.accentColor}
              onChange={(e) => handleColorChange('accentColor', e.target.value)}
              className="input-field text-sm py-1 px-2 h-8 text-gray-800"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Secondary Accent
          </label>
          <div className="flex items-center space-x-2">
            <div className="color-picker-container w-10 h-10 border border-gray-500 rounded overflow-hidden">
              <input
                type="color"
                value={colors.secondaryAccent}
                onChange={(e) => handleColorChange('secondaryAccent', e.target.value)}
                className="w-full h-full cursor-pointer"
                style={{ margin: '-5px', padding: 0, width: 'calc(100% + 10px)', height: 'calc(100% + 10px)' }}
              />
            </div>
            <input
              type="text"
              value={colors.secondaryAccent}
              onChange={(e) => handleColorChange('secondaryAccent', e.target.value)}
              className="input-field text-sm py-1 px-2 h-8 text-gray-800"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Song Container Border Color
          </label>
          <div className="flex items-center space-x-2">
            <div className="color-picker-container w-10 h-10 border border-gray-500 rounded overflow-hidden">
              <input
                type="color"
                value={colors.songBorderColor}
                onChange={(e) => handleColorChange('songBorderColor', e.target.value)}
                className="w-full h-full cursor-pointer"
                style={{ margin: '-5px', padding: 0, width: 'calc(100% + 10px)', height: 'calc(100% + 10px)' }}
              />
            </div>
            <input
              type="text"
              value={colors.songBorderColor}
              onChange={(e) => handleColorChange('songBorderColor', e.target.value)}
              className="input-field text-sm py-1 px-2 h-8 text-gray-800"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Navigation Background Color
          </label>
          <div className="flex items-center space-x-2">
            <div className="color-picker-container w-10 h-10 border border-gray-500 rounded overflow-hidden">
              <input
                type="color"
                value={colors.navBgColor}
                onChange={(e) => handleColorChange('navBgColor', e.target.value)}
                className="w-full h-full cursor-pointer"
                style={{ margin: '-5px', padding: 0, width: 'calc(100% + 10px)', height: 'calc(100% + 10px)' }}
              />
            </div>
            <input
              type="text"
              value={colors.navBgColor}
              onChange={(e) => handleColorChange('navBgColor', e.target.value)}
              className="input-field text-sm py-1 px-2 h-8 text-gray-800"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            This color will be used for the profile header and bottom navigation bar
          </p>
        </div>

        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Highlight Color
          </label>
          <div className="flex items-center space-x-2">
            <div className="color-picker-container w-10 h-10 border border-gray-500 rounded overflow-hidden">
              <input
                type="color"
                value={colors.highlightColor}
                onChange={(e) => handleColorChange('highlightColor', e.target.value)}
                className="w-full h-full cursor-pointer"
                style={{ margin: '-5px', padding: 0, width: 'calc(100% + 10px)', height: 'calc(100% + 10px)' }}
              />
            </div>
            <input
              type="text"
              value={colors.highlightColor}
              onChange={(e) => handleColorChange('highlightColor', e.target.value)}
              className="input-field text-sm py-1 px-2 h-8 text-gray-800"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            This color will be used for navigation items, user profile elements, and setting text
          </p>
        </div>
      </div>
      
      <div className="mt-3 pt-2 border-t border-gray-700 flex items-center justify-between">
        <button 
          onClick={resetToDefaults}
          className="text-xs text-gray-400 hover:text-white flex items-center"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Reset to Defaults
        </button>
        
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="text-xs bg-neon-purple/20 hover:bg-neon-purple/30 text-neon-pink px-2 py-1 rounded flex items-center"
        >
          <Save className="w-3 h-3 mr-1" />
          {isSaving ? 'Saving...' : 'Save Colors'}
        </button>
      </div>
      
      {saveSuccess && (
        <div className="mt-2 text-xs text-green-400">
          Colors saved successfully!
        </div>
      )}
    </div>
  );
}