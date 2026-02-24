import { useEffect, useMemo, useState } from 'react';
import { Calculator, Crosshair, Heart, Loader, Save, Settings, Shield, Zap } from 'lucide-react';
import '../styles/RelicCalculator.css';
import { buildDefaultTemporalPieceLevelMap, relicConfigs, type RelicKey } from '../data/relicCalculatorConfig';
import { useFirestoreRelicTemporalPieceSettings } from '../hooks/useFirestoreRelicTemporalPieceSettings';

const clampNumber = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

type RelicLevelEntry = {
  fromLevel: number;
  toLevel: number;
};

type RelicLevelEntries = Record<RelicKey, RelicLevelEntry>;

const temporalPieceChestTiers = [
  { tier: 'T1', temporalPiecePerChest: 1000 },
  { tier: 'T2', temporalPiecePerChest: 5000 },
  { tier: 'T3', temporalPiecePerChest: 10000 },
  { tier: 'T4', temporalPiecePerChest: 50000 },
  { tier: 'T5', temporalPiecePerChest: 100000 },
];

const relicCardClassMap: Record<RelicKey, string> = {
  'origin-of-destruction': 'relic-origin',
  'barrier-of-protection': 'relic-barrier',
  'crystal-of-life': 'relic-crystal',
  'magic-storn': 'relic-magic',
};

const relicColorClassMap: Record<RelicKey, string> = {
  'origin-of-destruction': 'relic-color-origin',
  'barrier-of-protection': 'relic-color-barrier',
  'crystal-of-life': 'relic-color-crystal',
  'magic-storn': 'relic-color-magic',
};

const renderRelicIcon = (relicId: RelicKey) => {
  switch (relicId) {
    case 'origin-of-destruction':
      return <Crosshair size={17} strokeWidth={1.9} className="relic-section-icon" />;
    case 'barrier-of-protection':
      return <Shield size={17} strokeWidth={1.9} className="relic-section-icon" />;
    case 'crystal-of-life':
      return <Heart size={17} strokeWidth={1.9} className="relic-section-icon" />;
    case 'magic-storn':
      return <Zap size={17} strokeWidth={1.9} className="relic-section-icon" />;
    default:
      return <Calculator size={17} strokeWidth={1.9} className="relic-section-icon" />;
  }
};

interface RelicCalculatorPageProps {
  userType: 'guest' | 'admin';
}

const RelicCalculatorPage: React.FC<RelicCalculatorPageProps> = ({ userType }) => {
  const { settings, loading: settingsLoading, error: settingsError, saveSettings } = useFirestoreRelicTemporalPieceSettings();
  const [relicLevelEntries, setRelicLevelEntries] = useState<RelicLevelEntries>({
    'origin-of-destruction': { fromLevel: 0, toLevel: 0 },
    'barrier-of-protection': { fromLevel: 0, toLevel: 0 },
    'crystal-of-life': { fromLevel: 0, toLevel: 0 },
    'magic-storn': { fromLevel: 0, toLevel: 0 },
  });
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedRelicForConfig, setSelectedRelicForConfig] = useState<RelicKey>('origin-of-destruction');
  const [draftLevelCostsByRelic, setDraftLevelCostsByRelic] = useState(buildDefaultTemporalPieceLevelMap());
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaveMessage, setConfigSaveMessage] = useState<string | null>(null);
  const isConfigSaveError = configSaveMessage?.toLowerCase().includes('failed') ?? false;

  useEffect(() => {
    setDraftLevelCostsByRelic(settings.levelCostsByRelic);
  }, [settings.levelCostsByRelic]);

  const calculatedRelics = useMemo(() => {
    return relicConfigs.map((relic) => {
      const levelEntry = relicLevelEntries[relic.id];
      const normalizedFromLevel = clampNumber(levelEntry.fromLevel, 0, 100);
      const normalizedToLevel = clampNumber(levelEntry.toLevel, 0, 100);
      const isExcluded = normalizedFromLevel === 0 || normalizedToLevel === 0;

      if (isExcluded) {
        return {
          ...relic,
          startLevel: 0,
          endLevel: 0,
          levelRange: 0,
          requiredTemporalPieces: 0,
          isExcluded: true,
        };
      }

      const startLevel = Math.min(normalizedFromLevel, normalizedToLevel);
      const endLevel = Math.max(normalizedFromLevel, normalizedToLevel);
      const levelRange = endLevel - startLevel;
      const levelCosts = settings.levelCostsByRelic[relic.id] ?? [];

      const upgradeLevels = Array.from({ length: levelRange }, (_, index) => startLevel + index + 1);
      const requiredTemporalPieces = upgradeLevels.reduce((total, level) => {
        return total + Math.max(0, Math.round(levelCosts[level] ?? 0));
      }, 0);

      return {
        ...relic,
        startLevel,
        endLevel,
        levelRange,
        requiredTemporalPieces,
        isExcluded: false,
      };
    });
  }, [relicLevelEntries, settings.levelCostsByRelic]);

  const totalTemporalPieces = useMemo(() => {
    return calculatedRelics.reduce((total, relic) => total + relic.requiredTemporalPieces, 0);
  }, [calculatedRelics]);

  const totalChestRequirements = useMemo(() => {
    return temporalPieceChestTiers.map((chestTier) => {
      const requiredChests = totalTemporalPieces > 0
        ? Math.ceil(totalTemporalPieces / chestTier.temporalPiecePerChest)
        : 0;

      return {
        ...chestTier,
        requiredChests,
        totalTierTp: requiredChests * chestTier.temporalPiecePerChest,
      };
    });
  }, [totalTemporalPieces]);

  const handleLevelChange = (relicId: RelicKey, field: keyof RelicLevelEntry, value: number) => {
    setRelicLevelEntries((prev) => ({
      ...prev,
      [relicId]: {
        ...prev[relicId],
        [field]: clampNumber(value, 0, 100),
      },
    }));
  };

  const handleResetRelicLevels = (relicId: RelicKey) => {
    setRelicLevelEntries((prev) => ({
      ...prev,
      [relicId]: {
        fromLevel: 0,
        toLevel: 0,
      },
    }));
  };

  const handleOpenConfigModal = () => {
    if (userType !== 'admin') return;
    setDraftLevelCostsByRelic(settings.levelCostsByRelic);
    setConfigSaveMessage(null);
    setIsConfigModalOpen(true);
  };

  const handleLevelCostConfigChange = (relicId: RelicKey, level: number, value: number) => {
    setDraftLevelCostsByRelic((prev) => ({
      ...prev,
      [relicId]: prev[relicId].map((cost, index) => {
        if (index !== level) return cost;
        return clampNumber(Math.round(value), 0, 999999);
      }),
    }));
  };

  const handleSaveConfig = async () => {
    if (userType !== 'admin') return;

    try {
      setIsSavingConfig(true);
      setConfigSaveMessage(null);
      await saveSettings(draftLevelCostsByRelic);
      setConfigSaveMessage('Temporal piece per-level settings saved.');
    } catch (error) {
      console.error('Failed to save relic temporal piece settings:', error);
      setConfigSaveMessage('Failed to save temporal piece settings. Please try again.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="page-container relic-page-container">
      <div className="page-header relic-page-header">
        <h2>Relic Enhancement Calculator</h2>
        <p className="page-subtitle">Calculate all relic enhancement costs simultaneously (Max level 100).</p>
        {userType === 'admin' && (
          <button
            type="button"
            className="refresh-btn-filter relic-config-btn"
            onClick={handleOpenConfigModal}
            disabled={settingsLoading}
          >
            {settingsLoading ? <Loader size={15} strokeWidth={1.9} /> : <Settings size={15} strokeWidth={1.9} />}
            Configure
          </button>
        )}
      </div>

      {settingsError && (
        <div className="error-state">
          <p>Error loading relic temporal piece settings: {settingsError}</p>
        </div>
      )}

      <div className="relic-sections-grid">
        {calculatedRelics.map((relic) => (
          <div
            key={relic.id}
            className={`relic-calculator-card relic-section-card ${relicCardClassMap[relic.id]}`}
          >
            <div className="relic-section-header">
              <div className="relic-section-title-wrap">
                {renderRelicIcon(relic.id)}
                <h4 className="relic-section-title">{relic.name}</h4>
              </div>
              <button
                type="button"
                className="relic-card-reset-btn"
                onClick={() => handleResetRelicLevels(relic.id)}
                aria-label={`Reset ${relic.name} levels`}
                title={`Reset ${relic.name}`}
              >
                <span aria-hidden="true">↺</span>
              </button>
            </div>

            <div className="relic-level-row">
              <label className="relic-input-group" htmlFor={`${relic.id}-from-level`}>
                <span>Current Level (1-100)</span>
                <input
                  id={`${relic.id}-from-level`}
                  type="number"
                  min={0}
                  max={100}
                  value={relicLevelEntries[relic.id].fromLevel}
                  disabled={relic.id === 'magic-storn'}
                  onChange={(event) => handleLevelChange(relic.id, 'fromLevel', Number(event.target.value))}
                />
              </label>

              <label className="relic-input-group" htmlFor={`${relic.id}-to-level`}>
                <span>Target Level (1-100)</span>
                <input
                  id={`${relic.id}-to-level`}
                  type="number"
                  min={0}
                  max={100}
                  value={relicLevelEntries[relic.id].toLevel}
                  disabled={relic.id === 'magic-storn'}
                  onChange={(event) => handleLevelChange(relic.id, 'toLevel', Number(event.target.value))}
                />
              </label>
            </div>

            <div className="relic-selection-summary">
              <span>
                {relic.isExcluded ? 'Excluded' : `Level ${relic.startLevel} → ${relic.endLevel}`}
              </span>
              <strong className="relic-selection-total">{relic.requiredTemporalPieces.toLocaleString()} TP</strong>
            </div>

            {relic.id === 'magic-storn' && (
              <div className="relic-maintenance-overlay" role="status" aria-live="polite">
                <div className="relic-maintenance-overlay-content">
                  <strong>Under Maintenance</strong>
                  <span>Collecting data for the Magic Storm Relic</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="relic-calculator-card relic-breakdown-card">
        <div className="relic-card-title">
          <h3>Cost Breakdown</h3>
        </div>

        <div className="relic-breakdown-grid">
          {calculatedRelics.map((relic) => (
            <div key={`${relic.id}-breakdown`} className="relic-breakdown-row">
              <span className={`relic-breakdown-main ${relicCardClassMap[relic.id]}`}>
                {renderRelicIcon(relic.id)}
                <span className="relic-breakdown-name">{relic.name}</span>
              </span>
              <span className="relic-breakdown-range">
                {relic.isExcluded ? 'Excluded' : `Lv ${relic.startLevel} → ${relic.endLevel}`}
              </span>
              <span className="relic-breakdown-pieces">{relic.requiredTemporalPieces.toLocaleString()} TP</span>
            </div>
          ))}
        </div>

        <div className="relic-breakdown-total">
          <span>Total Required Temporal Pieces</span>
          <strong>{totalTemporalPieces.toLocaleString()}</strong>
        </div>
      </div>

      <div className="relic-calculator-card relic-total-chest-card">
        <div className="relic-card-title">
          <h3>Temporal Chest Requirement</h3>
        </div>

        <table className="relic-chest-table" aria-label="Total chest requirements for all relics">
          <thead>
            <tr>
              <th>Tier</th>
              <th>TP/Chest</th>
              <th>Qty</th>
              <th>Total TP</th>
            </tr>
          </thead>
          <tbody>
            {totalChestRequirements.map((chestTier) => (
              <tr key={`total-${chestTier.tier}`}>
                <td>{chestTier.tier}</td>
                <td>{chestTier.temporalPiecePerChest.toLocaleString()}</td>
                <td>{chestTier.requiredChests.toLocaleString()}</td>
                <td>{chestTier.totalTierTp.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isConfigModalOpen && userType === 'admin' && (
        <div
          className="relic-config-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="relic-config-modal-title"
          onClick={() => setIsConfigModalOpen(false)}
        >
          <div className="relic-config-modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="relic-config-modal-header">
              <h3 id="relic-config-modal-title">Temporal Piece Configuration Per Level</h3>
              <button
                type="button"
                className="relic-config-modal-close"
                onClick={() => setIsConfigModalOpen(false)}
                aria-label="Close temporal piece configuration modal"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <p className="relic-config-modal-subtitle">
              Configure required Temporal Piece values for each relic level. Changes apply to all users once saved.
            </p>

            <div className="relic-config-relic-tabs" role="tablist" aria-label="Select relic">
              {relicConfigs.map((relic) => (
                <button
                  key={`${relic.id}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={selectedRelicForConfig === relic.id}
                  className={`relic-config-relic-tab ${relicColorClassMap[relic.id]} ${selectedRelicForConfig === relic.id ? 'active' : ''}`}
                  onClick={() => setSelectedRelicForConfig(relic.id)}
                >
                  <span className="relic-config-relic-tab-icon" aria-hidden="true">{renderRelicIcon(relic.id)}</span>
                  {relic.name}
                </button>
              ))}
            </div>

            <div className={`relic-config-level-list ${relicColorClassMap[selectedRelicForConfig]}`}>
              {Array.from({ length: 100 }, (_, index) => {
                const level = index + 1;
                const value = draftLevelCostsByRelic[selectedRelicForConfig]?.[level] ?? 0;

                return (
                  <label key={`${selectedRelicForConfig}-level-${level}`} className="relic-config-level-row">
                    <span>Level {level}</span>
                    <input
                      type="number"
                      min={0}
                      value={value}
                      onChange={(event) => handleLevelCostConfigChange(selectedRelicForConfig, level, Number(event.target.value))}
                    />
                  </label>
                );
              })}
            </div>

            <div className="relic-config-modal-footer">
              <button
                type="button"
                className="refresh-btn-filter relic-config-action primary"
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
              >
                {isSavingConfig ? <Loader size={15} strokeWidth={1.9} /> : <Save size={15} strokeWidth={1.9} />}
                Save Configuration
              </button>
              {configSaveMessage && (
                <span className={`relic-config-save-message ${isConfigSaveError ? 'error' : 'success'}`}>
                  {configSaveMessage}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelicCalculatorPage;