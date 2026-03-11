import { useEffect, useMemo, useState } from 'react';
import { Check, Loader, Pencil, Search, Send, X } from 'lucide-react';
import '../styles/Dashboard.css';
import '../styles/Rankings.css';
import '../styles/BossNotifier.css';
import { useFirestoreBossInfo } from '../hooks/useFirestoreBossInfo';
import { useFirestoreBossNotifierSettings } from '../hooks/useFirestoreBossNotifierSettings.ts';
import { sendBossNotificationForDate } from '../hooks/useDailyBossDiscordNotifier';

interface BossNotifierSettingsPageProps {
  userType: 'guest' | 'admin';
}

const BossNotifierSettingsPage: React.FC<BossNotifierSettingsPageProps> = ({ userType }) => {
  const { bosses, loading: bossesLoading, error: bossesError } = useFirestoreBossInfo();
  const { settings, loading: settingsLoading, error: settingsError, saveSettings } = useFirestoreBossNotifierSettings();

  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [manualNotificationDate, setManualNotificationDate] = useState('');
  const [enabledBossIds, setEnabledBossIds] = useState<string[]>([]);
  const [bossSearchQuery, setBossSearchQuery] = useState('');
  const [isEditingNotifierDetails, setIsEditingNotifierDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const isSaveError = saveMessage?.toLowerCase().includes('failed') ?? false;

  useEffect(() => {
    setDiscordWebhookUrl(settings.discordWebhookUrl);
    setManualNotificationDate(settings.manualNotificationDate);
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

  const toggleBoss = (bossId: string) => {
    setEnabledBossIds((currentIds) => {
      if (currentIds.includes(bossId)) {
        return currentIds.filter((id) => id !== bossId);
      }

      return [...currentIds, bossId];
    });
  };

  const handleSendNotification = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);

      const trimmedWebhookUrl = discordWebhookUrl.trim();
      if (!trimmedWebhookUrl) {
        setSaveMessage('Failed to send: Discord webhook URL is required.');
        return;
      }

      if (!manualNotificationDate) {
        setSaveMessage('Failed to send: Notification date is required.');
        return;
      }

      const selectedBosses = bosses.filter((boss) => boss.id && enabledBossIds.includes(boss.id));
      if (selectedBosses.length === 0) {
        setSaveMessage('Failed to send: Select at least one boss.');
        return;
      }

      await saveSettings({
        isEnabled: true,
        discordWebhookUrl: trimmedWebhookUrl,
        scheduleMode: 'manual',
        manualNotificationDate,
        manualNotificationTime: '',
        enabledBossIds,
      });

      const sentCount = await sendBossNotificationForDate({
        webhookUrl: trimmedWebhookUrl,
        bosses: selectedBosses,
        dateKey: manualNotificationDate,
      });

      if (sentCount === 0) {
        setSaveMessage('No selected bosses match the selected respawn date.');
        return;
      }

      setSaveMessage(`Notification sent for ${sentCount} boss(es). Settings saved.`);
    } catch (error) {
      console.error('Failed to send boss notifier notification:', error);
      setSaveMessage('Failed to send notification. Please check the webhook URL and try again.');
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
        <h2>Field Boss Discord Notifier</h2>
        <p className="page-subtitle">Send selected boss schedules by respawn date</p>
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
            <p>Lock fields by default to avoid accidental edits</p>
          </div>
          <button
            type="button"
            className={`notifier-edit-toggle ${isEditingNotifierDetails ? 'active' : ''}`}
            onClick={() => setIsEditingNotifierDetails((current) => !current)}
            aria-pressed={isEditingNotifierDetails}
            aria-label={isEditingNotifierDetails ? 'Disable editing webhook and date' : 'Enable editing webhook and date'}
            title={isEditingNotifierDetails ? 'Disable editing webhook and date' : 'Enable editing webhook and date'}
          >
            {isEditingNotifierDetails
              ? <Check size={14} strokeWidth={2.2} />
              : <Pencil size={14} strokeWidth={2} />}
          </button>
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
              autoComplete="off"
              disabled={!isEditingNotifierDetails}
            />
          </div>

          <div className="notifier-field-row notifier-field-date">
            <label htmlFor="manualNotificationDate">Boss Respawn Date</label>
            <input
              id="manualNotificationDate"
              className="filter-input notifier-date-input"
              type="date"
              value={manualNotificationDate}
              onChange={(event) => setManualNotificationDate(event.target.value)}
              disabled={!isEditingNotifierDetails}
            />
          </div>
        </div>
      </div>

      <div className="notifier-card">
        <div className="notifier-selection-header">
          <div>
            <h3>Selected Bosses</h3>
            <p>Only selected bosses scheduled on the target date are included in Discord notifications</p>
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
          onClick={handleSendNotification}
          disabled={saving || !discordWebhookUrl.trim() || !manualNotificationDate || enabledBossIds.length === 0}
        >
          {saving ? <Loader size={16} strokeWidth={1.8} /> : <Send size={16} strokeWidth={1.8} />}
          Send Notification
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
