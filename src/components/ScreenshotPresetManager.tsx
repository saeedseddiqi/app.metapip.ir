"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  PlusIcon,
  PencilSquareIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { supabase } from "../lib/supabase";
import ChartPreview from './ChartPreview';
import type { TVPreset } from "../lib/preset64";

// Example JSON shown as placeholder inside the editor
const DEMO_PRESET_JSON = `{
  "theme": "dark",
  "interval": "D",
  "overrides": {
    "paneProperties.backgroundType": "solid"
  }
}`;

// Type definitions
interface ScreenshotPreset {
  id: number;
  user_id: string;
  name: string;
  preset64: string;
  is_active: boolean;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface AppState {
  userId: string | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  presets: ScreenshotPreset[];
  name: string;
  jsonText: string;
  formError: string | null;
  editId: number | null;
  showDelete: boolean;
  deleteId: number | null;
  isDefault: boolean;
  activeTab: 'manage' | 'form';
}

// Initialize Supabase client (project-local)
const supabaseClient = supabase;

 

export default function ScreenshotPresetManager() {
  // State management
  const [state, setState] = useState<AppState>({
    userId: null,
    loading: true,
    saving: false,
    error: null,
    presets: [],
    name: "",
    jsonText: "{}",
    formError: null,
    editId: null,
    showDelete: false,
    deleteId: null,
    isDefault: false,
    activeTab: 'manage'
  });

  const { 
    userId, 
    loading, 
    saving, 
    error, 
    presets, 
    name, 
    jsonText,
    formError,
    editId, 
    showDelete, 
    deleteId, 
    isDefault,
    activeTab
  } = state;

  // Helper function to update state
  const updateState = useCallback((updates: Partial<AppState>) => {
    setState(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  // Reset form and modal state
  const resetForm = useCallback(() => {
    setState(prev => ({
      ...prev,
      name: "", 
      jsonText: "{}",
      formError: null,
      editId: null,
      isDefault: false,
      showModal: false,
      showDelete: false,
      deleteId: null,
      error: null
    }));
  }, []);

  // Fetch presets for the current user
  const fetchPresets = useCallback(async (uid: string) => {
    try {
      updateState({ loading: true, error: null });
      const { data, error } = await supabaseClient
        .from('presets')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      updateState({ presets: data || [], loading: false });
    } catch (err) {
      updateState({
        error: err instanceof Error ? err.message : 'Failed to load presets',
        loading: false 
      });
    }
  }, []);

  // Handle save preset
  const handleSave = useCallback(async () => {
    if (!userId) return;
    
    const presetName = name.trim();
    if (!presetName) {
      updateState({ error: 'Please enter a name for the preset' });
      return;
    }
    // Validate JSON text
    let cfg: any = {};
    try {
      cfg = JSON.parse(jsonText || "{}");
      updateState({ formError: null });
    } catch {
      updateState({ formError: 'JSON نامعتبر است' });
      return;
    }

    try {
      updateState({ saving: true, error: null });
      
      // If setting as default, unset previous defaults first
      if (isDefault) {
        const { error: unsetError } = await supabaseClient
          .from('presets')
          .update({ is_default: false })
          .eq('user_id', userId)
          .eq('is_default', true);
        if (unsetError) throw unsetError;
      }

      const presetData = {
        name: presetName,
        preset64: btoa(JSON.stringify(cfg)),
        is_default: isDefault,
        user_id: userId,
      };

      if (editId) {
        // Update existing preset
        const { error } = await supabaseClient
          .from('presets')
          .update(presetData)
          .eq('id', editId);

        if (error) throw error;
      } else {
        // Create new preset
        const { error } = await supabaseClient
          .from('presets')
          .insert([presetData]);

        if (error) throw error;
      }

      // Refresh presets and reset form
      await fetchPresets(userId);
      updateState({ activeTab: 'manage' });
      resetForm();
    } catch (err) {
      updateState({
        error: err instanceof Error ? err.message : 'Failed to save preset',
        saving: false 
      });
    } finally {
      updateState({ saving: false });
    }
  }, [userId, name, jsonText, isDefault, editId, fetchPresets, resetForm, updateState]);

  // Handle delete preset
  const handleDelete = useCallback(async (id?: number) => {
    if (!userId) return;
    const targetId = id ?? deleteId;
    if (!targetId) return;
    try {
      updateState({ saving: true, error: null });
      const { error } = await supabaseClient
        .from('presets')
        .delete()
        .eq('id', targetId);

      if (error) throw error;

      // Refresh presets
      await fetchPresets(userId);
      updateState({ showDelete: false, deleteId: null, saving: false });
    } catch (err) {
      updateState({
        error: err instanceof Error ? err.message : 'Failed to delete preset',
        saving: false 
      });
    }
  }, [userId, deleteId, fetchPresets, updateState]);

  // Handle edit preset
  const handleEdit = useCallback((preset: ScreenshotPreset) => {
    try {
      const config = JSON.parse(atob(preset.preset64));
      setState(prev => ({
        ...prev,
        name: preset.name,
        jsonText: JSON.stringify(config ?? {}, null, 2),
        formError: null,
        editId: preset.id,
        isDefault: preset.is_default || false,
        activeTab: 'form',
        error: null
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: 'Failed to load preset configuration',
        activeTab: 'manage'
      }));
    }
  }, []);

  // Handle duplicate preset
  const handleDuplicate = useCallback((preset: ScreenshotPreset) => {
    try {
      const config = JSON.parse(atob(preset.preset64));
      setState(prev => ({
        ...prev,
        name: `${preset.name} (Copy)`,
        jsonText: JSON.stringify(config ?? {}, null, 2),
        formError: null,
        editId: null,
        isDefault: false,
        activeTab: 'form',
        error: null
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: 'Failed to duplicate preset',
        activeTab: 'manage'
      }));
    }
  }, []);
 

 

  // Handle create new preset
  const handleCreateNew = useCallback(() => {
    resetForm();
    updateState({ activeTab: 'form' });
  }, [resetForm, updateState]);

  // Handle set default preset
  const handleSetDefault = useCallback(async (id: number) => {
    if (!state.userId) return;
    
    try {
      setState(prev => ({ ...prev, saving: true, error: null }));
      
      // First, unset any existing default
      const { error: unsetError } = await supabaseClient
        .from('presets')
        .update({ is_default: false })
        .eq('user_id', state.userId)
        .eq('is_default', true);

      if (unsetError) throw unsetError;
      
      // Then set the new default
      const { error: setError } = await supabaseClient
        .from('presets')
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', state.userId);

      if (setError) throw setError;
      
      // Refresh presets
      await fetchPresets(state.userId);
      setState(prev => ({ ...prev, saving: false }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to set default preset',
        saving: false 
      }));
    }
  }, [state.userId, fetchPresets]);


  // Handle cancel edit
  const cancelEdit = useCallback(() => {
    resetForm();
    updateState({ activeTab: 'manage' });
  }, [resetForm, updateState]);

  // Handle confirm delete
  const confirmDelete = useCallback((id: number) => {
    updateState({ 
      deleteId: id, 
      showDelete: true 
    });
  }, [updateState]);

  // Handle cancel delete
  const cancelDelete = useCallback(() => {
    updateState({ 
      deleteId: null, 
      showDelete: false 
    });
  }, [updateState]);

  // Load user and presets on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const { data } = await supabaseClient.auth.getUser();
        const uid = data?.user?.id || null;
        updateState({ userId: uid });
        
        if (uid) {
          await fetchPresets(uid);
        }
      } catch (e) {
        updateState({ 
          error: e instanceof Error ? e.message : "خطا در دریافت اطلاعات کاربر",
          loading: false 
        });
      } finally {
        updateState({ loading: false });
      }
    };

    initialize();
  }, [fetchPresets, updateState]);

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">مدیریت پریست‌های اسکرین‌شات</h2>
        <div className="flex items-center gap-2">
          <Link
            href="/presets"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-800 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            prefetch={false}
          >
            سازنده پریست
          </Link>
          <button
            type="button"
            onClick={handleCreateNew}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="ml-2 -mr-1 h-5 w-5" />
            پریست جدید
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px space-x-4 rtl:space-x-reverse" aria-label="Tabs">
          <button
            type="button"
            onClick={() => updateState({ activeTab: 'manage' })}
            className={(activeTab === 'manage' ? 'border-blue-500 text-blue-600 ' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 ') + 'whitespace-nowrap py-2 px-3 border-b-2 text-sm font-medium'}
          >
            مدیریت
          </button>
          <button
            type="button"
            onClick={() => updateState({ activeTab: 'form' })}
            className={(activeTab === 'form' ? 'border-blue-500 text-blue-600 ' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 ') + 'whitespace-nowrap py-2 px-3 border-b-2 text-sm font-medium'}
          >
            فرم
          </button>
        </nav>
      </div>

      {activeTab === 'manage' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {presets.length === 0 ? (
              <li className="p-4 text-center text-gray-500">
                هیچ پریستی یافت نشد. برای شروع یک پریست جدید ایجاد کنید.
              </li>
            ) : (
              presets.map((preset) => (
                <li key={preset.id}>
                  <div className="px-4 py-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">{preset.name}</div>
                      {preset.is_default && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          پیش‌فرض
                        </span>
                      )}
                    </div>
                    <div className="flex space-x-2 rtl:space-x-reverse">
                      {!preset.is_default && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(preset.id)}
                          className="text-amber-600 hover:text-amber-800"
                          title="تنظیم به عنوان پیش‌فرض"
                        >
                          <CheckIcon className="h-5 w-5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleEdit(preset)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <PencilSquareIcon className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(preset)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <DocumentDuplicateIcon className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmDelete(preset.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {activeTab === 'form' && (
        <div className="bg-white shadow sm:rounded-md p-6">
          <div className="sm:flex sm:items-start">
            <div className="mt-1 text-right w-full">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                {editId ? 'ویرایش پریست' : 'پریست جدید'}
              </h3>
              <div className="mt-2">
                <div className="mb-4">
                  <label htmlFor="preset-name" className="block text-sm font-medium text-gray-700 mb-1">
                    نام پریست
                  </label>
                  <input
                    type="text"
                    id="preset-name"
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                    value={name}
                    onChange={(e) => updateState({ name: e.target.value })}
                    placeholder="نام پریست"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    تنظیمات (JSON)
                  </label>
                  <textarea
                    className="w-full h-64 p-2 border border-gray-300 rounded-md font-mono text-sm"
                    dir="ltr"
                    value={jsonText}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateState({ jsonText: val });
                      try {
                        JSON.parse(val || "{}");
                        updateState({ formError: null });
                      } catch {
                        updateState({ formError: 'JSON نامعتبر است' });
                      }
                    }}
                    placeholder={DEMO_PRESET_JSON}
                  />
                  {formError && (
                    <p className="mt-2 text-sm text-red-600" dir="auto">{formError}</p>
                  )}
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <input
                    id="is-default"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={isDefault}
                    onChange={(e) => updateState({ isDefault: e.target.checked })}
                  />
                  <label htmlFor="is-default" className="text-sm text-gray-700">تنظیم به عنوان پیش‌فرض</label>
                </div>
                <div className="mt-4">
                  <h4 className="font-medium mb-2">پیش‌نمایش زنده</h4>
                  {(() => {
                    try {
                      const obj = JSON.parse(jsonText || "{}") as TVPreset;
                      return <ChartPreview preset={obj} symbol="EURUSD" height={420} />;
                    } catch {
                      return <p className="text-sm text-gray-500">برای پیش‌نمایش، JSON معتبر وارد کنید.</p>;
                    }
                  })()}
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleSave}
                  disabled={saving || !!formError || !name.trim()}
                >
                  {saving ? 'در حال ذخیره...' : 'ذخیره'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legacy modal removed; using tabs-based form above */}

    {/* Delete Confirmation Modal */}
    {showDelete && (
      <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={cancelDelete}></div>
          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
          <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:mr-4 sm:text-right">
                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                  حذف پریست
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    آیا از حذف این پریست اطمینان دارید؟ این عمل قابل بازگشت نیست.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={() => handleDelete()}
                disabled={saving}
              >
                {saving ? 'در حال حذف...' : 'حذف'}
              </button>
              <button
                type="button"
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                onClick={cancelDelete}
                disabled={saving}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);

}
