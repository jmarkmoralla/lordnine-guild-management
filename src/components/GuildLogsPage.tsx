import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader, Pencil, Plus, Search, ShoppingBag, Trash2, X } from 'lucide-react'
import type { AppRole } from '../types/admin'
import type { GuildLogCurrency, GuildLogItem } from '../types/guildLog'
import { useFirestoreGuildLogs } from '../hooks/useFirestoreGuildLogs'
import '../styles/Dashboard.css'
import '../styles/Rankings.css'
import '../styles/GuildLogs.css'

interface GuildLogsPageProps {
  userRole: AppRole
  userName?: string
  userGuild?: string
}

const ITEM_LOG_FOLDERS = [
  'Amentis', 'Aquleus', 'Araneo', 'Asta', 'Auraq',
  'Bahel', 'Baron Braudmore', 'Benji',
  'Camalia', 'Catena', 'Chaiflock', 'Clemantis',
  'Duplican',
  'Ego',
  'Gareth',
  'Icaruthia',
  'Lady Dalia', 'Larba', 'Libitina', 'Livera', 'Lucus',
  'Metus', 'Milavy', 'Motti',
  'Neutro', 'Nevaeh',
  'Ordo',
  'Rakajeth', 'Ringor', 'Roderick',
  'Saphirus', 'Secreta', 'Shuliar', 'Supore',
  'Thymele', 'Titore', 'Tumier',
  'Undomiel',
  'Venatus', 'Viorent',
  'Wannitas',
]

const ITEM_LOG_LOOT: Record<string, string[]> = {
  'Amentis': ['Foot', 'Heart'],
  'Aquleus': ['Heart', 'Leg'],
  'Araneo': ['Heart', 'Poison Gland'],
  'Asta': ['Belt', 'Heart'],
  'Auraq': ['Cell', 'Heart'],
  'Bahel': ['Boneshard', 'Claw', 'Heart'],
  'Baron Braudmore': ['Heart', 'Magic Sword'],
  'Benji': ['Blood', 'Heart'],
  'Camalia': ['Heart', 'Wing'],
  'Catena': ['Fragment', 'Spirit'],
  'Chaiflock': ['Belt', 'Heart'],
  'Clemantis': ['Heart', 'Horn'],
  'Duplican': ['Heart', 'Sword'],
  'Ego': ['Heart', 'Tail'],
  'Gareth': ['Mace', 'Soul'],
  'Icaruthia': ['Feather', 'Heart'],
  'Lady Dalia': ['Heart', 'Helm'],
  'Larba': ['Essence', 'Soul'],
  'Libitina': ['Heart', 'Wings'],
  'Livera': ['Heart', 'Pendant'],
  'Lucus': ['Core', 'Left Arm', 'Right Arm'],
  'Metus': ['Barding', 'Spirit'],
  'Milavy': ['Heart', 'Pincer'],
  'Motti': ['Helm', 'Soul'],
  'Neutro': ['Heart', 'Shell'],
  'Nevaeh': ['Heart', 'Horn'],
  'Ordo': ['Heart', 'Helm'],
  'Rakajeth': ['Backbone', 'Soul'],
  'Ringor': ['Heart', 'Toenail'],
  'Roderick': ['Armor', 'Soul'],
  'Saphirus': ['Heart', 'Pendant'],
  'Secreta': ['Heart', 'Horn'],
  'Shuliar': ['Gloves', 'Heart'],
  'Supore': ['Heart', 'Staff'],
  'Thymele': ['Heart', 'Lamp'],
  'Titore': ['Heart', 'Skin'],
  'Tumier': ['Heart', 'Hood'],
  'Undomiel': ['Chain', 'Heart'],
  'Venatus': ['Foot', 'Heart'],
  'Viorent': ['Heart', 'Sword'],
  'Wannitas': ['Spirit', 'Sword'],
}

const lootToImageFilename = (loot: string): string => {
  const parts = loot.split(' ')
  const camelCase = parts.map((part, i) =>
    i === 0 ? part.charAt(0).toLowerCase() + part.slice(1) : part.charAt(0).toUpperCase() + part.slice(1)
  ).join('')
  return `${camelCase}.png`
}

const GuildLogsPage: React.FC<GuildLogsPageProps> = ({ userRole, userName, userGuild }) => {
  const { items, loading, error, addItem, updateItem, deleteItem } = useFirestoreGuildLogs()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGuildFilter, setSelectedGuildFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState('')
  const [selectedLoot, setSelectedLoot] = useState('')
  const [itemQuantity, setItemQuantity] = useState('1')
  const [itemPrice, setItemPrice] = useState('')
  const [itemCurrency, setItemCurrency] = useState<GuildLogCurrency>('-')
  const [folderSearchQuery, setFolderSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [editingItem, setEditingItem] = useState<GuildLogItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<GuildLogItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [previewImageFailed, setPreviewImageFailed] = useState(false)
  const [failedImages, setFailedImages] = useState<Record<string, true>>({})
  const dropdownRef = useRef<HTMLDivElement>(null)

  const canManage = userRole === 'admin' || userRole === 'super_admin' || userRole === 'guild_admin'

  const filteredFolders = useMemo(() => {
    if (!folderSearchQuery.trim()) return ITEM_LOG_FOLDERS
    const query = folderSearchQuery.trim().toLowerCase()
    return ITEM_LOG_FOLDERS.filter((folder) =>
      folder.toLowerCase().includes(query)
    )
  }, [folderSearchQuery])

  const previewImage = selectedFolder && selectedLoot
    ? `/assets/images/item-logs/${selectedFolder}/${selectedLoot}/${lootToImageFilename(selectedLoot)}`
    : ''

  const previewName = selectedLoot && selectedFolder
    ? `${selectedFolder}${selectedFolder.endsWith('s') ? "'" : "'s"} ${selectedLoot}`
    : selectedFolder || 'Item Log Name'

  const handleCloseAddModal = () => {
    if (saving) return
    setShowAddModal(false)
    setEditingItem(null)
    setSelectedFolder('')
    setSelectedLoot('')
    setItemQuantity('1')
    setItemPrice('')
    setItemCurrency('-')
    setFolderSearchQuery('')
    setShowDropdown(false)
    setPreviewImageFailed(false)
  }

  useEffect(() => {
    if (!showAddModal) return
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAddModal])

  const handleSelectFolder = useCallback((folder: string) => {
    setSelectedFolder(folder)
    setSelectedLoot('')
    setItemQuantity('1')
    setItemPrice('')
    setItemCurrency('-')
    setFolderSearchQuery('')
    setShowDropdown(false)
    setPreviewImageFailed(false)
  }, [])

  const handleSelectLoot = useCallback((loot: string) => {
    setSelectedLoot(loot)
    setPreviewImageFailed(false)
  }, [])

  const openEditModal = useCallback((item: GuildLogItem) => {
    setEditingItem(item)
    setSelectedFolder(item.name || '')
    setSelectedLoot(item.loot || '')
    setItemQuantity(item.quantity ? String(item.quantity) : '1')
    setItemPrice(item.price > 0 ? String(item.price) : '')
    setItemCurrency(item.currency || '-')
    setShowAddModal(true)
    setPreviewImageFailed(false)
  }, [])

  const handleDeleteConfirm = async () => {
    if (!deletingItem?.id) return
    try {
      setSaving(true)
      await deleteItem(deletingItem.id)
      setDeletingItem(null)
    } catch {
      // error handled by hook
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedFolder || !selectedLoot) return
    try {
      setSaving(true)
      const payload = {
        name: selectedFolder,
        loot: selectedLoot,
        quantity: itemQuantity ? Number(itemQuantity) : 1,
        price: itemPrice ? Number(itemPrice) : 0,
        currency: itemCurrency,
        imageUrl: `/assets/images/item-logs/${selectedFolder}/${selectedLoot}/${lootToImageFilename(selectedLoot)}`,
        guild: userGuild ?? '',
        guildLeader: userName ?? '',
        status: 'Available' as const,
      }
      if (editingItem) {
        await updateItem(editingItem.id!, payload)
      } else {
        await addItem(payload)
      }
      handleCloseAddModal()
    } catch {
      // error handled by hook
    } finally {
      setSaving(false)
    }
  }

  const guildFilterOptions = useMemo(() => {
    const guildSet = new Set<string>()
    items.forEach((item) => {
      if (item.guild?.trim()) guildSet.add(item.guild.trim())
    })
    return [...guildSet].sort((a, b) => a.localeCompare(b))
  }, [items])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      const matchesGuild = selectedGuildFilter === 'all' ||
        item.guild === selectedGuildFilter
      return matchesSearch && matchesGuild
    })
  }, [items, searchQuery, selectedGuildFilter])

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Guild Item Logs</h2>
        <p className="page-subtitle">Track guild item logs and their availability status.</p>
      </div>

      <div className="guild-logs-toolbar">
        <div className="attendance-guest-search-box attendance-manage-search-box" role="search">
          <span className="attendance-guest-search-icon" aria-hidden="true">
            <Search size={14} strokeWidth={1.9} />
          </span>
          <input
            type="text"
            className="attendance-guest-search-input attendance-manage-search-input"
            placeholder="Search item log name..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Search item logs"
          />
          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              className="attendance-guest-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>

        <select
          className="filter-select"
          value={selectedGuildFilter}
          onChange={(e) => setSelectedGuildFilter(e.target.value)}
          aria-label="Filter by guild"
        >
          <option value="all">All Guilds</option>
          {guildFilterOptions.map((guild) => (
            <option key={guild} value={guild}>{guild}</option>
          ))}
        </select>

        {canManage && (
          <button
            type="button"
            className="guild-logs-add-btn"
            onClick={() => setShowAddModal(true)}
            aria-label="Add item log"
            title="Add item log"
          >
            <Plus size={16} strokeWidth={1.8} />
          </button>
        )}
      </div>

      {loading && (
        <div className="loading-state">
          <p>Loading item logs... <Loader size={16} strokeWidth={1.8} /></p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>Error: {error}</p>
        </div>
      )}

      {!loading && !error && filteredItems.length === 0 && (
        <div className="guild-logs-empty-state">
          <h3>No item logs found.</h3>
          <p>They may not have been added yet, or try adjusting your search or guild filter.</p>
        </div>
      )}

      {!loading && !error && filteredItems.length > 0 && (
        <section className="marketplace-list guild-logs-list" aria-label="Guild item logs">
          <div className={`marketplace-list-header ${canManage ? 'has-actions' : ''}`} aria-hidden="true">
            <span className="marketplace-col-name">Item Log Name</span>
            <span className="guild-logs-col-qty">Qty</span>
            <span className="marketplace-col-sale-price">Price per piece</span>
            <span className="guild-logs-col-guild">Guild</span>
            <span className="guild-logs-col-leader">Guild Leader/Officer</span>
            <span className="guild-logs-col-status-header">Status</span>
            {canManage && <span className="marketplace-col-actions">Action</span>}
          </div>

          <div className="marketplace-list-body">
              {filteredItems.map((item: GuildLogItem) => {
              const displayName = item.loot
                ? `${item.name}${item.name.endsWith('s') ? "'" : "'s"} ${item.loot}`
                : item.name
              return (
              <article key={item.id} className={`marketplace-row ${canManage ? 'has-actions' : ''}`}>
                <div className="marketplace-col-name marketplace-item-main">
                  <div className="marketplace-item-thumb-wrap">
                    {item.imageUrl && !failedImages[item.id!] ? (
                      <img src={item.imageUrl} alt={displayName} className="marketplace-item-thumb" loading="lazy" onError={() => setFailedImages(prev => ({ ...prev, [item.id!]: true }))} />
                    ) : (
                      <div className="marketplace-item-thumb-placeholder" aria-hidden="true">
                        <ShoppingBag size={22} strokeWidth={1.8} />
                      </div>
                    )}
                  </div>
                  <div className="marketplace-item-text">
                    <h3 className="marketplace-item-name">{displayName}</h3>
                  </div>
                </div>

                <div className="marketplace-cell guild-logs-col-qty">
                  <span className="marketplace-cell-label">Qty</span>
                  <strong>{item.quantity ?? 1}</strong>
                </div>

                <div className="marketplace-cell marketplace-col-sale-price">
                  <span className="marketplace-cell-label">Price per piece</span>
                  {item.price > 0 || item.currency !== '-'
                    ? <span><strong>{item.price > 0 ? item.price.toLocaleString() : '0'}</strong>{item.currency !== '-' && <span className="price-currency"> {item.currency}</span>}</span>
                    : <strong className="price-empty">—</strong>
                  }
                </div>

                <div className="marketplace-cell guild-logs-col-guild">
                  <span className="marketplace-cell-label">Guild</span>
                  <strong>{item.guild || '—'}</strong>
                </div>

                <div className="marketplace-cell guild-logs-col-leader">
                  <span className="marketplace-cell-label">Guild Leader/Officer</span>
                  <strong>{item.guildLeader || '—'}</strong>
                </div>

                <div className="marketplace-cell guild-logs-col-status">
                  <span className="marketplace-cell-label">Status</span>
                  <span className={`status-badge ${item.status === 'Available' ? 'status-active' : 'status-inactive'}`}>
                    {item.status}
                  </span>
                </div>

                {canManage && (userRole === 'super_admin' || item.guild === userGuild) && (
                  <div className="marketplace-cell marketplace-col-actions">
                    <span className="marketplace-cell-label">Action</span>
                    <div className="guild-logs-row-actions">
                      <button
                        type="button"
                        className="marketplace-icon-button"
                        onClick={() => openEditModal(item)}
                        aria-label={`Edit ${displayName}`}
                        title="Edit item"
                      >
                        <Pencil size={16} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        className="marketplace-icon-button danger"
                        onClick={() => setDeletingItem(item)}
                        aria-label={`Delete ${displayName}`}
                        title="Delete item"
                      >
                        <Trash2 size={16} strokeWidth={1.8} />
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          </div>
        </section>
      )}

      {showAddModal && (
        <div className="marketplace-modal-overlay modal-overlay" role="dialog" aria-modal="true" aria-label="Add item log">
          <form className="marketplace-modal marketplace-editor-modal modal-content add-member-modal guild-log-modal" onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
            <div className="marketplace-modal-header modal-header marketplace-editor-header">
                <div className="marketplace-editor-heading">
                  <h3>{editingItem ? 'Edit Item Log' : 'Add Item Log'}</h3>
                </div>
              <button type="button" className="marketplace-icon-button marketplace-modal-close modal-close" onClick={handleCloseAddModal} aria-label="Close add modal">
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>

            <div className="marketplace-modal-body modal-body marketplace-editor-body">
              <section className="marketplace-editor-preview" aria-label="Item log preview">
                <div className="marketplace-editor-preview-card">
                  <div className="marketplace-editor-preview-thumb-wrap">
                    {previewImage && !previewImageFailed ? (
                      <img
                        src={previewImage}
                        alt={selectedFolder || 'Item log'}
                        className="marketplace-editor-preview-thumb"
                        onError={() => setPreviewImageFailed(true)}
                      />
                    ) : (
                      <div className="marketplace-editor-preview-thumb-placeholder" aria-hidden="true">
                        <ShoppingBag size={38} strokeWidth={1.9} />
                      </div>
                    )}
                  </div>
                  <div className="marketplace-editor-preview-copy">
                    <h4 className="marketplace-item-name">{previewName}</h4>
                  </div>
                </div>
              </section>

              <section className="marketplace-editor-category-section">
                <div className="marketplace-editor-category-heading">
                  <h4 className="marketplace-editor-label">Item Log</h4>
                </div>
                <div className="guild-log-dropdown" ref={dropdownRef}>
                  <button
                    type="button"
                    className="guild-log-dropdown-trigger"
                    onClick={() => { setShowDropdown(!showDropdown); setFolderSearchQuery('') }}
                  >
                    <span className={`guild-log-dropdown-trigger-text ${selectedFolder ? '' : 'placeholder'}`}>
                      {selectedFolder || 'Select item...'}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`guild-log-dropdown-chevron ${showDropdown ? 'open' : ''}`}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showDropdown && (
                    <div className="guild-log-dropdown-panel">
                      <div className="attendance-guest-search-box guild-log-dropdown-search">
                        <span className="attendance-guest-search-icon" aria-hidden="true">
                          <Search size={14} strokeWidth={1.9} />
                        </span>
                        <input
                          type="text"
                          className="attendance-guest-search-input"
                          placeholder="Search items..."
                          value={folderSearchQuery}
                          onChange={(e) => setFolderSearchQuery(e.target.value)}
                          aria-label="Search items"
                          autoFocus
                        />
                        {folderSearchQuery && (
                          <button
                            type="button"
                            className="attendance-guest-search-clear"
                            onClick={() => setFolderSearchQuery('')}
                            aria-label="Clear search"
                          >
                            <X size={14} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                      <div className="guild-log-dropdown-list">
                        {filteredFolders.length > 0 ? (
                          filteredFolders.map((folder) => (
                            <button
                              key={folder}
                              type="button"
                              className={`guild-log-dropdown-item ${selectedFolder === folder ? 'active' : ''}`}
                              onClick={() => handleSelectFolder(folder)}
                            >
                              {folder}
                            </button>
                          ))
                        ) : (
                          <div className="guild-log-dropdown-empty">No items found.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="marketplace-editor-category-section" aria-label="Loot options">
                <div className="marketplace-editor-category-heading">
                  <h4 className="marketplace-editor-label">Loot</h4>
                </div>
                {selectedFolder ? (
                  <div className="marketplace-category-pill-list" role="radiogroup" aria-label="Available loot items">
                    {(ITEM_LOG_LOOT[selectedFolder] || []).map((loot) => (
                      <button
                        key={loot}
                        type="button"
                        className={`marketplace-category-pill ${selectedLoot === loot ? 'active' : ''}`}
                        onClick={() => handleSelectLoot(loot)}
                        aria-pressed={selectedLoot === loot}
                      >
                        {loot}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="guild-log-loot-empty">—</span>
                )}
              </section>

              <section className="marketplace-editor-category-section" aria-label="Quantity and price">
                <div className="guild-log-qty-price-row">
                  <div className="guild-log-qty-field">
                    <h4 className="marketplace-editor-label">Quantity</h4>
                    <input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      aria-label="Quantity"
                    />
                  </div>
                  <div className="guild-log-price-field">
                    <h4 className="marketplace-editor-label">Price per Piece (Optional)</h4>
                    <div className="guild-log-price-group">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={itemPrice}
                        onChange={(e) => setItemPrice(e.target.value)}
                        aria-label="Item price"
                      />
                      <select
                        value={itemCurrency}
                        onChange={(e) => setItemCurrency(e.target.value as GuildLogCurrency)}
                        aria-label="Currency"
                      >
                        <option value="-">-</option>
                        <option value="Dias">Dias</option>
                        <option value="USDT">USDT</option>
                        <option value="PHP">PHP</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="marketplace-form-actions modal-footer marketplace-editor-footer">
              <div className="marketplace-editor-footer-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCloseAddModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || !selectedLoot}>
                  {saving ? (editingItem ? 'Saving...' : 'Adding...') : (editingItem ? 'Save Changes' : 'Add Item')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {deletingItem && (
        <div className="marketplace-modal-overlay" role="dialog" aria-modal="true" aria-label="Delete item log">
          <div className="marketplace-modal marketplace-confirm-modal">
            <div className="marketplace-modal-header">
              <div>
                <h3>Delete Item Log</h3>
                <p>This action removes the item from the guild logs.</p>
              </div>
              <button type="button" className="marketplace-icon-button" onClick={() => setDeletingItem(null)} aria-label="Close delete modal">
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>
            <p className="marketplace-confirm-copy">Delete <strong>{deletingItem.loot ? `${deletingItem.name}${deletingItem.name.endsWith('s') ? "'" : "'s"} ${deletingItem.loot}` : deletingItem.name}</strong>?</p>
            <div className="marketplace-form-actions">
              <button type="button" className="marketplace-secondary-button" onClick={() => setDeletingItem(null)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="marketplace-danger-button" onClick={handleDeleteConfirm} disabled={saving}>
                {saving ? 'Deleting...' : 'Delete Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GuildLogsPage
