import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { Shield, Sparkles, Swords } from 'lucide-react'
import '../styles/HiddenClasses.css'
import { hiddenClasses } from '../data/hiddenClassesConfig'
import type {
  HiddenClassAbilityPopupInfo,
  HiddenClassAbilityPopupPanel,
  HiddenClassAbilityPopupTextSegment,
  HiddenClassBoardCategory,
  HiddenClassPopupPanelTone,
  HiddenClassPopupTextTone,
  HiddenClassProgressionPopupInfo,
} from '../types/hiddenClass'

const categoryImagePaths: Record<HiddenClassBoardCategory, string> = {
  enhance: '/assets/images/hidden-class/enhance/enhance.png',
  combat: '/assets/images/hidden-class/combat/combat.png',
  vitality: '/assets/images/hidden-class/vitality/vitality.png',
  trick: '/assets/images/hidden-class/trick/trick.png',
  recon: '/assets/images/hidden-class/recon/recon.png',
  defense: '/assets/images/hidden-class/defense/defense.png',
  support: '/assets/images/hidden-class/support/support.png',
  spell: '/assets/images/hidden-class/spell/spell.png',
}

const boardCardStyles: Record<HiddenClassBoardCategory, CSSProperties> = {
  enhance: {
    ['--hidden-node-card-glow' as string]: 'rgba(255, 170, 73, 0.24)',
    ['--hidden-node-card-top' as string]: 'rgba(94, 49, 20, 0.96)',
    ['--hidden-node-card-mid' as string]: 'rgba(58, 33, 19, 0.98)',
    ['--hidden-node-card-bottom' as string]: 'rgba(25, 18, 16, 0.99)',
    ['--hidden-node-card-border' as string]: '#7d5634',
    ['--hidden-node-frame-border' as string]: 'rgba(163, 112, 68, 0.64)',
    ['--hidden-node-frame-corner' as string]: 'rgba(244, 187, 92, 0.74)',
  },
  combat: {
    ['--hidden-node-card-glow' as string]: 'rgba(220, 91, 99, 0.22)',
    ['--hidden-node-card-top' as string]: 'rgba(93, 31, 39, 0.96)',
    ['--hidden-node-card-mid' as string]: 'rgba(57, 24, 28, 0.98)',
    ['--hidden-node-card-bottom' as string]: 'rgba(24, 18, 19, 0.99)',
    ['--hidden-node-card-border' as string]: '#784049',
    ['--hidden-node-frame-border' as string]: 'rgba(151, 79, 89, 0.64)',
    ['--hidden-node-frame-corner' as string]: 'rgba(223, 110, 121, 0.72)',
  },
  vitality: {
    ['--hidden-node-card-glow' as string]: 'rgba(124, 205, 101, 0.2)',
    ['--hidden-node-card-top' as string]: 'rgba(50, 73, 30, 0.96)',
    ['--hidden-node-card-mid' as string]: 'rgba(35, 48, 23, 0.98)',
    ['--hidden-node-card-bottom' as string]: 'rgba(20, 22, 17, 0.99)',
    ['--hidden-node-card-border' as string]: '#51703a',
    ['--hidden-node-frame-border' as string]: 'rgba(101, 145, 76, 0.64)',
    ['--hidden-node-frame-corner' as string]: 'rgba(142, 217, 111, 0.72)',
  },
  trick: {
    ['--hidden-node-card-glow' as string]: 'rgba(230, 204, 99, 0.24)',
    ['--hidden-node-card-top' as string]: 'rgba(88, 73, 26, 0.96)',
    ['--hidden-node-card-mid' as string]: 'rgba(55, 45, 20, 0.98)',
    ['--hidden-node-card-bottom' as string]: 'rgba(23, 20, 16, 0.99)',
    ['--hidden-node-card-border' as string]: '#7b6a31',
    ['--hidden-node-frame-border' as string]: 'rgba(155, 132, 62, 0.64)',
    ['--hidden-node-frame-corner' as string]: 'rgba(231, 213, 104, 0.74)',
  },
  recon: {
    ['--hidden-node-card-glow' as string]: 'rgba(214, 96, 150, 0.22)',
    ['--hidden-node-card-top' as string]: 'rgba(84, 32, 55, 0.96)',
    ['--hidden-node-card-mid' as string]: 'rgba(50, 23, 34, 0.98)',
    ['--hidden-node-card-bottom' as string]: 'rgba(24, 18, 22, 0.99)',
    ['--hidden-node-card-border' as string]: '#78445b',
    ['--hidden-node-frame-border' as string]: 'rgba(146, 78, 108, 0.64)',
    ['--hidden-node-frame-corner' as string]: 'rgba(224, 111, 161, 0.72)',
  },
  defense: {
    ['--hidden-node-card-glow' as string]: 'rgba(82, 203, 222, 0.22)',
    ['--hidden-node-card-top' as string]: 'rgba(29, 68, 76, 0.96)',
    ['--hidden-node-card-mid' as string]: 'rgba(22, 43, 47, 0.98)',
    ['--hidden-node-card-bottom' as string]: 'rgba(17, 22, 22, 0.99)',
    ['--hidden-node-card-border' as string]: '#386a71',
    ['--hidden-node-frame-border' as string]: 'rgba(73, 135, 145, 0.64)',
    ['--hidden-node-frame-corner' as string]: 'rgba(98, 213, 230, 0.72)',
  },
  support: {
    ['--hidden-node-card-glow' as string]: 'rgba(181, 125, 82, 0.2)',
    ['--hidden-node-card-top' as string]: 'rgba(79, 48, 30, 0.96)',
    ['--hidden-node-card-mid' as string]: 'rgba(49, 32, 23, 0.98)',
    ['--hidden-node-card-bottom' as string]: 'rgba(22, 19, 17, 0.99)',
    ['--hidden-node-card-border' as string]: '#75503a',
    ['--hidden-node-frame-border' as string]: 'rgba(143, 97, 70, 0.64)',
    ['--hidden-node-frame-corner' as string]: 'rgba(202, 151, 102, 0.72)',
  },
  spell: {
    ['--hidden-node-card-glow' as string]: 'rgba(104, 144, 214, 0.2)',
    ['--hidden-node-card-top' as string]: 'rgba(34, 50, 73, 0.96)',
    ['--hidden-node-card-mid' as string]: 'rgba(25, 34, 48, 0.98)',
    ['--hidden-node-card-bottom' as string]: 'rgba(18, 21, 26, 0.99)',
    ['--hidden-node-card-border' as string]: '#455c7d',
    ['--hidden-node-frame-border' as string]: 'rgba(82, 108, 149, 0.64)',
    ['--hidden-node-frame-corner' as string]: 'rgba(120, 163, 231, 0.7)',
  },
}

const HiddenClassesPage: React.FC = () => {
  const [selectedClassId, setSelectedClassId] = useState(hiddenClasses[0]?.id ?? '')
  const [selectedAbilityPopup, setSelectedAbilityPopup] = useState<HiddenClassAbilityPopupInfo | null>(null)
  const [abilityPopupPosition, setAbilityPopupPosition] = useState<{ top: number; left: number } | null>(null)
  const [selectedProgressionPopup, setSelectedProgressionPopup] = useState<HiddenClassProgressionPopupInfo | null>(null)
  const [progressionPopupPosition, setProgressionPopupPosition] = useState<{ top: number; left: number } | null>(null)
  const abilityPopupRef = useRef<HTMLDivElement | null>(null)
  const progressionPopupRef = useRef<HTMLDivElement | null>(null)

  const activeHiddenClass = useMemo(() => {
    return hiddenClasses.find((hiddenClass) => hiddenClass.id === selectedClassId) ?? hiddenClasses[0]
  }, [selectedClassId])

  const displayNodeRows = activeHiddenClass.boardRows ?? []
  const displayNodeIcons = displayNodeRows.flatMap((group) => [group.left, group.right])
  const progressionEntries = activeHiddenClass.progressionEntries ?? []

  const getProgressionLines = (entry: (typeof progressionEntries)[number]) => {
    if (entry.lines?.length) {
      return entry.lines
    }

    return [{ label: entry.label, value: entry.value }]
  }

  const getEntryPopup = (entry: (typeof progressionEntries)[number]) => {
    if (entry.popup) {
      return entry.popup
    }

    return getProgressionLines(entry)
      .flatMap((line) => line.segments ?? [])
      .find((segment) => segment.popup)?.popup ?? null
  }

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedAbilityPopup(null)
        setAbilityPopupPosition(null)
        setSelectedProgressionPopup(null)
        setProgressionPopupPosition(null)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  useEffect(() => {
    setSelectedAbilityPopup(null)
    setAbilityPopupPosition(null)
    setSelectedProgressionPopup(null)
    setProgressionPopupPosition(null)
  }, [selectedClassId])

  const openAbilityPopup = (popup: HiddenClassAbilityPopupInfo, triggerElement: HTMLElement) => {
    const rect = triggerElement.getBoundingClientRect()
    const popupWidth = 352
    const margin = 12
    const gap = 18
    const preferredLeft = rect.right + gap
    const left = preferredLeft + popupWidth <= window.innerWidth - margin
      ? preferredLeft
      : Math.max(margin, rect.left - popupWidth - gap)
    const top = Math.max(margin, rect.top - 24)

    setSelectedAbilityPopup(popup)
    setAbilityPopupPosition({ top, left })
  }

  const closeAbilityPopup = () => {
    setSelectedAbilityPopup(null)
    setAbilityPopupPosition(null)
  }

  const openProgressionPopup = (popup: HiddenClassProgressionPopupInfo, triggerElement: HTMLElement) => {
    const rect = triggerElement.getBoundingClientRect()
    const popupWidth = 308
    const margin = 12
    const gap = 16
    const preferredLeft = rect.left - popupWidth - gap
    const left = preferredLeft >= margin
      ? preferredLeft
      : rect.right + gap
    const top = Math.max(margin, rect.top - 36)

    setSelectedProgressionPopup(popup)
    setProgressionPopupPosition({ top, left })
  }

  const closeProgressionPopup = () => {
    setSelectedProgressionPopup(null)
    setProgressionPopupPosition(null)
  }

  useLayoutEffect(() => {
    if (!selectedAbilityPopup || !abilityPopupPosition || !abilityPopupRef.current) {
      return
    }

    const margin = 12
    const rect = abilityPopupRef.current.getBoundingClientRect()
    const nextLeft = Math.min(
      Math.max(margin, abilityPopupPosition.left),
      Math.max(margin, window.innerWidth - rect.width - margin),
    )
    const nextTop = Math.min(
      Math.max(margin, abilityPopupPosition.top),
      Math.max(margin, window.innerHeight - rect.height - margin),
    )

    if (nextLeft !== abilityPopupPosition.left || nextTop !== abilityPopupPosition.top) {
      setAbilityPopupPosition({ top: nextTop, left: nextLeft })
    }
  }, [selectedAbilityPopup, abilityPopupPosition])

  const popupSections = selectedProgressionPopup?.sections?.length
    ? selectedProgressionPopup.sections
    : selectedProgressionPopup
      ? [{
          title: selectedProgressionPopup.detailLabel ?? 'Skill Effect',
          segments: [{ text: selectedProgressionPopup.detailText }],
        }]
      : []

  useLayoutEffect(() => {
    if (!selectedProgressionPopup || !progressionPopupPosition || !progressionPopupRef.current) {
      return
    }

    const margin = 12
    const rect = progressionPopupRef.current.getBoundingClientRect()
    const nextLeft = Math.min(
      Math.max(margin, progressionPopupPosition.left),
      Math.max(margin, window.innerWidth - rect.width - margin),
    )
    const nextTop = Math.min(
      Math.max(margin, progressionPopupPosition.top),
      Math.max(margin, window.innerHeight - rect.height - margin),
    )

    if (nextLeft !== progressionPopupPosition.left || nextTop !== progressionPopupPosition.top) {
      setProgressionPopupPosition({ top: nextTop, left: nextLeft })
    }
  }, [selectedProgressionPopup, progressionPopupPosition])

  const renderPopupSegments = (section: (typeof popupSections)[number]) => {
    if (section.segments?.length) {
      return (
        <p className="hidden-progression-popup-section-copy">
          {section.segments.map((segment, index) => (
            <span
              key={`${segment.text}-${index}`}
              className={[
                'hidden-progression-popup-copy-segment',
                segment.tone === 'highlight' ? 'hidden-progression-popup-copy-segment-highlight' : '',
                segment.tone === 'accent' ? 'hidden-progression-popup-copy-segment-accent' : '',
                segment.tone === 'violet' ? 'hidden-progression-popup-copy-segment-violet' : '',
                segment.tone === 'red' ? 'hidden-progression-popup-copy-segment-red' : '',
              ].filter(Boolean).join(' ')}
            >
              {segment.text}
            </span>
          ))}
        </p>
      )
    }

    return null
  }

  const renderProgressionLine = (line: ReturnType<typeof getProgressionLines>[number]) => {
    if (line.segments?.length) {
      return line.segments.map((segment, index) => (
        <span
          key={`${segment.text}-${index}`}
          className={[
            'hidden-progression-segment',
            segment.tone === 'highlight' ? 'hidden-progression-segment-highlight' : '',
            segment.tone === 'accent' ? 'hidden-progression-segment-accent' : '',
            segment.tone === 'violet' ? 'hidden-progression-segment-violet' : '',
            segment.tone === 'red' ? 'hidden-progression-segment-red' : '',
            segment.underline ? 'hidden-progression-segment-underlined' : '',
          ].filter(Boolean).join(' ')}
        >
          {segment.text}
        </span>
      ))
    }

    return (
      <>
        {line.label ? <span className="hidden-progression-label">{line.label}</span> : null}
        {line.value ? <strong className="hidden-progression-value">{line.value}</strong> : null}
      </>
    )
  }

  const getAbilityTriggerProps = (popup: HiddenClassAbilityPopupInfo | undefined, label: string) => {
    if (!popup) {
      return {}
    }

    return {
      role: 'button' as const,
      tabIndex: 0,
      'aria-label': `Open ${label} details`,
      onClick: (event: ReactMouseEvent<HTMLDivElement>) => openAbilityPopup(popup, event.currentTarget),
      onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openAbilityPopup(popup, event.currentTarget)
        }
      },
    }
  }

  const getAbilityValueClassName = (tone?: HiddenClassPopupTextTone) => ([
    'hidden-ability-popup-card-value',
    tone === 'highlight' ? 'hidden-ability-popup-card-value-highlight' : '',
    tone === 'accent' ? 'hidden-ability-popup-card-value-accent' : '',
    tone === 'violet' ? 'hidden-ability-popup-card-value-violet' : '',
    tone === 'red' ? 'hidden-ability-popup-card-value-red' : '',
    tone === 'yellow' ? 'hidden-ability-popup-card-value-yellow' : '',
  ].filter(Boolean).join(' '))

  const getAbilitySegmentClassName = (tone?: HiddenClassPopupTextTone, underline?: boolean) => ([
    'hidden-ability-popup-copy-segment',
    tone === 'highlight' ? 'hidden-ability-popup-copy-segment-highlight' : '',
    tone === 'accent' ? 'hidden-ability-popup-copy-segment-accent' : '',
    tone === 'violet' ? 'hidden-ability-popup-copy-segment-violet' : '',
    tone === 'red' ? 'hidden-ability-popup-copy-segment-red' : '',
    tone === 'yellow' ? 'hidden-ability-popup-copy-segment-yellow' : '',
    underline ? 'hidden-ability-popup-copy-segment-underline' : '',
  ].filter(Boolean).join(' '))

  const renderAbilitySegments = (segments?: HiddenClassAbilityPopupTextSegment[], blockClassName = 'hidden-ability-popup-card-copy') => {
    if (!segments?.length) {
      return null
    }

    return (
      <p className={blockClassName}>
        {segments.map((segment, segmentIndex) => (
          <span
            key={`${segment.text}-${segmentIndex}`}
            className={getAbilitySegmentClassName(segment.tone, segment.underline)}
          >
            {segment.text}
            {segment.breakLine ? <br /> : null}
          </span>
        ))}
      </p>
    )
  }

  const getAbilityPanelClassName = (tone?: HiddenClassPopupPanelTone | HiddenClassPopupPanelTone[]) => {
    const tones = Array.isArray(tone) ? tone : [tone ?? 'subtle']

    return [
      'hidden-ability-popup-panel',
      ...tones.map((panelTone) => `hidden-ability-popup-panel-${panelTone}`),
    ].join(' ')
  }

  const renderAbilityPanels = (panels?: HiddenClassAbilityPopupPanel[]) => {
    if (!panels?.length) {
      return null
    }

    return (
      <div className="hidden-ability-popup-panels">
        {panels.map((panel) => (
          <div key={panel.title} className={getAbilityPanelClassName(panel.tone)}>
            <div className="hidden-ability-popup-panel-header">
              <span className="hidden-ability-popup-panel-title">{panel.title}</span>
              {panel.items?.length ? (
                <div className="hidden-ability-popup-panel-meta">
                  {panel.items.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              ) : null}
            </div>

            {panel.itemSegments?.length ? (
              <div className="hidden-ability-popup-panel-lines">
                {panel.itemSegments.map((itemSegments, itemIndex) => (
                  <p key={`${panel.title}-${itemIndex}`} className="hidden-ability-popup-panel-line">
                    {itemSegments.map((segment, segmentIndex) => (
                      <span
                        key={`${segment.text}-${segmentIndex}`}
                        className={getAbilitySegmentClassName(segment.tone, segment.underline)}
                      >
                        {segment.text}
                      </span>
                    ))}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    )
  }

  const getAbilityStatusClassName = (status?: string) => ([
    'hidden-ability-popup-card-status',
    status === 'Active' ? 'hidden-ability-popup-card-status-active' : '',
    status === 'Passive' ? 'hidden-ability-popup-card-status-passive' : '',
  ].filter(Boolean).join(' '))

  const getAbilitySectionIconClassName = (status?: string) => ([
    'hidden-ability-popup-section-icon',
    status === 'Active' ? 'hidden-ability-popup-section-icon-active' : '',
    status === 'Passive' ? 'hidden-ability-popup-section-icon-passive' : '',
  ].filter(Boolean).join(' '))

  const renderAbilitySectionIcon = (status?: string, iconPath?: string) => {
    if (iconPath) {
      return <img src={iconPath} alt="" className="hidden-ability-popup-section-icon-image" />
    }

    if (status === 'Passive') {
      return <Shield className="hidden-ability-popup-section-icon-fallback" strokeWidth={1.8} />
    }

    return <Sparkles className="hidden-ability-popup-section-icon-fallback" strokeWidth={1.8} />
  }

  if (!activeHiddenClass) {
    return null
  }

  const accentStyle = {
    ['--hidden-class-accent' as string]: activeHiddenClass.accentColor,
  } as CSSProperties

  return (
    <div className="page-container hidden-classes-page">
      <div className="page-header hidden-classes-header">
        <h2>Hidden Classes</h2>
        <p className="page-subtitle">
          Browse every hidden class with a game-style board and detail panel.
        </p>
      </div>

      <div className="hidden-class-switcher" role="tablist" aria-label="Hidden class switcher">
        {hiddenClasses.map((hiddenClass) => {
          const isActive = hiddenClass.id === activeHiddenClass.id

          return (
            <button
              key={hiddenClass.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`hidden-class-switcher-card ${isActive ? 'active' : ''}`}
              style={{ ['--hidden-class-card-accent' as string]: hiddenClass.accentColor } as CSSProperties}
              onClick={() => setSelectedClassId(hiddenClass.id)}
            >
              <span className="hidden-class-switcher-title">{hiddenClass.name}</span>
            </button>
          )
        })}
      </div>

      <div className="hidden-class-content" style={accentStyle}>
        <section className="hidden-class-tree-panel">
          <div className="hidden-class-board-shell">
            <div className="hidden-class-board-glow" aria-hidden="true" />
            <div className="hidden-class-board-orbit" aria-hidden="true">
              <div className="hidden-class-board-title-wrap">
                <h3 className="hidden-class-board-title">{activeHiddenClass.name}</h3>
              </div>
            </div>

            <div className="hidden-node-lanes">
              {displayNodeRows.map((group) => {
                const leftCardTriggerProps = getAbilityTriggerProps(group.left.popup, group.left.abilityName)
                const rightCardTriggerProps = getAbilityTriggerProps(group.right.popup, group.right.abilityName)

                return (
                <div key={`${group.left.category}-${group.right.category}-${group.left.abilityName}`} className="hidden-node-row lane-group">
                  <div className="hidden-node-pair">
                    <div className="hidden-node-square-wrap hidden-node-square-wrap-left">
                      <img
                        src={categoryImagePaths[group.left.category]}
                        alt=""
                        className="hidden-node-side-icon hidden-node-side-icon-left"
                      />

                      <div
                        className={[
                          'hidden-node-card',
                          'hidden-node-card-category',
                          group.left.popup ? 'hidden-node-card-clickable' : '',
                        ].filter(Boolean).join(' ')}
                        style={boardCardStyles[group.left.category]}
                        {...leftCardTriggerProps}
                      >
                        <span className="hidden-node-frame" aria-hidden="true" />
                        <span className="hidden-node-rank-inside">{group.left.rankText ?? '80/80'}</span>
                        <img
                          src={group.left.imagePath ?? categoryImagePaths[group.left.category]}
                          alt=""
                          className="hidden-node-emblem-image hidden-node-emblem-image-category"
                        />
                      </div>
                    </div>

                    <span className="hidden-node-connector" aria-hidden="true" />

                    <div className="hidden-node-square-wrap hidden-node-square-wrap-right">
                      <img
                        src={categoryImagePaths[group.right.category]}
                        alt=""
                        className="hidden-node-side-icon hidden-node-side-icon-right"
                      />

                      <div
                        className={[
                          'hidden-node-card',
                          'hidden-node-card-ability',
                          group.right.popup ? 'hidden-node-card-clickable' : '',
                        ].filter(Boolean).join(' ')}
                        style={boardCardStyles[group.right.category]}
                        {...rightCardTriggerProps}
                      >
                        <span className="hidden-node-frame" aria-hidden="true" />
                        <span className="hidden-node-rank-inside">{group.right.rankText ?? '80/80'}</span>
                        {group.right.imagePath ? (
                          <img
                            src={group.right.imagePath}
                            alt={group.right.abilityName}
                            className="hidden-node-emblem-image"
                          />
                        ) : (
                          <span className="hidden-node-emblem" aria-hidden="true">
                            {group.right.category.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="hidden-node-text-pair">
                    <div className="hidden-node-text-stack">
                      <span className="hidden-node-category">{group.left.category}</span>
                      <span className="hidden-node-card-label">{group.left.abilityName}</span>
                    </div>
                    <div className="hidden-node-text-stack">
                      <span className="hidden-node-category">{group.right.category}</span>
                      <span className="hidden-node-card-label">{group.right.abilityName}</span>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </div>
        </section>

        <aside className="hidden-class-detail-panel">
          <div className="hidden-detail-panel-header">
            <div className="hidden-class-section-heading compact hidden-detail-heading-block">
              <div>
                <h4>{activeHiddenClass.name}</h4>
                <p>{activeHiddenClass.summary}</p>
              </div>
            </div>
          </div>

          <div className="hidden-detail-tab-panel">
            <div className="hidden-class-node-icon-row" aria-label={`${activeHiddenClass.name} node icons`}>
              {displayNodeIcons.map((node, index) => (
                <div key={`${node.category}-${node.abilityName}-${index}`} className="hidden-class-node-icon-chip" title={node.abilityName}>
                  <img
                    src={categoryImagePaths[node.category]}
                    alt={node.category}
                    className="hidden-class-node-icon"
                  />
                </div>
              ))}
            </div>

            <div className="hidden-progression-list" aria-label={`${activeHiddenClass.name} progression rewards`}>
              {progressionEntries.map((entry) => {
                const entryPopup = getEntryPopup(entry)

                return (
                <div
                  key={entry.level}
                  className={[
                    'hidden-progression-item',
                    entryPopup ? 'hidden-progression-item-clickable' : '',
                  ].filter(Boolean).join(' ')}
                  role={entryPopup ? 'button' : undefined}
                  tabIndex={entryPopup ? 0 : undefined}
                  onClick={entryPopup ? (event) => openProgressionPopup(entryPopup, event.currentTarget) : undefined}
                  onKeyDown={entryPopup ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openProgressionPopup(entryPopup, event.currentTarget)
                    }
                  } : undefined}
                >
                  <div className="hidden-progression-icon-stack">
                    <Swords className="hidden-progression-icon" strokeWidth={1.8} aria-hidden="true" />
                    <span className="hidden-progression-level">{entry.level}</span>
                  </div>

                  <div className="hidden-progression-copy">
                    {getProgressionLines(entry).map((line, index) => (
                      <div
                        key={`${entry.level}-${line.label}-${index}`}
                        className={[
                          'hidden-progression-line',
                          line.segments?.length ? 'hidden-progression-line-paragraph' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {renderProgressionLine(line)}
                      </div>
                    ))}
                  </div>
                </div>
              )})}
            </div>
          </div>
        </aside>
      </div>

      {selectedAbilityPopup && abilityPopupPosition ? (
        <>
          <button
            type="button"
            className="hidden-ability-popup-overlay"
            onClick={closeAbilityPopup}
            aria-label="Close ability details"
          />
          <div
            ref={abilityPopupRef}
            className="hidden-ability-popup"
            style={{
              top: abilityPopupPosition.top,
              left: abilityPopupPosition.left,
              ...boardCardStyles[selectedAbilityPopup.category],
            }}
            role="dialog"
            aria-modal="true"
            aria-label={selectedAbilityPopup.title}
          >
            <div className="hidden-ability-popup-header">
              <div className="hidden-ability-popup-heading">
                <div className="hidden-ability-popup-icon-frame" aria-hidden="true">
                  {selectedAbilityPopup.iconPath ? (
                    <img src={selectedAbilityPopup.iconPath} alt="" className="hidden-ability-popup-icon-image" />
                  ) : (
                    <Swords className="hidden-ability-popup-icon-fallback" strokeWidth={1.8} />
                  )}
                </div>
                <div className="hidden-ability-popup-heading-copy">
                  <h5>{selectedAbilityPopup.title}</h5>
                </div>
              </div>

              <button
                type="button"
                className="hidden-ability-popup-close"
                onClick={closeAbilityPopup}
                aria-label="Close ability details"
              >
                ×
              </button>
            </div>

            <div className="hidden-ability-popup-meta-grid">
              {selectedAbilityPopup.meta.map((field) => (
                <div key={field.label} className="hidden-ability-popup-meta-item">
                  <span>{field.label}</span>
                  <strong>{field.value}</strong>
                </div>
              ))}
            </div>

            <div className="hidden-ability-popup-body">
              {selectedAbilityPopup.cards.map((card) => (
                <section key={`${selectedAbilityPopup.title}-${card.title}`} className="hidden-ability-popup-card">
                  <div className="hidden-ability-popup-card-header">
                    <div className="hidden-ability-popup-card-heading">
                      <span className={getAbilitySectionIconClassName(card.status)} aria-hidden="true">
                        {renderAbilitySectionIcon(card.status, selectedAbilityPopup.iconPath)}
                      </span>
                      <div>
                        <h6>{card.title}</h6>
                        {card.subtitle ? <p>{card.subtitle}</p> : null}
                      </div>
                    </div>
                    {card.status ? <span className={getAbilityStatusClassName(card.status)}>{card.status}</span> : null}
                  </div>

                  {card.rows?.length ? (
                    <div className="hidden-ability-popup-card-rows">
                      {card.rows.map((row) => (
                        <div key={`${card.title}-${row.label}`} className="hidden-ability-popup-card-row">
                          <span className="hidden-ability-popup-card-label">{row.label}:</span>
                          {row.valueSegments?.length ? (
                            <strong className="hidden-ability-popup-card-value hidden-ability-popup-card-value-segmented">
                              {row.valueSegments.map((segment, segmentIndex) => (
                                <span
                                  key={`${segment.text}-${segmentIndex}`}
                                  className={getAbilitySegmentClassName(segment.tone, segment.underline)}
                                >
                                  {segment.text}
                                  {segment.breakLine ? <br /> : null}
                                </span>
                              ))}
                            </strong>
                          ) : (
                            <strong className={getAbilityValueClassName(row.tone)}>{row.value}</strong>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {card.descriptionSegments?.length
                    ? renderAbilitySegments(card.descriptionSegments)
                    : card.description
                      ? <p className="hidden-ability-popup-card-copy">{card.description}</p>
                      : null}

                  {renderAbilityPanels(card.panels)}
                </section>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {selectedProgressionPopup && progressionPopupPosition ? (
        <>
          <button
            type="button"
            className="hidden-progression-popup-overlay"
            onClick={closeProgressionPopup}
            aria-label="Close progression details"
          />
          <div
            ref={progressionPopupRef}
            className="hidden-progression-popup"
            style={{ top: progressionPopupPosition.top, left: progressionPopupPosition.left }}
            role="dialog"
            aria-modal="true"
            aria-label={selectedProgressionPopup.title}
          >
            <div className="hidden-progression-popup-header">
              <h5>{selectedProgressionPopup.title}</h5>
              <button
                type="button"
                className="hidden-progression-popup-close"
                onClick={closeProgressionPopup}
                aria-label="Close progression details"
              >
                ×
              </button>
            </div>

            <div className="hidden-progression-popup-main">
              <div className="hidden-progression-popup-icon-frame" aria-hidden="true">
                {selectedProgressionPopup.iconPath ? (
                  <img
                    src={selectedProgressionPopup.iconPath}
                    alt=""
                    className="hidden-progression-popup-icon-image"
                  />
                ) : (
                  <Swords className="hidden-progression-popup-icon-fallback" strokeWidth={1.8} />
                )}
              </div>

              <div className="hidden-progression-popup-heading-block">
                {selectedProgressionPopup.metaLabel || selectedProgressionPopup.metaValue ? (
                  <div className="hidden-progression-popup-meta-grid">
                    {selectedProgressionPopup.metaLabel ? <span>{selectedProgressionPopup.metaLabel}</span> : null}
                    {selectedProgressionPopup.metaValue ? <strong>{selectedProgressionPopup.metaValue}</strong> : null}
                  </div>
                ) : null}

                {selectedProgressionPopup.subtitle ? <p>{selectedProgressionPopup.subtitle}</p> : null}
                {selectedProgressionPopup.typeLabel ? (
                  <div className="hidden-progression-popup-type">{selectedProgressionPopup.typeLabel}</div>
                ) : null}
              </div>
            </div>

            {selectedProgressionPopup.badges?.length ? (
              <div className="hidden-progression-popup-badges">
                {selectedProgressionPopup.badges.map((badge) => (
                  <span
                    key={badge.label}
                    className={`hidden-progression-popup-badge hidden-progression-popup-badge-${badge.tone ?? 'neutral'}`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="hidden-progression-popup-body">
              {popupSections.map((section) => {
                const panelTones = Array.isArray(section.panelTone)
                  ? section.panelTone
                  : [section.panelTone ?? 'subtle']

                return (
                <section key={section.title} className="hidden-progression-popup-section">
                  {section.displayStyle === 'panel' ? null : (
                    <span className="hidden-progression-popup-detail-label">{section.title}</span>
                  )}
                  {section.displayStyle === 'panel' ? (
                    <div
                      className={[
                        'hidden-progression-popup-panel',
                        ...panelTones.map((tone) => `hidden-progression-popup-panel-${tone}`),
                      ].join(' ')}
                    >
                      <div className="hidden-progression-popup-panel-header">
                        <span className="hidden-progression-popup-panel-title">{section.title}</span>
                        {section.items?.length ? (
                          <div className="hidden-progression-popup-panel-meta">
                            {section.items.map((item) => (
                              <span key={item}>{item}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {section.itemSegments?.length ? (
                        <div className="hidden-progression-popup-panel-lines">
                          {section.itemSegments.map((itemSegments, itemIndex) => (
                            <p key={`${section.title}-${itemIndex}`} className="hidden-progression-popup-panel-line">
                              {itemSegments.map((segment, segmentIndex) => (
                                <span
                                  key={`${segment.text}-${segmentIndex}`}
                                  className={[
                                    'hidden-progression-popup-copy-segment',
                                    segment.tone === 'highlight' ? 'hidden-progression-popup-copy-segment-highlight' : '',
                                    segment.tone === 'accent' ? 'hidden-progression-popup-copy-segment-accent' : '',
                                    segment.tone === 'violet' ? 'hidden-progression-popup-copy-segment-violet' : '',
                                    segment.tone === 'red' ? 'hidden-progression-popup-copy-segment-red' : '',
                                  ].filter(Boolean).join(' ')}
                                >
                                  {segment.text}
                                </span>
                              ))}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {section.segments?.length ? renderPopupSegments(section) : null}
                    </div>
                  ) : section.items?.length ? (
                    <ul className="hidden-progression-popup-list">
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  {section.displayStyle === 'panel' ? null : section.itemSegments?.length ? (
                    <ul className="hidden-progression-popup-list">
                      {section.itemSegments.map((itemSegments, itemIndex) => (
                        <li key={`${section.title}-${itemIndex}`}>
                          {itemSegments.map((segment, segmentIndex) => (
                            <span
                              key={`${segment.text}-${segmentIndex}`}
                              className={[
                                'hidden-progression-popup-copy-segment',
                                segment.tone === 'highlight' ? 'hidden-progression-popup-copy-segment-highlight' : '',
                                segment.tone === 'accent' ? 'hidden-progression-popup-copy-segment-accent' : '',
                                segment.tone === 'violet' ? 'hidden-progression-popup-copy-segment-violet' : '',
                              ].filter(Boolean).join(' ')}
                            >
                              {segment.text}
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {section.displayStyle === 'panel' ? null : renderPopupSegments(section)}
                </section>
              )})}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

export default HiddenClassesPage