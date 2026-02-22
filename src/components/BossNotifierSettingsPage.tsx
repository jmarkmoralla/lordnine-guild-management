import { useEffect, useMemo, useState } from 'react';
import { Check, Loader, Pencil, Save, Search, X } from 'lucide-react';
import '../styles/Dashboard.css';
import '../styles/Rankings.css';
import '../styles/BossNotifier.css';
import { useFirestoreBossInfo } from '../hooks/useFirestoreBossInfo';
import { useFirestoreBossNotifierSettings } from '../hooks/useFirestoreBossNotifierSettings.ts';

interface BossNotifierSettingsPageProps {
  userType: 'guest' | 'admin';
}

const BossNotifierSettingsPage: React.FC<BossNotifierSettingsPageProps> = ({ userType }) => {
  const { bosses, loading: bossesLoading, error: bossesError } = useFirestoreBossInfo();
  const { settings, loading: settingsLoading, error: settingsError, saveSettings } = useFirestoreBossNotifierSettings();

  const [isEnabled, setIsEnabled] = useState(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [notificationTime, setNotificationTime] = useState('09:00');
  const [enabledBossIds, setEnabledBossIds] = useState<string[]>([]);
  const [bossSearchQuery, setBossSearchQuery] = useState('');
  const [isEditingNotifierDetails, setIsEditingNotifierDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const isSaveError = saveMessage?.toLowerCase().includes('failed') ?? false;

  useEffect(() => {
    setIsEnabled(settings.isEnabled);
    setDiscordWebhookUrl(settings.discordWebhookUrl);
    setNotificationTime(settings.notificationTime);
    setEnabledBossIds(settings.enabledBossIds);
    setIsEditingNotifierDetails(false);
  }, [settings]);

  const sortedBosses = useMemo(
    () => [...bosses].sort((first, second) => first.name.localeCompare(second.name)),
    [bosses]
  );

  const filteredBosses = useMemo(
    () => sortedBosses.filter((boss) => boss.name.toLowerCase().includes(bossSearchQuery.toLowerCase())),
    [bossSearchQuery, sortedBosses]
  );

  const isDirty = useMemo(() => {
    const selectedSet = new Set(enabledBossIds);
    const originalSet = new Set(settings.enabledBossIds);
    const sameSelection = selectedSet.size === originalSet.size && [...selectedSet].every((id) => originalSet.has(id));

    return (
      isEnabled !== settings.isEnabled
      || discordWebhookUrl !== settings.discordWebhookUrl
      || notificationTime !== settings.notificationTime
      || !sameSelection
    );
  }, [discordWebhookUrl, enabledBossIds, isEnabled, notificationTime, settings]);

  const toggleBoss = (bossId: string) => {
    setEnabledBossIds((currentIds) => {
      if (currentIds.includes(bossId)) {
        return currentIds.filter((id) => id !== bossId);
      }

      return [...currentIds, bossId];
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);
      await saveSettings({
        isEnabled,
        discordWebhookUrl: discordWebhookUrl.trim(),
        notificationTime,
        enabledBossIds,
      });
      setSaveMessage('Field boss notifier settings saved.');
    } catch (error) {
      console.error('Failed to save boss notifier settings:', error);
      setSaveMessage('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (userType !== 'admin') {
    return (
      <div className="page-container">
        <div className="page-header">
          <h2>Field Boss Discord Notifier</h2>
          <p className="page-subtitle">Admin access required</p>
        </div>
        <div className="error-state">
          <p>Access denied. Please sign in as admin to manage notifier settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container boss-notifier-page">
      <div className="page-header">
        <h2>Boss Discord Notifier</h2>
        <p className="page-subtitle">Configure daily boss respawn notifications and select included bosses</p>
      </div>

      {(bossesLoading || settingsLoading) && (
        <div className="loading-state">
          <p>Loading notifier settings... <Loader size={16} strokeWidth={1.8} /></p>
        </div>
      )}

      {(bossesError || settingsError) && (
        <div className="error-state">
          <p>Error: {bossesError || settingsError}</p>
        </div>
      )}

      <div className="notifier-card">
        <div className="notifier-card-header">
          <div className="notifier-card-header-main">
            <h3>Notification Settings</h3>
            <p>Manage Discord webhook and schedule</p>
          </div>
          <div className="notifier-card-toggle-wrap">
            <button
              type="button"
              className={`notifier-edit-toggle ${isEditingNotifierDetails ? 'active' : ''}`}
              onClick={() => setIsEditingNotifierDetails((current) => !current)}
              aria-pressed={isEditingNotifierDetails}
              aria-label={isEditingNotifierDetails ? 'Disable editing webhook and timer' : 'Enable editing webhook and timer'}
              title={isEditingNotifierDetails ? 'Disable editing webhook and timer' : 'Enable editing webhook and timer'}
            >
              {isEditingNotifierDetails
                ? <Check size={14} strokeWidth={2.2} />
                : <Pencil size={14} strokeWidth={2} />}
            </button>
            <button
              id="notifierEnabled"
              type="button"
              role="switch"
              aria-checked={isEnabled}
              className={`notifier-switch notifier-card-toggle ${isEnabled ? 'active' : ''}`}
              onClick={() => setIsEnabled((current) => !current)}
            >
              <span className="notifier-switch-thumb" />
            </button>
          </div>
        </div>

        <div className="notifier-inline-fields">
          <div className="notifier-field-row notifier-field-url">
            <label htmlFor="discordWebhookUrl">Discord Webhook URL</label>
            <input
              id="discordWebhookUrl"
              className="filter-input notifier-input"
              type="url"
              placeholder="https://discord.com/api/webhooks/..."
              value={discordWebhookUrl}
              onChange={(event) => setDiscordWebhookUrl(event.target.value)}
              disabled={!isEditingNotifierDetails}
            />
          </div>

          <div className="notifier-field-row notifier-field-time">
            <label htmlFor="notificationTime">Daily Schedule (PH Time)</label>
            <input
              id="notificationTime"
              className="filter-input notifier-time-input"
              type="time"
              value={notificationTime}
              onChange={(event) => setNotificationTime(event.target.value)}
              disabled={!isEditingNotifierDetails}
            />
          </div>
        </div>
      </div>

      <div className="notifier-card">
        <div className="notifier-selection-header">
          <div>
            <h3>Selected Bosses</h3>
            <p>Only selected bosses will appear in the daily message</p>
          </div>
          <span className="notifier-count-badge">{enabledBossIds.length} selected</span>
        </div>

        <div className="notifier-boss-search-box" role="search">
          <span className="notifier-boss-search-icon" aria-hidden="true">
            <Search size={14} strokeWidth={1.9} />
          </span>
          <input
            type="text"
            className="notifier-boss-search-input"
            placeholder="Search boss name..."
            value={bossSearchQuery}
            onChange={(event) => setBossSearchQuery(event.target.value)}
            aria-label="Search included bosses"
          />
          {bossSearchQuery && (
            <button
              type="button"
              className="notifier-boss-search-clear"
              onClick={() => setBossSearchQuery('')}
              aria-label="Clear included boss search"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>

        <div className="notifier-boss-list">
          {filteredBosses.map((boss) => (
            <label key={boss.id} className="notifier-boss-item">
              <input
                className="notifier-boss-checkbox"
                type="checkbox"
                checked={Boolean(boss.id && enabledBossIds.includes(boss.id))}
                onChange={() => boss.id && toggleBoss(boss.id)}
              />
              <span className="notifier-boss-info">
                <span className="notifier-boss-name">{boss.name}</span>
                <span className="notifier-boss-meta">{boss.bossType}</span>
              </span>
            </label>
          ))}
          {filteredBosses.length === 0 && (
            <p className="notifier-empty">
              {sortedBosses.length === 0 ? 'No bosses available to select.' : 'No bosses match your search.'}
            </p>
          )}
        </div>
      </div>

      <div className="notifier-actions">
        <button
          className="refresh-btn-filter notifier-save-btn"
          onClick={handleSave}
          disabled={saving || !isDirty}
        >
          {saving ? <Loader size={16} strokeWidth={1.8} /> : <Save size={16} strokeWidth={1.8} />}
          Save Notifier Settings
        </button>
        {saveMessage && (
          <span className={`notifier-save-message ${isSaveError ? 'error' : 'success'}`}>
            {saveMessage}
          </span>
        )}
      </div>
    </div>
  );
};

export default BossNotifierSettingsPage;
