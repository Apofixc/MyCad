// app.js - Core Boardview Engine for Пиррс 1000 Люкс (100% Автономная версия)

class BoardviewApp {
    constructor() {
        this.boardMeta = window.BOARD_META || {
            dimensions: {
                widthPx: 9955,
                heightPx: 3766,
                boardRect: { x: 0, y: 0, width: 9955, height: 3766 }
            }
        };
        this.footprintTemplates = window.FOOTPRINT_LIBRARY || window.FOOTPRINT_TEMPLATES || {};
        this.catalogTree = window.COMPONENT_CATALOG_TREE || [];
        this.componentPresets = window.COMPONENT_PRESETS || {};
        this.initialComponents = window.INITIAL_COMPONENTS || [];

        this.components = [];
        this.selectedId = null;
        this.history = [];
        this.historyIndex = -1;
        this.lastSavedState = null;
        this.isModified = false;
        this.aspectRatioLocked = true;
        this.resizeScope = 'single'; // 'single' (только выбранный) | 'group' (вся группа по типу корпуса)

        // Catalog navigation state
        this.catalogPath = []; // [] = корневые категории, [catId] = подкатегории, [catId, subcatName] = корпуса
        this.catalogMountFilter = 'all'; // 'all' | 'tht' | 'smd' | 'ic'
        this.catalogSearchQuery = '';

        // Current App Mode: 'view' (read-only) or 'edit' (CAD editing)
        this.currentMode = 'view';

        // Viewport / Camera state
        this.camera = {
            x: 0,
            y: 0,
            zoom: 0.1,
            minZoom: 0.005,
            maxZoom: 5.0
        };

        // Interaction state
        this.dragState = {
            isPanning: false,
            isDraggingComp: false,
            isResizing: false,
            isRotating: false,
            resizeHandle: null,
            startX: 0,
            startY: 0,
            origComp: null,
            spaceDown: false
        };

        // Settings
        this.settings = {
            gridSize: 50,
            snapToGrid: false,
            showGrid: false,
            gridStyle: 'major-minor', // 'lines' | 'major-minor' | 'dots'
            gridOpacity: 0.35,
            bgOpacity: 0.85,
            bgBrightness: 100,
            bgContrast: 105,
            bgInvert: false,
            showBg: true,
            showTop: true,
            showBottom: true,
            showSilk: true,
            showDesignators: true, // Позиционные обозначения (R1, D2...)
            showValues: false, // Номиналы и модели (10k, TL072...)
            showPads: true,
            showPinLabels: false, // Маркировка выводов [1, 2.. / +, -]
            compStyle: 'realistic', // 'realistic' (объемный цветной) | 'cad' (контурный чертежный)
            compFillOpacity: 0.85 // Насыщенная заливка радиокомпонентов
        };

        this.pinoutTemplates = window.PINOUT_TEMPLATES || {};
        this.activeHighlightedNet = null; // Текущая подсвеченная цепь (например 'GND', '+5V', 'NET_RESET')
        this.activeOriginPin = null; // { compId, pinNum }
        this.netsDisplayMode = 'active'; // 'active' | 'all' | 'off'
        this.pinWorldPositions = new Map(); // "compId:pinNum" -> { x, y, compId, pinNum, netId, netName }
        this.currentNetFilterType = 'all';

        this.initDOM();
        this.loadProjectData();
        this.initEvents();
        this.setMode('view');
        
        // Accurate fit to center on startup
        this.fitToScreen();
        requestAnimationFrame(() => this.fitToScreen());
        setTimeout(() => this.fitToScreen(), 60);
        setTimeout(() => this.fitToScreen(), 250);

        this.render();
        this.updateComponentList();
        this.renderNetsList();
    }

    initDOM() {
        this.svg = document.getElementById('boardSvg');
        this.viewportContainer = document.getElementById('viewportContainer');
        this.worldGroup = document.getElementById('worldGroup');
        this.bgImage = document.getElementById('bgImage');
        this.gridLayer = document.getElementById('gridLayer');
        this.boardOutlineLayer = document.getElementById('boardOutlineLayer');
        this.componentsLayer = document.getElementById('componentsLayer');
        this.netsOverlayLayer = document.getElementById('netsOverlayLayer');
        this.overlayLayer = document.getElementById('overlayLayer');

        // Pin HUD Tooltip
        this.pinHudTooltip = document.getElementById('pinHudTooltip');

        // Sidebars
        this.leftSidebar = document.getElementById('leftSidebar');
        this.rightSidebar = document.getElementById('rightSidebar');

        // Lists & Inputs
        this.compListEl = document.getElementById('compList');
        this.searchInput = document.getElementById('searchInput');
        this.compCountBadge = document.getElementById('compCountBadge');

        // Nets UI elements
        this.tabNetsBtn = document.getElementById('tabNetsBtn');
        this.tabNets = document.getElementById('tabNets');
        this.netsListEl = document.getElementById('netsList');
        this.netsSearchInput = document.getElementById('netsSearchInput');
        this.netsCountBadge = document.getElementById('netsCountBadge');
        this.btnToggleNets = document.getElementById('btnToggleNets');

        // Mode elements
        this.btnModeView = document.getElementById('btnModeView');
        this.btnModeEdit = document.getElementById('btnModeEdit');
        this.editActionsGroup = document.getElementById('editActionsGroup');
        this.tabPaletteBtn = document.getElementById('tabPaletteBtn');
        this.modeBanner = document.getElementById('modeBanner');
        this.statusModeText = document.getElementById('statusModeText');

        // Component Tree UI elements
        this.treeSearchInput = document.getElementById('treeSearchInput');
        this.btnExpandAllTree = document.getElementById('btnExpandAllTree');
        this.btnCollapseAllTree = document.getElementById('btnCollapseAllTree');
        this.componentTree = document.getElementById('componentTree');

        // Inspector View-Mode elements
        this.viewInfoCard = document.getElementById('viewInfoCard');
        this.viewCardDesignator = document.getElementById('viewCardDesignator');
        this.viewCardValue = document.getElementById('viewCardValue');
        this.viewCardFootprint = document.getElementById('viewCardFootprint');
        this.viewCardLayer = document.getElementById('viewCardLayer');
        this.viewCardCoords = document.getElementById('viewCardCoords');
        this.viewCardNotes = document.getElementById('viewCardNotes');

        // Inspector Edit-Mode elements
        this.inspectorEditForm = document.getElementById('inspectorEditForm');
        this.inspLockBanner = document.getElementById('inspLockBanner');
        this.inspLockStatusText = document.getElementById('inspLockStatusText');
        this.btnToggleLockInsp = document.getElementById('btnToggleLockInsp');
        this.inspDesignator = document.getElementById('inspDesignator');
        this.inspValue = document.getElementById('inspValue');
        this.inspShowDesignator = document.getElementById('inspShowDesignator');
        this.inspShowValue = document.getElementById('inspShowValue');
        this.inspPreviewDesig = document.getElementById('inspPreviewDesig');
        this.inspPreviewVal = document.getElementById('inspPreviewVal');
        this.inspFootprintDropdown = document.getElementById('inspFootprintDropdown');
        this.btnInspFootprintTrigger = document.getElementById('btnInspFootprintTrigger');
        this.inspFootprintLabel = document.getElementById('inspFootprintLabel');
        this.inspTreeSearch = document.getElementById('inspTreeSearch');
        this.inspFootprintTree = document.getElementById('inspFootprintTree');
        this.inspLayer = document.getElementById('inspLayer');
        this.inspX = document.getElementById('inspX');
        this.inspY = document.getElementById('inspY');
        this.inspW = document.getElementById('inspW');
        this.inspH = document.getElementById('inspH');
        this.btnAspectLock = document.getElementById('btnAspectLock');
        this.aspectLockIcon = document.getElementById('aspectLockIcon');
        this.inspScaleValue = document.getElementById('inspScaleValue');
        this.inspScaleSlider = document.getElementById('inspScaleSlider');
        this.btnScaleDown = document.getElementById('btnScaleDown');
        this.btnScaleUp = document.getElementById('btnScaleUp');
        this.btnScaleReset = document.getElementById('btnScaleReset');
        this.inspRot = document.getElementById('inspRot');
        this.inspFontSize = document.getElementById('inspFontSize');
        this.inspFontSizeBadge = document.getElementById('inspFontSizeBadge');
        this.btnFontSizeDown = document.getElementById('btnFontSizeDown');
        this.btnFontSizeUp = document.getElementById('btnFontSizeUp');
        this.btnFontSizeAuto = document.getElementById('btnFontSizeAuto');
        this.inspNotes = document.getElementById('inspNotes');

        // Global Markings & Bulk Controls
        this.layerShowDesignatorsToggle = document.getElementById('layerShowDesignatorsToggle');
        this.layerShowValuesToggle = document.getElementById('layerShowValuesToggle');
        this.bulkCategorySelect = document.getElementById('bulkCategorySelect');
        this.btnBulkShowValues = document.getElementById('btnBulkShowValues');
        this.btnBulkHideValues = document.getElementById('btnBulkHideValues');
        this.btnBulkShowDesig = document.getElementById('btnBulkShowDesig');
        this.btnBulkHideDesig = document.getElementById('btnBulkHideDesig');

        // Resize Scope elements
        this.btnScopeSingle = document.getElementById('btnScopeSingle');
        this.btnScopeGroup = document.getElementById('btnScopeGroup');
        this.groupCompCountBadge = document.getElementById('groupCompCountBadge');
        this.scopeFootprintName = document.getElementById('scopeFootprintName');
        this.inspLockGroupResize = document.getElementById('inspLockGroupResize');

        // Quick toolbar
        this.quickBar = document.getElementById('quickTransformBar');
        this.quickName = document.getElementById('quickSelectedName');
        this.quickToggleLock = document.getElementById('quickToggleLock');
        this.quickFlipPolarity = document.getElementById('quickFlipPolarity');
        this.quickScaleDown = document.getElementById('quickScaleDown');
        this.quickScaleUp = document.getElementById('quickScaleUp');

        // Modals
        this.unsavedChangesModal = document.getElementById('unsavedChangesModal');

        // Right sidebar sections
        this.inspectorPanel = document.getElementById('inspectorPanel');
        this.layersSettingsSection = document.getElementById('layersSettingsSection');
        this.inspectorHeaderTitle = document.getElementById('inspectorHeaderTitle');
        this.btnDeselectRight = document.getElementById('btnDeselectRight');
        this.layerPinLabelsToggle = document.getElementById('layerPinLabelsToggle');

        // Status elements
        this.statusCoord = document.getElementById('statusCoord');
        this.statusZoom = document.getElementById('statusZoom');
        this.statusSelected = document.getElementById('statusSelected');
    }

    checkModified() {
        if (!this.lastSavedState) {
            this.isModified = false;
            return false;
        }
        this.isModified = JSON.stringify(this.components) !== this.lastSavedState;
        return this.isModified;
    }

    requestModeSwitch(targetMode) {
        if (targetMode === this.currentMode) return;
        this.checkModified();
        if (this.currentMode === 'edit' && targetMode === 'view' && this.isModified) {
            if (this.unsavedChangesModal) {
                this.unsavedChangesModal.classList.add('active');
                return;
            }
        }
        this.setMode(targetMode);
    }

    setMode(mode) {
        this.currentMode = mode;

        if (mode === 'view') {
            this.btnModeView.classList.add('active');
            this.btnModeEdit.classList.remove('active', 'edit-active');
            this.editActionsGroup.style.display = 'none';
            this.tabPaletteBtn.style.display = 'none';
            this.quickBar.classList.remove('visible');
            
            this.modeBanner.className = 'mode-banner view-mode';
            this.modeBanner.innerHTML = '<span>👁️ Только просмотр</span>';
            this.statusModeText.textContent = 'Режим: Только просмотр';

            // Switch to components tab if palette was open
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab && activeTab.id === 'tabPalette') {
                document.querySelectorAll('.sidebar-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.querySelector('.tab-btn[data-tab="tabComponents"]').classList.add('active');
                document.getElementById('tabComponents').classList.add('active');
            }
        } else {
            this.btnModeView.classList.remove('active');
            this.btnModeEdit.classList.add('active', 'edit-active');
            this.editActionsGroup.style.display = 'flex';
            this.tabPaletteBtn.style.display = 'block';

            this.modeBanner.className = 'mode-banner edit-mode';
            this.modeBanner.innerHTML = '<span>✏️ Редактирование CAD</span>';
            this.statusModeText.textContent = 'Режим: Редактирование';
        }

        // Re-synchronize selection state, transform box and quick actions toolbar
        if (this.selectedId && this.getSelectedComponent()) {
            this.selectComponent(this.selectedId);
        } else {
            this.selectedId = null;
            this.render();
            this.updateInspector();
            this.updateComponentListSelection();
            if (this.quickBar) this.quickBar.classList.remove('visible');
        }
    }

    loadProjectData() {
        try {
            const saved = localStorage.getItem('pirrs_boardview_data_v13') || localStorage.getItem('pirrs_boardview_data_v12');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.components && parsed.components.length > 0) {
                    this.components = parsed.components;
                }
            }
        } catch (e) {}

        if (!this.components || this.components.length === 0) {
            this.components = JSON.parse(JSON.stringify(this.initialComponents));
        }

        // Auto-migration: ensure all diodes have VD prefix and transistors have VT prefix
        const diodeMap = {
            'U2': 'VD2', 'V2': 'VD2',
            'U4': 'VD4', 'V4': 'VD4',
            'U5': 'VD5', 'V5': 'VD5',
            'U6': 'VD6', 'V6': 'VD6',
            'U8': 'VD8', 'V8': 'VD8',
            'U9': 'VD9', 'V9': 'VD9',
            'U17': 'VD17', 'V17': 'VD17',
            'V18': 'VD18',
            'V19': 'VD19',
            'V22': 'VD22',
            'V23': 'VD23'
        };

        const transistorMap = {
            'V1': 'VT1',
            'V3': 'VT3',
            'V5': 'VT5',
            'V6': 'VT6',
            'U7': 'VT7', 'V7': 'VT7',
            'U10': 'VT10', 'V10': 'VT10',
            'V11': 'VT11',
            'V13': 'VT13',
            'V14': 'VT14',
            'V15': 'VT15',
            'V16': 'VT16',
            'V20': 'VT20',
            'V21': 'VT21'
        };

        if (Array.isArray(this.components)) {
            this.components.forEach(c => {
                if (diodeMap[c.designator] || diodeMap[c.id]) {
                    const target = diodeMap[c.designator] || diodeMap[c.id];
                    c.id = target;
                    c.designator = target;
                } else if (transistorMap[c.designator] || transistorMap[c.id]) {
                    const target = transistorMap[c.designator] || transistorMap[c.id];
                    c.id = target;
                    c.designator = target;
                }
            });
        }

        const initialJson = JSON.stringify(this.components);
        this.history = [initialJson];
        this.historyIndex = 0;
        this.lastSavedState = initialJson;
        this.isModified = false;
        this.saveToStorage();
    }

    saveToStorage() {
        try {
            localStorage.setItem('pirrs_boardview_data_v13', JSON.stringify({
                version: '13.0',
                date: new Date().toISOString(),
                components: this.components
            }));
        } catch (e) {}
    }

    resetToDefaults() {
        if (confirm('Сбросить все элементы на точные позиции из заводского чертежа?')) {
            this.components = JSON.parse(JSON.stringify(this.initialComponents));
            this.selectComponent(null);
            this.saveHistory();
            this.render();
            this.updateComponentList();
            this.fitToScreen();
        }
    }

    saveHistory() {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        const currentJson = JSON.stringify(this.components);
        this.history.push(currentJson);
        if (this.history.length > 30) this.history.shift();
        this.historyIndex = this.history.length - 1;
        this.checkModified();
        this.saveToStorage();
    }

    undo() {
        if (this.currentMode !== 'edit') return;
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.components = JSON.parse(this.history[this.historyIndex]);
            this.checkModified();
            this.render();
            this.updateInspector();
            this.updateComponentList();
            this.saveToStorage();
        }
    }

    redo() {
        if (this.currentMode !== 'edit') return;
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.components = JSON.parse(this.history[this.historyIndex]);
            this.checkModified();
            this.render();
            this.updateInspector();
            this.updateComponentList();
            this.saveToStorage();
        }
    }

    toggleLockSelected() {
        if (this.currentMode !== 'edit') return;
        const comp = this.getSelectedComponent();
        if (!comp) return;
        comp.locked = !comp.locked;
        this.render();
        this.updateInspector();
        this.saveHistory();
        this.updateComponentList();
    }

    getGroupComponents(comp) {
        if (!comp || !comp.footprint) return [];
        return this.components.filter(c => c.footprint === comp.footprint && !c.locked && !c.lockGroupResize);
    }

    getAllGroupComponents(comp) {
        if (!comp || !comp.footprint) return [];
        return this.components.filter(c => c.footprint === comp.footprint);
    }

    setResizeScope(scope) {
        this.resizeScope = scope;
        if (this.btnScopeSingle) this.btnScopeSingle.classList.toggle('active', scope === 'single');
        if (this.btnScopeGroup) this.btnScopeGroup.classList.toggle('active', scope === 'group');

        // При переключении на режим группы сразу синхронизируем размеры группы с выбранным элементом
        if (scope === 'group') {
            const comp = this.getSelectedComponent();
            if (comp && !comp.locked) {
                const groupComps = this.getGroupComponents(comp);
                let changed = false;
                groupComps.forEach(c => {
                    if (c.id === comp.id) return;
                    if (c.width !== comp.width || c.height !== comp.height) {
                        const cx = c.x + c.width / 2;
                        const cy = c.y + c.height / 2;
                        c.width = comp.width;
                        c.height = comp.height;
                        c.x = Math.round(cx - comp.width / 2);
                        c.y = Math.round(cy - comp.height / 2);
                        changed = true;
                    }
                });
                if (changed) {
                    this.render();
                    this.saveHistory();
                }
            }
        }
        this.updateInspector();
    }

    scaleSelected(factor) {
        if (this.currentMode !== 'edit') return;
        const comp = this.getSelectedComponent();
        if (!comp || comp.locked) return;

        const cx = comp.x + comp.width / 2;
        const cy = comp.y + comp.height / 2;
        const newW = Math.max(20, Math.round(comp.width * factor));
        const newH = Math.max(20, Math.round(comp.height * factor));
        comp.width = newW;
        comp.height = newH;
        comp.x = Math.round(cx - newW / 2);
        comp.y = Math.round(cy - newH / 2);

        if (this.resizeScope === 'group') {
            const groupComps = this.getGroupComponents(comp);
            groupComps.forEach(c => {
                if (c.id === comp.id) return;
                const cCx = c.x + c.width / 2;
                const cCy = c.y + c.height / 2;
                c.width = newW;
                c.height = newH;
                c.x = Math.round(cCx - newW / 2);
                c.y = Math.round(cCy - newH / 2);
            });
        }

        this.render();
        this.updateInspector();
        this.saveHistory();
    }

    setScalePercent(percent) {
        if (this.currentMode !== 'edit') return;
        const comp = this.getSelectedComponent();
        if (!comp || comp.locked) return;
        const tpl = this.footprintTemplates[comp.footprint];
        const factor = Math.max(0.1, percent / 100);
        const baseW = (tpl && tpl.width) ? tpl.width : comp.width;
        const baseH = (tpl && tpl.height) ? tpl.height : comp.height;
        const newW = Math.max(20, Math.round(baseW * factor));
        const newH = Math.max(20, Math.round(baseH * factor));
        const cx = comp.x + comp.width / 2;
        const cy = comp.y + comp.height / 2;
        comp.width = newW;
        comp.height = newH;
        comp.x = Math.round(cx - newW / 2);
        comp.y = Math.round(cy - newH / 2);

        if (this.resizeScope === 'group') {
            const groupComps = this.getGroupComponents(comp);
            groupComps.forEach(c => {
                if (c.id === comp.id) return;
                const cCx = c.x + c.width / 2;
                const cCy = c.y + c.height / 2;
                c.width = newW;
                c.height = newH;
                c.x = Math.round(cCx - newW / 2);
                c.y = Math.round(cCy - newH / 2);
            });
        }

        this.render();
        this.updateInspector();
        this.saveHistory();
    }

    toggleAspectLock() {
        this.aspectRatioLocked = !this.aspectRatioLocked;
        if (this.btnAspectLock) {
            this.btnAspectLock.classList.toggle('active', this.aspectRatioLocked);
        }
        if (this.aspectLockIcon) {
            this.aspectLockIcon.textContent = this.aspectRatioLocked ? '🔒' : '🔓';
        }
    }

    initEvents() {
        window.addEventListener('resize', () => {
            this.fitToScreen();
        });

        // Mode switch buttons with unsaved changes verification
        this.btnModeView.addEventListener('click', () => this.requestModeSwitch('view'));
        this.btnModeEdit.addEventListener('click', () => this.requestModeSwitch('edit'));

        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }
            if (e.code === 'Escape') {
                this.selectComponent(null);
                e.preventDefault();
            } else if (e.code === 'Space') {
                this.dragState.spaceDown = true;
                if (this.viewportContainer) this.viewportContainer.style.cursor = 'grab';
                e.preventDefault();
            } else if (e.code === 'Tab') {
                this.toggleAllSidebars();
                e.preventDefault();
            } else if (e.code === 'KeyF') {
                this.fitToScreen();
                e.preventDefault();
            } else if (this.currentMode === 'edit') {
                const comp = this.getSelectedComponent();
                if (e.code === 'KeyL') {
                    this.toggleLockSelected();
                    e.preventDefault();
                } else if (e.code === 'KeyP') {
                    if (comp && !comp.locked) {
                        this.flipSelectedPolarity();
                    }
                    e.preventDefault();
                } else if ((e.code === 'BracketLeft' || e.key === '[') && (e.ctrlKey || e.metaKey)) {
                    this.scaleSelected(0.90);
                    e.preventDefault();
                } else if ((e.code === 'BracketRight' || e.key === ']') && (e.ctrlKey || e.metaKey)) {
                    this.scaleSelected(1.10);
                    e.preventDefault();
                } else if (e.code === 'KeyR') {
                    if (comp && !comp.locked) {
                        if (e.shiftKey) this.rotateSelected(-45);
                        else this.rotateSelected(45);
                    }
                    e.preventDefault();
                } else if (e.code === 'Delete' || e.code === 'Backspace') {
                    if (comp && !comp.locked) {
                        this.deleteSelected();
                    }
                    e.preventDefault();
                } else if (e.code === 'KeyD' && (e.ctrlKey || e.metaKey)) {
                    this.duplicateSelected();
                    e.preventDefault();
                } else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
                    if (e.shiftKey) this.redo();
                    else this.undo();
                    e.preventDefault();
                } else if (e.key && e.key.startsWith('Arrow') && this.selectedId) {
                    if (comp && !comp.locked) {
                        const delta = e.shiftKey ? 50 : 10;
                        if (e.key === 'ArrowLeft') comp.x -= delta;
                        if (e.key === 'ArrowRight') comp.x += delta;
                        if (e.key === 'ArrowUp') comp.y -= delta;
                        if (e.key === 'ArrowDown') comp.y += delta;
                        this.render();
                        this.updateInspector();
                        this.saveHistory();
                    }
                    e.preventDefault();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.dragState.spaceDown = false;
                if (this.viewportContainer) this.viewportContainer.style.cursor = 'default';
            }
        });

        if (this.viewportContainer) {
            this.viewportContainer.addEventListener('mousedown', (e) => this.onMouseDown(e));
            this.viewportContainer.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

            // Interactive Pin Hover & Net Highlighting
            this.viewportContainer.addEventListener('mousemove', (e) => {
                const pad = e.target.closest('.comp-pin-pad');
                if (pad) {
                    const compId = pad.dataset.compId;
                    const pinNum = parseInt(pad.dataset.pinNum);
                    const comp = this.components.find(c => c.id === compId);
                    if (comp) {
                        this.showPinTooltip(comp, pinNum, e.clientX, e.clientY);
                        this.highlightPinInTable(pinNum);
                        return;
                    }
                }
                this.hidePinTooltip();
                this.clearPinTableHighlight();
            });

            this.viewportContainer.addEventListener('mouseleave', () => {
                this.hidePinTooltip();
                this.clearPinTableHighlight();
            });

            this.viewportContainer.addEventListener('click', (e) => {
                const pad = e.target.closest('.comp-pin-pad');
                if (pad) {
                    const compId = pad.dataset.compId;
                    const pinNum = parseInt(pad.dataset.pinNum);
                    const comp = this.components.find(c => c.id === compId);
                    if (comp) {
                        const netObj = window.NETS_MANAGER ? window.NETS_MANAGER.getNetForPin(compId, pinNum) : null;
                        const info = this.getComponentPinInfo(comp, pinNum);
                        const netId = netObj ? netObj.id : (info.net || null);
                        if (netId) {
                            if (this.activeHighlightedNet && (this.activeHighlightedNet === netId || this.activeHighlightedNet.toLowerCase() === netId.toLowerCase())) {
                                this.highlightNet(null);
                            } else {
                                this.highlightNet(netId, { compId, pinNum });
                            }
                        } else {
                            this.highlightNet(null);
                        }
                        this.updateInspector();
                    }
                } else if (!e.target.closest('.board-component') && !e.target.closest('.transform-box')) {
                    // Клик в пустое место платы - сброс подсветки связей
                    if (this.activeHighlightedNet) {
                        this.highlightNet(null);
                    }
                }
            });
        }
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));

        // Nets Toolbar Button & Filter Handlers
        if (this.btnToggleNets) {
            this.btnToggleNets.addEventListener('click', () => {
                if (this.netsDisplayMode === 'active') {
                    this.netsDisplayMode = 'all';
                    this.btnToggleNets.classList.add('btn-nets-active');
                    this.btnToggleNets.title = 'Режим связей: Все цепи платы (Клик: выключить)';
                } else if (this.netsDisplayMode === 'all') {
                    this.netsDisplayMode = 'off';
                    this.btnToggleNets.classList.remove('btn-nets-active');
                    this.btnToggleNets.title = 'Режим связей: Выключено (Клик: включить активную)';
                } else {
                    this.netsDisplayMode = 'active';
                    this.btnToggleNets.classList.remove('btn-nets-active');
                    this.btnToggleNets.title = 'Режим связей: Только выбранная цепь (Клик: все цепи)';
                }
                this.renderNetsOverlay();
            });
        }

        if (this.netsSearchInput) {
            this.netsSearchInput.addEventListener('input', () => this.renderNetsList());
        }

        document.querySelectorAll('.filter-pills .pill[data-net-type]').forEach(pill => {
            pill.addEventListener('click', () => {
                document.querySelectorAll('.filter-pills .pill[data-net-type]').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.currentNetFilterType = pill.dataset.netType || 'all';
                this.renderNetsList();
            });
        });

        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.updateComponentList());
        }

        document.querySelectorAll('.filter-pills .pill').forEach(pill => {
            pill.addEventListener('click', () => {
                document.querySelectorAll('.filter-pills .pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.updateComponentList();
            });
        });

        document.querySelectorAll('.sidebar-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                document.querySelectorAll('.sidebar-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const targetEl = document.getElementById(targetTab);
                if (targetEl) targetEl.classList.add('active');
            });
        });

        const bindInspInput = (el, prop, isNum = false) => {
            if (!el) return;
            el.addEventListener('input', () => {
                const comp = this.getSelectedComponent();
                if (!comp || comp.locked) return;
                comp[prop] = isNum ? parseFloat(el.value) || 0 : el.value;
                if (prop === 'designator' && this.inspPreviewDesig) {
                    this.inspPreviewDesig.textContent = el.value || '-';
                }
                if (prop === 'value' && this.inspPreviewVal) {
                    this.inspPreviewVal.textContent = el.value || 'номинал';
                }
                this.render();
            });
            el.addEventListener('change', () => this.saveHistory());
        };

        bindInspInput(this.inspDesignator, 'designator');
        bindInspInput(this.inspValue, 'value');
        bindInspInput(this.inspLayer, 'layer');
        bindInspInput(this.inspX, 'x', true);
        bindInspInput(this.inspY, 'y', true);
        bindInspInput(this.inspRot, 'rotation', true);
        bindInspInput(this.inspNotes, 'notes');

        // Width & Height inputs with Aspect Ratio Lock and Group Scope support
        if (this.inspW) {
            this.inspW.addEventListener('input', () => {
                const comp = this.getSelectedComponent();
                if (!comp || comp.locked) return;
                const oldW = comp.width || 100;
                const oldH = comp.height || 100;
                const newW = parseFloat(this.inspW.value) || 20;
                const cx = comp.x + oldW / 2;
                const cy = comp.y + oldH / 2;
                comp.width = newW;
                let newH = oldH;
                if (this.aspectRatioLocked && oldW > 0) {
                    const ratio = oldH / oldW;
                    newH = Math.round(newW * ratio);
                    comp.height = newH;
                    if (this.inspH) this.inspH.value = newH;
                }
                comp.x = Math.round(cx - newW / 2);
                comp.y = Math.round(cy - (comp.height || oldH) / 2);

                if (this.resizeScope === 'group') {
                    const groupComps = this.getGroupComponents(comp);
                    groupComps.forEach(c => {
                        if (c.id === comp.id) return;
                        const cCx = c.x + c.width / 2;
                        const cCy = c.y + c.height / 2;
                        c.width = comp.width;
                        c.height = comp.height;
                        c.x = Math.round(cCx - comp.width / 2);
                        c.y = Math.round(cCy - comp.height / 2);
                    });
                }
                this.render();
            });
            this.inspW.addEventListener('change', () => this.saveHistory());
        }

        if (this.inspH) {
            this.inspH.addEventListener('input', () => {
                const comp = this.getSelectedComponent();
                if (!comp || comp.locked) return;
                const oldW = comp.width || 100;
                const oldH = comp.height || 100;
                const newH = parseFloat(this.inspH.value) || 20;
                const cx = comp.x + oldW / 2;
                const cy = comp.y + oldH / 2;
                comp.height = newH;
                let newW = oldW;
                if (this.aspectRatioLocked && oldH > 0) {
                    const ratio = oldW / oldH;
                    newW = Math.round(newH * ratio);
                    comp.width = newW;
                    if (this.inspW) this.inspW.value = newW;
                }
                comp.x = Math.round(cx - (comp.width || oldW) / 2);
                comp.y = Math.round(cy - newH / 2);

                if (this.resizeScope === 'group') {
                    const groupComps = this.getGroupComponents(comp);
                    groupComps.forEach(c => {
                        if (c.id === comp.id) return;
                        const cCx = c.x + c.width / 2;
                        const cCy = c.y + c.height / 2;
                        c.width = comp.width;
                        c.height = comp.height;
                        c.x = Math.round(cCx - comp.width / 2);
                        c.y = Math.round(cCy - comp.height / 2);
                    });
                }
                this.render();
            });
            this.inspH.addEventListener('change', () => this.saveHistory());
        }

        // Resize Scope Buttons
        if (this.btnScopeSingle) {
            this.btnScopeSingle.addEventListener('click', () => this.setResizeScope('single'));
        }
        if (this.btnScopeGroup) {
            this.btnScopeGroup.addEventListener('click', () => this.setResizeScope('group'));
        }

        // Individual Label & Value Checkboxes for selected component
        if (this.inspShowDesignator) {
            this.inspShowDesignator.addEventListener('change', (e) => {
                const comp = this.getSelectedComponent();
                if (!comp || comp.locked) return;
                comp.showDesignator = e.target.checked;
                this.render();
                this.saveHistory();
            });
        }
        if (this.inspShowValue) {
            this.inspShowValue.addEventListener('change', (e) => {
                const comp = this.getSelectedComponent();
                if (!comp || comp.locked) return;
                comp.showValue = e.target.checked;
                this.render();
                this.saveHistory();
            });
        }

        // Lock Group Resize Checkbox for selected component
        if (this.inspLockGroupResize) {
            this.inspLockGroupResize.addEventListener('change', (e) => {
                const comp = this.getSelectedComponent();
                if (!comp || comp.locked) return;
                comp.lockGroupResize = e.target.checked;
                this.updateInspector();
                this.updateComponentList();
                this.saveHistory();
            });
        }

        // Scale and Aspect Lock Buttons
        if (this.btnAspectLock) this.btnAspectLock.addEventListener('click', () => this.toggleAspectLock());
        if (this.btnScaleDown) this.btnScaleDown.addEventListener('click', () => this.scaleSelected(0.95));
        if (this.btnScaleUp) this.btnScaleUp.addEventListener('click', () => this.scaleSelected(1.05));
        if (this.btnScaleReset) this.btnScaleReset.addEventListener('click', () => this.setScalePercent(100));
        if (this.inspScaleSlider) this.inspScaleSlider.addEventListener('input', (e) => this.setScalePercent(parseFloat(e.target.value) || 100));

        // Font Size Controls
        if (this.inspFontSize) {
            this.inspFontSize.addEventListener('input', (e) => {
                const val = e.target.value;
                this.setFontSizeSelected(val);
            });
            this.inspFontSize.addEventListener('change', () => this.saveHistory());
        }
        if (this.btnFontSizeDown) {
            this.btnFontSizeDown.addEventListener('click', () => this.stepFontSizeSelected(-2));
        }
        if (this.btnFontSizeUp) {
            this.btnFontSizeUp.addEventListener('click', () => this.stepFontSizeSelected(2));
        }
        if (this.btnFontSizeAuto) {
            this.btnFontSizeAuto.addEventListener('click', () => this.setFontSizeSelected(null));
        }

        // Lock toggles
        if (this.btnToggleLockInsp) this.btnToggleLockInsp.addEventListener('click', () => this.toggleLockSelected());
        if (this.quickToggleLock) this.quickToggleLock.addEventListener('click', () => this.toggleLockSelected());
        if (this.btnDeselectRight) this.btnDeselectRight.addEventListener('click', () => this.selectComponent(null));

        // Quick bar scale
        if (this.quickScaleDown) this.quickScaleDown.addEventListener('click', () => this.scaleSelected(0.90));
        if (this.quickScaleUp) this.quickScaleUp.addEventListener('click', () => this.scaleSelected(1.10));

        this.initBgControls();
        this.initInspectorFootprintTreeDropdown();
        this.initTreeEvents();
        this.renderTree();
        this.initSaveModal();
        this.initUnsavedChangesModal();

        // View Toggles
        const btnFitBoard = document.getElementById('btnFitBoard');
        if (btnFitBoard) {
            btnFitBoard.addEventListener('click', () => this.fitToScreen());
        }

        const btnTogglePanels = document.getElementById('btnTogglePanels');
        if (btnTogglePanels) {
            btnTogglePanels.addEventListener('click', () => this.toggleAllSidebars());
        }

        const btnToggleGrid = document.getElementById('btnToggleGrid');
        if (btnToggleGrid) {
            btnToggleGrid.addEventListener('click', () => {
                this.settings.showGrid = !this.settings.showGrid;
                btnToggleGrid.classList.toggle('btn-primary', this.settings.showGrid);
                const lGrid = document.getElementById('layerGridToggle');
                if (lGrid) lGrid.checked = this.settings.showGrid;
                this.renderGrid();
            });
        }

        const btnToggleSnap = document.getElementById('btnToggleSnap');
        if (btnToggleSnap) {
            btnToggleSnap.addEventListener('click', () => {
                this.settings.snapToGrid = !this.settings.snapToGrid;
                btnToggleSnap.classList.toggle('btn-primary', this.settings.snapToGrid);
                const snapChk = document.getElementById('snapToGridToggle');
                if (snapChk) snapChk.checked = this.settings.snapToGrid;
            });
        }

        const btnReset = document.getElementById('btnResetDefault');
        if (btnReset) btnReset.addEventListener('click', () => this.resetToDefaults());

        const btnSaveToDb = document.getElementById('btnSaveToDb');
        if (btnSaveToDb) btnSaveToDb.addEventListener('click', () => this.openSaveModal());

        const btnExportJson = document.getElementById('btnExportJson');
        if (btnExportJson) btnExportJson.addEventListener('click', () => this.exportJSON());

        const btnExportSvg = document.getElementById('btnExportSvg');
        if (btnExportSvg) btnExportSvg.addEventListener('click', () => this.exportSVG());

        if (this.quickBar) {
            this.quickBar.addEventListener('mousedown', (e) => e.stopPropagation());
            this.quickBar.addEventListener('click', (e) => e.stopPropagation());
        }

        const qrL = document.getElementById('quickRotateLeft');
        if (qrL) qrL.addEventListener('click', () => this.rotateSelected(-45));

        const qrR = document.getElementById('quickRotateRight');
        if (qrR) qrR.addEventListener('click', () => this.rotateSelected(45));

        const qr90 = document.getElementById('quickRotate90');
        if (qr90) qr90.addEventListener('click', () => this.rotateSelected(90));

        const qFlip = document.getElementById('quickFlipLayer');
        if (qFlip) qFlip.addEventListener('click', () => this.toggleSelectedLayer());

        if (this.quickFlipPolarity) {
            this.quickFlipPolarity.addEventListener('click', () => this.flipSelectedPolarity());
        }

        const qDup = document.getElementById('quickDuplicate');
        if (qDup) qDup.addEventListener('click', () => this.duplicateSelected());

        const qReset = document.getElementById('quickResetComp');
        if (qReset) qReset.addEventListener('click', () => this.resetSelectedToDefaults());

        const qDel = document.getElementById('quickDelete');
        if (qDel) qDel.addEventListener('click', () => this.deleteSelected());

        const btnResetInsp = document.getElementById('btnResetCompInsp');
        if (btnResetInsp) btnResetInsp.addEventListener('click', () => this.resetSelectedToDefaults());

        const btnDelInsp = document.getElementById('btnDeleteCompInsp');
        if (btnDelInsp) btnDelInsp.addEventListener('click', () => this.deleteSelected());
    }

    initUnsavedChangesModal() {
        const btnCancel = document.getElementById('btnCancelUnsavedModal');
        const btnClose = document.getElementById('btnCloseUnsavedModal');
        const btnDiscard = document.getElementById('btnDiscardToViewModal');
        const btnSaveExit = document.getElementById('btnSaveAndExitModal');

        const closeModal = () => {
            if (this.unsavedChangesModal) this.unsavedChangesModal.classList.remove('active');
        };

        if (btnCancel) btnCancel.addEventListener('click', closeModal);
        if (btnClose) btnClose.addEventListener('click', closeModal);

        if (btnDiscard) {
            btnDiscard.addEventListener('click', () => {
                closeModal();
                this.setMode('view');
            });
        }

        if (btnSaveExit) {
            btnSaveExit.addEventListener('click', () => {
                closeModal();
                this.openSaveModal();
                this.setMode('view');
            });
        }

        window.addEventListener('beforeunload', (e) => {
            if (this.checkModified()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    initSaveModal() {
        const modal = document.getElementById('saveDbModal');
        const closeBtn = document.getElementById('btnCloseModal');
        const okBtn = document.getElementById('btnOkModal');
        const copyBtn = document.getElementById('btnCopyDbCode');
        const downloadBtn = document.getElementById('btnDownloadDbFile');

        if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
        if (okBtn) okBtn.addEventListener('click', () => modal.classList.remove('active'));

        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const codeArea = document.getElementById('dbExportCode');
                codeArea.select();
                document.execCommand('copy');
                alert('Код components_db.js скопирован в буфер обмена!');
            });
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                const code = this.generateComponentsDbCode();
                const blob = new Blob([code], { type: 'text/javascript;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'components_db.js';
                a.click();
                URL.revokeObjectURL(url);
            });
        }
    }

    openSaveModal() {
        this.saveHistory();
        this.lastSavedState = JSON.stringify(this.components);
        this.isModified = false;
        const modal = document.getElementById('saveDbModal');
        const codeArea = document.getElementById('dbExportCode');
        codeArea.value = this.generateComponentsDbCode();
        modal.classList.add('active');
    }

    generateComponentsDbCode() {
        return `// components_db.js - Многоуровневая база данных радиокомпонентов и геометрии платы Пиррс 1000 Люкс

const BOARD_META = ${JSON.stringify(this.boardMeta, null, 4)};

const FOOTPRINT_LIBRARY = ${JSON.stringify(this.footprintTemplates, null, 4)};

const COMPONENT_PRESETS = ${JSON.stringify(this.componentPresets, null, 4)};

const COMPONENT_CATALOG_TREE = ${JSON.stringify(this.catalogTree, null, 4)};

const INITIAL_COMPONENTS = ${JSON.stringify(this.components, null, 4)};

window.BOARD_META = BOARD_META;
const FOOTPRINT_TEMPLATES = FOOTPRINT_LIBRARY;
window.FOOTPRINT_LIBRARY = FOOTPRINT_LIBRARY;
window.FOOTPRINT_TEMPLATES = FOOTPRINT_TEMPLATES;
window.COMPONENT_PRESETS = COMPONENT_PRESETS;
window.COMPONENT_CATALOG_TREE = COMPONENT_CATALOG_TREE;
window.INITIAL_COMPONENTS = INITIAL_COMPONENTS;
`;
    }

    toggleAllSidebars() {
        if (!this.leftSidebar || !this.rightSidebar) return;
        const isCollapsed = this.leftSidebar.classList.contains('collapsed');
        this.leftSidebar.classList.toggle('collapsed', !isCollapsed);
        this.rightSidebar.classList.toggle('collapsed', !isCollapsed);
        const btn = document.getElementById('btnTogglePanels');
        if (btn) btn.classList.toggle('active', isCollapsed);
        setTimeout(() => this.fitToScreen(), 220);
    }

    initBgControls() {
        const compStyleSelect = document.getElementById('compStyleSelect');
        const compFillOpacitySlider = document.getElementById('compFillOpacity');
        const compFillOpacityVal = document.getElementById('compFillOpacityVal');

        const bgOpacitySlider = document.getElementById('bgOpacity');
        const bgOpacityVal = document.getElementById('bgOpacityVal');
        const bgBrightnessSlider = document.getElementById('bgBrightness');
        const bgBrightnessVal = document.getElementById('bgBrightnessVal');
        const bgContrastSlider = document.getElementById('bgContrast');
        const bgContrastVal = document.getElementById('bgContrastVal');
        const bgInvertCheck = document.getElementById('bgInvert');

        if (compStyleSelect) {
            compStyleSelect.addEventListener('change', (e) => {
                this.settings.compStyle = e.target.value;
                this.render();
            });
        }

        if (compFillOpacitySlider) {
            compFillOpacitySlider.addEventListener('input', (e) => {
                this.settings.compFillOpacity = parseFloat(e.target.value);
                if (compFillOpacityVal) compFillOpacityVal.textContent = `${Math.round(this.settings.compFillOpacity * 100)}%`;
                this.render();
            });
        }

        const updateBgFilters = () => {
            if (!this.bgImage) return;
            const invert = this.settings.bgInvert ? 'invert(100%) hue-rotate(180deg)' : '';
            this.bgImage.style.filter = `brightness(${this.settings.bgBrightness}%) contrast(${this.settings.bgContrast}%) ${invert}`;
            this.bgImage.style.opacity = this.settings.showBg ? this.settings.bgOpacity : 0;
        };

        if (bgOpacitySlider) {
            bgOpacitySlider.addEventListener('input', (e) => {
                this.settings.bgOpacity = parseFloat(e.target.value);
                if (bgOpacityVal) bgOpacityVal.textContent = `${Math.round(this.settings.bgOpacity * 100)}%`;
                updateBgFilters();
            });
        }

        if (bgBrightnessSlider) {
            bgBrightnessSlider.addEventListener('input', (e) => {
                this.settings.bgBrightness = parseInt(e.target.value);
                if (bgBrightnessVal) bgBrightnessVal.textContent = `${this.settings.bgBrightness}%`;
                updateBgFilters();
            });
        }

        if (bgContrastSlider) {
            bgContrastSlider.addEventListener('input', (e) => {
                this.settings.bgContrast = parseInt(e.target.value);
                if (bgContrastVal) bgContrastVal.textContent = `${this.settings.bgContrast}%`;
                updateBgFilters();
            });
        }

        if (bgInvertCheck) {
            bgInvertCheck.addEventListener('change', (e) => {
                this.settings.bgInvert = e.target.checked;
                updateBgFilters();
            });
        }

        const lBg = document.getElementById('layerBgToggle');
        if (lBg) lBg.addEventListener('change', (e) => { this.settings.showBg = e.target.checked; updateBgFilters(); });

        const lGrid = document.getElementById('layerGridToggle');
        if (lGrid) {
            lGrid.checked = this.settings.showGrid;
            lGrid.addEventListener('change', (e) => {
                this.settings.showGrid = e.target.checked;
                const btnToggleGrid = document.getElementById('btnToggleGrid');
                if (btnToggleGrid) btnToggleGrid.classList.toggle('btn-primary', this.settings.showGrid);
                this.renderGrid();
            });
        }

        const gridSizeSelect = document.getElementById('gridSizeSelect');
        if (gridSizeSelect) {
            gridSizeSelect.value = String(this.settings.gridSize);
            gridSizeSelect.addEventListener('change', (e) => {
                this.settings.gridSize = parseInt(e.target.value) || 50;
                this.renderGrid();
            });
        }

        const gridStyleSelect = document.getElementById('gridStyleSelect');
        if (gridStyleSelect) {
            gridStyleSelect.value = this.settings.gridStyle;
            gridStyleSelect.addEventListener('change', (e) => {
                this.settings.gridStyle = e.target.value;
                this.renderGrid();
            });
        }

        const gridOpacitySlider = document.getElementById('gridOpacity');
        const gridOpacityVal = document.getElementById('gridOpacityVal');
        if (gridOpacitySlider) {
            gridOpacitySlider.value = String(this.settings.gridOpacity);
            if (gridOpacityVal) gridOpacityVal.textContent = `${Math.round(this.settings.gridOpacity * 100)}%`;
            gridOpacitySlider.addEventListener('input', (e) => {
                this.settings.gridOpacity = parseFloat(e.target.value) || 0.35;
                if (gridOpacityVal) gridOpacityVal.textContent = `${Math.round(this.settings.gridOpacity * 100)}%`;
                this.renderGrid();
            });
        }

        const snapToGridToggle = document.getElementById('snapToGridToggle');
        if (snapToGridToggle) {
            snapToGridToggle.checked = this.settings.snapToGrid;
            snapToGridToggle.addEventListener('change', (e) => {
                this.settings.snapToGrid = e.target.checked;
                const btnToggleSnap = document.getElementById('btnToggleSnap');
                if (btnToggleSnap) btnToggleSnap.classList.toggle('btn-primary', this.settings.snapToGrid);
            });
        }

        const lTop = document.getElementById('layerTopToggle');
        if (lTop) lTop.addEventListener('change', (e) => { this.settings.showTop = e.target.checked; this.render(); });
        const lBot = document.getElementById('layerBottomToggle');
        if (lBot) lBot.addEventListener('change', (e) => { this.settings.showBottom = e.target.checked; this.render(); });

        const lSilk = document.getElementById('layerSilkToggle');
        if (lSilk) lSilk.addEventListener('change', (e) => { this.settings.showSilk = e.target.checked; this.render(); });

        const lPads = document.getElementById('layerPadsToggle');
        if (lPads) lPads.addEventListener('change', (e) => { this.settings.showPads = e.target.checked; this.render(); });

        const lPins = document.getElementById('layerPinLabelsToggle');
        if (lPins) lPins.addEventListener('change', (e) => { this.settings.showPinLabels = e.target.checked; this.render(); });

        if (this.btnBulkShowValues) {
            this.btnBulkShowValues.addEventListener('click', () => {
                const cat = this.bulkCategorySelect ? this.bulkCategorySelect.value : 'all';
                this.setBulkLabelVisibility('value', true, cat);
            });
        }
        if (this.btnBulkHideValues) {
            this.btnBulkHideValues.addEventListener('click', () => {
                const cat = this.bulkCategorySelect ? this.bulkCategorySelect.value : 'all';
                this.setBulkLabelVisibility('value', false, cat);
            });
        }
        if (this.btnBulkShowDesig) {
            this.btnBulkShowDesig.addEventListener('click', () => {
                const cat = this.bulkCategorySelect ? this.bulkCategorySelect.value : 'all';
                this.setBulkLabelVisibility('designator', true, cat);
            });
        }
        if (this.btnBulkHideDesig) {
            this.btnBulkHideDesig.addEventListener('click', () => {
                const cat = this.bulkCategorySelect ? this.bulkCategorySelect.value : 'all';
                this.setBulkLabelVisibility('designator', false, cat);
            });
        }

        updateBgFilters();
    }

    setBulkLabelVisibility(type, visible, category = 'all') {
        let changedCount = 0;
        this.components.forEach(comp => {
            if (category !== 'all') {
                const compCat = comp.category || (this.footprintTemplates[comp.footprint] ? this.footprintTemplates[comp.footprint].category : '');
                if (compCat !== category) return;
            }

            if (type === 'value') {
                comp.showValue = visible;
                changedCount++;
            } else if (type === 'designator') {
                comp.showDesignator = visible;
                changedCount++;
            }
        });

        this.render();
        this.updateInspector();
        this.saveHistory();
    }

    initTreeEvents() {
        if (this.treeSearchInput) {
            this.treeSearchInput.addEventListener('input', (e) => {
                this.filterTree((e.target.value || '').trim().toLowerCase());
            });
        }

        if (this.btnExpandAllTree) {
            this.btnExpandAllTree.addEventListener('click', () => this.expandAllTree());
        }

        if (this.btnCollapseAllTree) {
            this.btnCollapseAllTree.addEventListener('click', () => this.collapseAllTree());
        }
    }

    renderTree() {
        if (!this.componentTree) return;
        this.componentTree.innerHTML = '';

        this.catalogTree.forEach(category => {
            const catNode = document.createElement('div');
            catNode.className = 'tree-node';

            const catHeader = document.createElement('div');
            catHeader.className = 'tree-header folder-header category-root';
            catHeader.innerHTML = `
                <span class="tree-toggle">▶</span>
                <span class="tree-icon">${category.icon || '📁'}</span>
                <span class="tree-label">${category.name}</span>
            `;

            const catChildren = document.createElement('div');
            catChildren.className = 'tree-children';

            catHeader.addEventListener('click', () => {
                catNode.classList.toggle('expanded');
            });

            // Обработка подкатегорий
            category.subcategories.forEach(subcat => {
                // Собираем все дочерние элементы этой подкатегории
                const fpItems = [];
                subcat.footprints.forEach(fpKey => {
                    const tpl = this.footprintTemplates[fpKey];
                    if (!tpl) return;
                    const presetsForFp = Object.entries(this.componentPresets).filter(([k, pr]) => pr.footprint === fpKey);
                    fpItems.push({ fpKey, tpl, presets: presetsForFp });
                });

                // Если в подкатегории ровно 1 корпус и у него нет дополнительных моделей — отображаем напрямую
                if (fpItems.length === 1 && fpItems[0].presets.length === 0) {
                    const item = fpItems[0];
                    const leafNode = document.createElement('div');
                    leafNode.className = 'tree-node';
                    leafNode.dataset.search = `${category.name} ${subcat.name} ${item.fpKey} ${item.tpl.name}`.toLowerCase();

                    const leafHeader = document.createElement('div');
                    leafHeader.className = 'tree-header leaf-item';
                    leafHeader.innerHTML = `
                        <span class="tree-toggle empty-toggle"></span>
                        <span class="tree-icon">📄</span>
                        <span class="tree-label">${item.tpl.name || item.fpKey}</span>
                    `;
                    leafHeader.addEventListener('click', () => {
                        if (this.currentMode !== 'edit') this.setMode('edit');
                        this.addNewComponent(item.fpKey);
                    });

                    leafNode.appendChild(leafHeader);
                    catChildren.appendChild(leafNode);
                    return;
                }

                // Иначе создаем раскрывающуюся папку подкатегории
                const subNode = document.createElement('div');
                subNode.className = 'tree-node';

                const subHeader = document.createElement('div');
                subHeader.className = 'tree-header folder-header';
                subHeader.innerHTML = `
                    <span class="tree-toggle">▶</span>
                    <span class="tree-icon">📂</span>
                    <span class="tree-label">${subcat.name}</span>
                `;

                const subChildren = document.createElement('div');
                subChildren.className = 'tree-children';

                subHeader.addEventListener('click', () => {
                    subNode.classList.toggle('expanded');
                });

                fpItems.forEach(item => {
                    const { fpKey, tpl, presets } = item;

                    if (presets.length === 0) {
                        // Одиночный корпус
                        const fpNode = document.createElement('div');
                        fpNode.className = 'tree-node';
                        fpNode.dataset.search = `${category.name} ${subcat.name} ${fpKey} ${tpl.name}`.toLowerCase();

                        const fpHeader = document.createElement('div');
                        fpHeader.className = 'tree-header leaf-item';
                        fpHeader.innerHTML = `
                            <span class="tree-toggle empty-toggle"></span>
                            <span class="tree-icon">📄</span>
                            <span class="tree-label">${tpl.name || fpKey}</span>
                        `;
                        fpHeader.addEventListener('click', () => {
                            if (this.currentMode !== 'edit') this.setMode('edit');
                            this.addNewComponent(fpKey);
                        });

                        fpNode.appendChild(fpHeader);
                        subChildren.appendChild(fpNode);
                    } else {
                        // Папка корпуса с несколькими моделями
                        const fpNode = document.createElement('div');
                        fpNode.className = 'tree-node';
                        fpNode.dataset.search = `${category.name} ${subcat.name} ${fpKey} ${tpl.name} ${presets.map(p => p[1].name + ' ' + p[1].value).join(' ')}`.toLowerCase();

                        const fpHeader = document.createElement('div');
                        fpHeader.className = 'tree-header folder-header';
                        fpHeader.innerHTML = `
                            <span class="tree-toggle">▶</span>
                            <span class="tree-icon">📁</span>
                            <span class="tree-label">${fpKey} (${tpl.name})</span>
                        `;

                        const fpChildren = document.createElement('div');
                        fpChildren.className = 'tree-children';

                        fpHeader.addEventListener('click', () => {
                            fpNode.classList.toggle('expanded');
                        });

                        // 1. Базовый корпус
                        const baseLeaf = document.createElement('div');
                        baseLeaf.className = 'tree-node';
                        baseLeaf.dataset.search = `${fpKey} базовый чистый`.toLowerCase();

                        const baseHeader = document.createElement('div');
                        baseHeader.className = 'tree-header leaf-item';
                        baseHeader.innerHTML = `
                            <span class="tree-toggle empty-toggle"></span>
                            <span class="tree-icon">📄</span>
                            <span class="tree-label">Базовый корпус (${fpKey})</span>
                        `;
                        baseHeader.addEventListener('click', () => {
                            if (this.currentMode !== 'edit') this.setMode('edit');
                            this.addNewComponent(fpKey);
                        });
                        baseLeaf.appendChild(baseHeader);
                        fpChildren.appendChild(baseLeaf);

                        // 2. Модели
                        presets.forEach(([presetKey, pr]) => {
                            const presetLeaf = document.createElement('div');
                            presetLeaf.className = 'tree-node';
                            presetLeaf.dataset.search = `${fpKey} ${pr.name} ${pr.value} ${pr.notes || ''}`.toLowerCase();

                            const presetHeader = document.createElement('div');
                            presetHeader.className = 'tree-header leaf-item';
                            presetHeader.innerHTML = `
                                <span class="tree-toggle empty-toggle"></span>
                                <span class="tree-icon">📄</span>
                                <span class="tree-label" title="${pr.notes || pr.name}">${pr.name}</span>
                            `;
                            presetHeader.addEventListener('click', () => {
                                if (this.currentMode !== 'edit') this.setMode('edit');
                                this.addNewComponent(fpKey, presetKey);
                            });

                            presetLeaf.appendChild(presetHeader);
                            fpChildren.appendChild(presetLeaf);
                        });

                        fpNode.appendChild(fpHeader);
                        fpNode.appendChild(fpChildren);
                        subChildren.appendChild(fpNode);
                    }
                });

                subNode.appendChild(subHeader);
                subNode.appendChild(subChildren);
                catChildren.appendChild(subNode);
            });

            catNode.appendChild(catHeader);
            catNode.appendChild(catChildren);
            this.componentTree.appendChild(catNode);
        });
    }

    expandAllTree() {
        if (!this.componentTree) return;
        this.componentTree.querySelectorAll('.tree-node').forEach(node => {
            node.classList.add('expanded');
        });
    }

    collapseAllTree() {
        if (!this.componentTree) return;
        this.componentTree.querySelectorAll('.tree-node').forEach(node => {
            node.classList.remove('expanded');
        });
    }

    filterTree(query) {
        if (!this.componentTree) return;

        if (!query) {
            this.componentTree.querySelectorAll('.tree-node').forEach(node => {
                node.style.display = '';
                node.classList.remove('search-matched');
            });
            return;
        }

        this.componentTree.querySelectorAll('.category-root').forEach(rootHeader => {
            const catNode = rootHeader.closest('.tree-node');
            let catMatches = false;

            catNode.querySelectorAll('.tree-children > .tree-node').forEach(subNode => {
                let subMatches = false;

                subNode.querySelectorAll('.tree-children > .tree-node').forEach(itemNode => {
                    const searchText = (itemNode.dataset.search || itemNode.textContent).toLowerCase();
                    const isMatch = searchText.includes(query);

                    if (isMatch) {
                        itemNode.style.display = '';
                        itemNode.classList.add('expanded');
                        subMatches = true;
                    } else {
                        itemNode.style.display = 'none';
                    }
                });

                if (subMatches) {
                    subNode.style.display = '';
                    subNode.classList.add('expanded');
                    catMatches = true;
                } else {
                    subNode.style.display = 'none';
                }
            });

            if (catMatches) {
                catNode.style.display = '';
                catNode.classList.add('expanded');
            } else {
                catNode.style.display = 'none';
            }
        });
    }



    applyPresetToComponent(comp, presetKey) {
        const preset = this.componentPresets[presetKey];
        if (!comp || !preset) return;

        comp.preset = presetKey;
        comp.value = preset.value || preset.name;
        comp.notes = preset.notes || comp.notes;
        comp.customPins = JSON.parse(JSON.stringify(preset.pins || {}));

        if (preset.footprint && comp.footprint !== preset.footprint) {
            comp.footprint = preset.footprint;
            const tpl = this.footprintTemplates[preset.footprint];
            if (tpl) {
                comp.width = tpl.width;
                comp.height = tpl.height;
            }
        }

        this.render();
        this.updateInspector();
        this.saveHistory();
        this.updateComponentList();
    }

    screenToWorld(clientX, clientY) {
        if (!this.svg) return { x: 0, y: 0 };
        const rect = this.svg.getBoundingClientRect();
        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;
        const worldX = (screenX - this.camera.x) / this.camera.zoom;
        const worldY = (screenY - this.camera.y) / this.camera.zoom;
        return { x: worldX, y: worldY };
    }

    onMouseDown(e) {
        if (e.button === 1 || e.button === 2 || (e.button === 0 && this.dragState.spaceDown)) {
            this.dragState.isPanning = true;
            this.dragState.startX = e.clientX;
            this.dragState.startY = e.clientY;
            if (this.viewportContainer) this.viewportContainer.classList.add('panning');
            e.preventDefault();
            return;
        }

        if (e.button === 0) {
            const target = e.target;

            // If clicking on floating UI controls, do not deselect component or start canvas panning
            if (target && (target.closest('.quick-transform-bar') || target.closest('.floating-hud') || target.closest('.mode-banner') || target.closest('.modal-overlay'))) {
                return;
            }

            // In Edit mode, handle resizing handles
            if (this.currentMode === 'edit' && target && target.classList && target.classList.contains('transform-handle')) {
                const handle = target.dataset.handle;
                const comp = this.getSelectedComponent();
                if (comp && !comp.locked) {
                    this.dragState.isResizing = true;
                    this.dragState.resizeHandle = handle;
                    this.dragState.startX = e.clientX;
                    this.dragState.startY = e.clientY;
                    this.dragState.origComp = { ...comp };
                    if (this.resizeScope === 'group') {
                        this.dragState.groupOrigs = this.getGroupComponents(comp).map(c => ({ id: c.id, x: c.x, y: c.y, width: c.width, height: c.height }));
                    } else {
                        this.dragState.groupOrigs = null;
                    }
                    e.stopPropagation();
                    return;
                }
            }

            // In Edit mode, handle rotation handle
            if (this.currentMode === 'edit' && target && target.classList && target.classList.contains('rotate-handle')) {
                const comp = this.getSelectedComponent();
                if (comp && !comp.locked) {
                    this.dragState.isRotating = true;
                    this.dragState.startX = e.clientX;
                    this.dragState.startY = e.clientY;
                    this.dragState.origComp = { ...comp };
                    e.stopPropagation();
                    return;
                }
            }

            // In Edit mode, clicking on transform box outline moves the selected component
            if (this.currentMode === 'edit' && target && target.classList && target.classList.contains('transform-box-rect')) {
                const comp = this.getSelectedComponent();
                if (comp && !comp.locked) {
                    this.dragState.isDraggingComp = true;
                    this.dragState.startX = e.clientX;
                    this.dragState.startY = e.clientY;
                    this.dragState.origComp = { ...comp };
                    e.stopPropagation();
                    return;
                }
            }

            // Clicking on component
            const compGroup = target ? target.closest('.board-component') : null;
            if (compGroup) {
                const id = compGroup.dataset.id;
                this.selectComponent(id);
                const comp = this.getSelectedComponent();

                // Only enable component dragging in EDIT mode if NOT locked
                if (this.currentMode === 'edit' && comp && !comp.locked) {
                    this.dragState.isDraggingComp = true;
                    this.dragState.startX = e.clientX;
                    this.dragState.startY = e.clientY;
                    this.dragState.origComp = { ...comp };
                }
                e.stopPropagation();
                return;
            }

            this.selectComponent(null);
        }
    }

    onMouseMove(e) {
        const worldPos = this.screenToWorld(e.clientX, e.clientY);
        if (this.statusCoord) {
            this.statusCoord.textContent = `X: ${Math.round(worldPos.x)}, Y: ${Math.round(worldPos.y)}`;
        }

        if (this.dragState.isPanning) {
            const dx = e.clientX - this.dragState.startX;
            const dy = e.clientY - this.dragState.startY;
            this.camera.x += dx;
            this.camera.y += dy;
            this.dragState.startX = e.clientX;
            this.dragState.startY = e.clientY;
            this.updateTransform();
            return;
        }

        if (this.currentMode === 'edit' && this.dragState.isDraggingComp && this.selectedId) {
            const dx = (e.clientX - this.dragState.startX) / this.camera.zoom;
            const dy = (e.clientY - this.dragState.startY) / this.camera.zoom;
            const comp = this.getSelectedComponent();
            if (comp && this.dragState.origComp) {
                let newX = this.dragState.origComp.x + dx;
                let newY = this.dragState.origComp.y + dy;

                if (this.settings.snapToGrid) {
                    newX = Math.round(newX / this.settings.gridSize) * this.settings.gridSize;
                    newY = Math.round(newY / this.settings.gridSize) * this.settings.gridSize;
                }

                comp.x = Math.round(newX);
                comp.y = Math.round(newY);
                this.render();
                this.updateInspector();
            }
            return;
        }

        if (this.currentMode === 'edit' && this.dragState.isResizing && this.selectedId) {
            const dxWorld = (e.clientX - this.dragState.startX) / this.camera.zoom;
            const dyWorld = (e.clientY - this.dragState.startY) / this.camera.zoom;
            const comp = this.getSelectedComponent();
            const orig = this.dragState.origComp;
            const handle = this.dragState.resizeHandle;

            if (comp && orig && handle) {
                const rad = ((orig.rotation || 0) * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);

                // Transform world delta into component's local unrotated coordinate space
                const dxLocal = dxWorld * cos + dyWorld * sin;
                const dyLocal = -dxWorld * sin + dyWorld * cos;

                const minSize = 30;
                let newW = orig.width;
                let newH = orig.height;
                let deltaCenterLocalX = 0;
                let deltaCenterLocalY = 0;

                // Horizontal handle axis
                if (handle.includes('e')) {
                    newW = Math.max(minSize, orig.width + dxLocal);
                    const actualDw = newW - orig.width;
                    deltaCenterLocalX = actualDw / 2;
                } else if (handle.includes('w')) {
                    newW = Math.max(minSize, orig.width - dxLocal);
                    const actualDw = newW - orig.width;
                    deltaCenterLocalX = -actualDw / 2;
                }

                // Vertical handle axis
                if (handle.includes('s')) {
                    newH = Math.max(minSize, orig.height + dyLocal);
                    const actualDh = newH - orig.height;
                    deltaCenterLocalY = actualDh / 2;
                } else if (handle.includes('n')) {
                    newH = Math.max(minSize, orig.height - dyLocal);
                    const actualDh = newH - orig.height;
                    deltaCenterLocalY = -actualDh / 2;
                }

                // Snap to grid if active
                if (this.settings.snapToGrid && this.settings.gridSize) {
                    const snap = this.settings.gridSize;
                    const snappedW = Math.max(minSize, Math.round(newW / snap) * snap);
                    const snappedH = Math.max(minSize, Math.round(newH / snap) * snap);
                    
                    if (handle.includes('e') || handle.includes('w')) {
                        const diffW = snappedW - orig.width;
                        deltaCenterLocalX = (handle.includes('e') ? 1 : -1) * (diffW / 2);
                        newW = snappedW;
                    }
                    if (handle.includes('s') || handle.includes('n')) {
                        const diffH = snappedH - orig.height;
                        deltaCenterLocalY = (handle.includes('s') ? 1 : -1) * (diffH / 2);
                        newH = snappedH;
                    }
                }

                // Transform local center displacement back to world space
                const deltaCenterWorldX = deltaCenterLocalX * cos - deltaCenterLocalY * sin;
                const deltaCenterWorldY = deltaCenterLocalX * sin + deltaCenterLocalY * cos;

                const origCenterX = orig.x + orig.width / 2;
                const origCenterY = orig.y + orig.height / 2;

                const newCenterX = origCenterX + deltaCenterWorldX;
                const newCenterY = origCenterY + deltaCenterWorldY;

                comp.width = Math.round(newW);
                comp.height = Math.round(newH);
                comp.x = Math.round(newCenterX - newW / 2);
                comp.y = Math.round(newCenterY - newH / 2);

                // If group resize scope is active, update other group items to exact dimensions
                if (this.resizeScope === 'group' && this.dragState.groupOrigs) {
                    const targetW = Math.round(newW);
                    const targetH = Math.round(newH);
                    this.dragState.groupOrigs.forEach(gOrig => {
                        if (gOrig.id === comp.id) return;
                        const c = this.components.find(item => item.id === gOrig.id);
                        if (c) {
                            const gCx = gOrig.x + gOrig.width / 2;
                            const gCy = gOrig.y + gOrig.height / 2;
                            c.width = targetW;
                            c.height = targetH;
                            c.x = Math.round(gCx - targetW / 2);
                            c.y = Math.round(gCy - targetH / 2);
                        }
                    });
                }

                this.render();
                this.updateInspector();
            }
            return;
        }

        if (this.currentMode === 'edit' && this.dragState.isRotating && this.selectedId) {
            const comp = this.getSelectedComponent();
            if (comp) {
                const cx = comp.x + comp.width / 2;
                const cy = comp.y + comp.height / 2;
                const angleRad = Math.atan2(worldPos.y - cy, worldPos.x - cx);
                let angleDeg = (angleRad * 180 / Math.PI) + 90;
                if (angleDeg < 0) angleDeg += 360;

                if (e.shiftKey) {
                    angleDeg = Math.round(angleDeg / 45) * 45;
                }

                comp.rotation = Math.round(angleDeg % 360);
                this.render();
                this.updateInspector();
            }
        }
    }

    onMouseUp(e) {
        if (this.dragState.isPanning) {
            this.dragState.isPanning = false;
            if (this.viewportContainer) this.viewportContainer.classList.remove('panning');
        }

        if (this.dragState.isDraggingComp || this.dragState.isResizing || this.dragState.isRotating) {
            this.dragState.isDraggingComp = false;
            this.dragState.isResizing = false;
            this.dragState.isRotating = false;
            this.dragState.resizeHandle = null;
            this.dragState.origComp = null;
            this.saveHistory();
        }
    }

    onWheel(e) {
        e.preventDefault();
        if (!this.svg) return;
        const rect = this.svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomDelta = e.deltaY < 0 ? 1.15 : 0.85;
        const newZoom = Math.min(Math.max(this.camera.zoom * zoomDelta, this.camera.minZoom), this.camera.maxZoom);

        this.camera.x = mouseX - (mouseX - this.camera.x) * (newZoom / this.camera.zoom);
        this.camera.y = mouseY - (mouseY - this.camera.y) * (newZoom / this.camera.zoom);
        this.camera.zoom = newZoom;

        this.updateTransform();
    }

    updateTransform() {
        if (!this.worldGroup) return;
        const matrixStr = `matrix(${this.camera.zoom}, 0, 0, ${this.camera.zoom}, ${this.camera.x}, ${this.camera.y})`;
        this.worldGroup.setAttribute('transform', matrixStr);
        if (this.statusZoom) {
            this.statusZoom.textContent = `Zoom: ${Math.round(this.camera.zoom * 100)}%`;
        }
        this.renderGrid();
    }

    fitToScreen() {
        if (!this.viewportContainer) return;
        const rect = this.viewportContainer.getBoundingClientRect();
        
        let containerW = rect.width;
        let containerH = rect.height;

        if (!containerW || containerW <= 0) {
            const leftW = (this.leftSidebar && !this.leftSidebar.classList.contains('collapsed')) ? 310 : 0;
            const rightW = (this.rightSidebar && !this.rightSidebar.classList.contains('collapsed')) ? 320 : 0;
            containerW = window.innerWidth - leftW - rightW;
        }
        if (!containerH || containerH <= 0) {
            containerH = window.innerHeight - 48 - 24;
        }

        containerW = Math.max(containerW, 200);
        containerH = Math.max(containerH, 200);

        const targetW = 9955;
        const targetH = 3766;

        const zoomX = (containerW * 0.95) / targetW;
        const zoomY = (containerH * 0.95) / targetH;
        this.camera.zoom = Math.min(zoomX, zoomY);

        this.camera.x = (containerW - targetW * this.camera.zoom) / 2;
        this.camera.y = (containerH - targetH * this.camera.zoom) / 2;

        this.updateTransform();
    }

    panToComponent(comp) {
        if (!comp || !this.viewportContainer) return;
        const rect = this.viewportContainer.getBoundingClientRect();
        const cx = comp.x + comp.width / 2;
        const cy = comp.y + comp.height / 2;

        const w = rect.width > 0 ? rect.width : window.innerWidth / 2;
        const h = rect.height > 0 ? rect.height : window.innerHeight / 2;

        this.camera.x = w / 2 - cx * this.camera.zoom;
        this.camera.y = h / 2 - cy * this.camera.zoom;
        this.updateTransform();
    }

    renderGrid() {
        if (!this.gridLayer) return;
        this.gridLayer.innerHTML = '';
        if (!this.settings.showGrid) return;

        const baseStep = this.settings.gridSize || 50;
        const style = this.settings.gridStyle || 'major-minor';
        const opacity = this.settings.gridOpacity !== undefined ? this.settings.gridOpacity : 0.35;

        // Board dimensions
        const startX = 0;
        const endX = 9955;
        const startY = 0;
        const endY = 3766;

        // Dynamic Level of Detail (LOD) to prevent performance issues on extreme zoom-out
        let step = baseStep;
        const screenStep = step * this.camera.zoom;
        if (screenStep < 5) {
            const multipliers = [2, 5, 10, 20, 50, 100];
            for (const mult of multipliers) {
                if (baseStep * mult * this.camera.zoom >= 5) {
                    step = baseStep * mult;
                    break;
                }
            }
        }

        const strokeColor = 'rgba(56, 189, 248, '; // Professional CAD cyan

        if (style === 'dots') {
            const dotPaths = [];
            const crossSize = Math.max(1.5, Math.min(6, 2 / this.camera.zoom));
            for (let x = startX; x <= endX; x += step) {
                for (let y = startY; y <= endY; y += step) {
                    dotPaths.push(`M ${x - crossSize} ${y} H ${x + crossSize} M ${x} ${y - crossSize} V ${y + crossSize}`);
                }
            }
            const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('d', dotPaths.join(' '));
            pathEl.setAttribute('stroke', `${strokeColor}${opacity})`);
            pathEl.setAttribute('stroke-width', '1');
            pathEl.setAttribute('vector-effect', 'non-scaling-stroke');
            pathEl.setAttribute('fill', 'none');
            this.gridLayer.appendChild(pathEl);
        } else if (style === 'major-minor') {
            const minorPaths = [];
            const majorPaths = [];
            const majorInterval = step * 5;

            for (let x = startX; x <= endX; x += step) {
                const isMajor = Math.round(x) % majorInterval === 0;
                if (isMajor) {
                    majorPaths.push(`M ${x} ${startY} L ${x} ${endY}`);
                } else {
                    minorPaths.push(`M ${x} ${startY} L ${x} ${endY}`);
                }
            }

            for (let y = startY; y <= endY; y += step) {
                const isMajor = Math.round(y) % majorInterval === 0;
                if (isMajor) {
                    majorPaths.push(`M ${startX} ${y} L ${endX} ${y}`);
                } else {
                    minorPaths.push(`M ${startX} ${y} L ${endX} ${y}`);
                }
            }

            // Minor grid lines
            if (minorPaths.length > 0) {
                const minorEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                minorEl.setAttribute('d', minorPaths.join(' '));
                minorEl.setAttribute('stroke', `${strokeColor}${(opacity * 0.45).toFixed(3)})`);
                minorEl.setAttribute('stroke-width', '1');
                minorEl.setAttribute('vector-effect', 'non-scaling-stroke');
                minorEl.setAttribute('fill', 'none');
                this.gridLayer.appendChild(minorEl);
            }

            // Major grid lines
            if (majorPaths.length > 0) {
                const majorEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                majorEl.setAttribute('d', majorPaths.join(' '));
                majorEl.setAttribute('stroke', `${strokeColor}${opacity})`);
                majorEl.setAttribute('stroke-width', '1.5');
                majorEl.setAttribute('vector-effect', 'non-scaling-stroke');
                majorEl.setAttribute('fill', 'none');
                this.gridLayer.appendChild(majorEl);
            }
        } else {
            // Uniform CAD Lines
            const gridPath = [];
            for (let x = startX; x <= endX; x += step) {
                gridPath.push(`M ${x} ${startY} L ${x} ${endY}`);
            }
            for (let y = startY; y <= endY; y += step) {
                gridPath.push(`M ${startX} ${y} L ${endX} ${y}`);
            }

            const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('d', gridPath.join(' '));
            pathEl.setAttribute('stroke', `${strokeColor}${opacity})`);
            pathEl.setAttribute('stroke-width', '1');
            pathEl.setAttribute('vector-effect', 'non-scaling-stroke');
            pathEl.setAttribute('fill', 'none');
            this.gridLayer.appendChild(pathEl);
        }
    }

    renderBoardOutline() {
        if (!this.boardOutlineLayer) return;
        this.boardOutlineLayer.innerHTML = '';

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.className.baseVal = 'board-boundary-rect';
        rect.setAttribute('x', '0');
        rect.setAttribute('y', '0');
        rect.setAttribute('width', '9955');
        rect.setAttribute('height', '3766');
        rect.setAttribute('rx', '40');
        this.boardOutlineLayer.appendChild(rect);
    }

    getSelectedComponent() {
        return this.components.find(c => c.id === this.selectedId);
    }

    selectComponent(id) {
        this.selectedId = id;
        const comp = this.getSelectedComponent();
        if (!comp) {
            this.selectedId = null;
        }

        this.render();
        this.updateInspector();
        this.updateComponentListSelection();

        if (comp) {
            if (this.currentMode === 'edit' && this.quickBar) {
                this.quickBar.classList.add('visible');
                if (this.quickName) this.quickName.textContent = `${comp.designator} (${comp.value || comp.footprint})`;
            } else if (this.quickBar) {
                this.quickBar.classList.remove('visible');
            }
            if (this.statusSelected) this.statusSelected.textContent = `Выделен: ${comp.designator} [${comp.footprint}]`;
        } else {
            if (this.quickBar) this.quickBar.classList.remove('visible');
            if (this.statusSelected) this.statusSelected.textContent = `Выделен: Нет`;
        }
    }

    addNewComponent(footprintKey, presetKey = null) {
        const tpl = this.footprintTemplates[footprintKey] || this.footprintTemplates['DIP-8'];
        if (!tpl) return;
        const rect = this.viewportContainer ? this.viewportContainer.getBoundingClientRect() : { left: 0, top: 0, width: 800, height: 600 };
        const centerWorld = this.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);

        const preset = presetKey ? this.componentPresets[presetKey] : null;

        let prefix = 'U';
        if (preset && preset.designatorPrefix) {
            prefix = preset.designatorPrefix;
        } else if (footprintKey.startsWith('RES')) {
            prefix = 'R';
        } else if (footprintKey.startsWith('CAP')) {
            prefix = 'C';
        } else if (footprintKey.startsWith('DIP') || footprintKey.startsWith('SOIC') || footprintKey.startsWith('TQFP') || footprintKey.startsWith('TSSOP')) {
            prefix = 'D';
        } else if (footprintKey.startsWith('TO') || footprintKey.startsWith('SOT')) {
            prefix = 'V';
        } else if (footprintKey.startsWith('DIODE') || footprintKey.startsWith('BRIDGE')) {
            prefix = 'VD';
        } else if (footprintKey.startsWith('LED')) {
            prefix = 'HL';
        } else if (footprintKey.startsWith('CONN')) {
            prefix = 'X';
        } else if (footprintKey.startsWith('SW')) {
            prefix = 'SA';
        } else if (footprintKey.startsWith('RELAY')) {
            prefix = 'K';
        } else if (footprintKey.startsWith('QUARTZ') || footprintKey.startsWith('OSC') || footprintKey.startsWith('XTAL')) {
            prefix = 'B';
        } else if (footprintKey.startsWith('INDUCTOR') || footprintKey.startsWith('IND')) {
            prefix = 'L';
        } else if (footprintKey.startsWith('HOLE')) {
            prefix = 'H';
        } else if (footprintKey.startsWith('TESTPOINT')) {
            prefix = 'TP';
        }

        let maxNum = 0;
        this.components.forEach(c => {
            if (c.designator && c.designator.startsWith(prefix)) {
                const num = parseInt(c.designator.replace(prefix, ''));
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        });

        let newX = Math.round(centerWorld.x - tpl.width / 2);
        let newY = Math.round(centerWorld.y - tpl.height / 2);
        if (this.settings.snapToGrid && this.settings.gridSize) {
            newX = Math.round(newX / this.settings.gridSize) * this.settings.gridSize;
            newY = Math.round(newY / this.settings.gridSize) * this.settings.gridSize;
        }

        const newId = 'C_' + Date.now();
        const newComp = {
            id: newId,
            designator: `${prefix}${maxNum + 1}`,
            value: preset ? (preset.value || preset.name) : tpl.name,
            footprint: footprintKey,
            x: newX,
            y: newY,
            width: tpl.width,
            height: tpl.height,
            rotation: 0,
            layer: 'top',
            notes: preset ? (preset.notes || preset.name) : 'Добавлен вручную',
            preset: presetKey || null,
            customPins: preset && preset.pins ? JSON.parse(JSON.stringify(preset.pins)) : {}
        };

        this.components.push(newComp);
        this.selectComponent(newId);
        this.saveHistory();
        this.updateComponentList();
    }

    duplicateSelected() {
        if (this.currentMode !== 'edit') return;
        const comp = this.getSelectedComponent();
        if (!comp) return;

        const offset = this.settings.snapToGrid ? (this.settings.gridSize || 50) : 100;
        let copyX = comp.x + offset;
        let copyY = comp.y + offset;
        if (this.settings.snapToGrid && this.settings.gridSize) {
            copyX = Math.round(copyX / this.settings.gridSize) * this.settings.gridSize;
            copyY = Math.round(copyY / this.settings.gridSize) * this.settings.gridSize;
        }

        const newId = 'C_' + Date.now();
        const copy = {
            ...JSON.parse(JSON.stringify(comp)),
            id: newId,
            designator: `${comp.designator}_copy`,
            x: copyX,
            y: copyY
        };

        this.components.push(copy);
        this.selectComponent(newId);
        this.saveHistory();
        this.updateComponentList();
    }

    deleteSelected() {
        if (this.currentMode !== 'edit') return;
        if (!this.selectedId) return;
        this.components = this.components.filter(c => c.id !== this.selectedId);
        this.selectComponent(null);
        this.saveHistory();
        this.updateComponentList();
    }

    rotateSelected(deg) {
        if (this.currentMode !== 'edit') return;
        const comp = this.getSelectedComponent();
        if (!comp) return;
        comp.rotation = ((comp.rotation || 0) + deg + 360) % 360;
        this.render();
        this.updateInspector();
        this.saveHistory();
    }

    getComponentAutoFontSize(comp) {
        if (!comp) return 32;
        const fp = comp.footprint || '';
        let autoFontSize = Math.min(Math.max(comp.height * 0.30, 32), comp.width * 0.38);
        if (fp === 'RES-AXIAL-V' || fp === 'HOLE-3.6') {
            autoFontSize = 28;
        } else if (fp === 'TO-92') {
            autoFontSize = 30;
        }
        return Math.max(8, Math.round(autoFontSize));
    }

    setFontSizeSelected(val) {
        if (this.currentMode !== 'edit') return;
        const comp = this.getSelectedComponent();
        if (!comp || comp.locked) return;

        let numVal = null;
        if (val !== null && val !== undefined && val !== '') {
            const parsed = parseFloat(val);
            if (!isNaN(parsed) && parsed > 0) {
                numVal = Math.max(6, Math.min(300, Math.round(parsed)));
            }
        }

        if (numVal !== null) {
            comp.fontSize = numVal;
        } else {
            delete comp.fontSize;
        }

        if (this.resizeScope === 'group') {
            const groupComps = this.getGroupComponents(comp);
            groupComps.forEach(c => {
                if (c.id === comp.id) return;
                if (numVal !== null) {
                    c.fontSize = numVal;
                } else {
                    delete c.fontSize;
                }
            });
        }

        this.render();
        this.updateInspector();
    }

    stepFontSizeSelected(delta) {
        if (this.currentMode !== 'edit') return;
        const comp = this.getSelectedComponent();
        if (!comp || comp.locked) return;
        const currentSize = comp.fontSize ? Number(comp.fontSize) : this.getComponentAutoFontSize(comp);
        this.setFontSizeSelected(currentSize + delta);
        this.saveHistory();
    }

    toggleSelectedLayer() {
        if (this.currentMode !== 'edit') return;
        const comp = this.getSelectedComponent();
        if (!comp) return;
        comp.layer = comp.layer === 'bottom' ? 'top' : 'bottom';
        this.render();
        this.updateInspector();
        this.saveHistory();
    }

    resetSelectedToDefaults() {
        if (this.currentMode !== 'edit') return;
        const comp = this.getSelectedComponent();
        if (!comp) return;

        // Try finding the original component in INITIAL_COMPONENTS
        const orig = this.initialComponents.find(c => c.id === comp.id || (c.designator && c.designator === comp.designator));

        if (orig) {
            comp.designator = orig.designator;
            comp.value = orig.value;
            comp.footprint = orig.footprint;
            comp.layer = orig.layer || 'top';
            comp.x = orig.x;
            comp.y = orig.y;
            comp.width = orig.width;
            comp.height = orig.height;
            comp.rotation = orig.rotation || 0;
            comp.notes = orig.notes || '';
            if (orig.fontSize) {
                comp.fontSize = orig.fontSize;
            } else {
                delete comp.fontSize;
            }
            if (orig.customPins) {
                comp.customPins = JSON.parse(JSON.stringify(orig.customPins));
            } else {
                delete comp.customPins;
            }
        } else {
            // New component created during session: reset dimensions and angle according to footprint library
            const tpl = this.footprintTemplates[comp.footprint];
            if (tpl) {
                comp.width = tpl.width;
                comp.height = tpl.height;
            }
            comp.rotation = 0;
            delete comp.fontSize;
            delete comp.customPins;
        }

        this.render();
        this.updateInspector();
        this.saveHistory();
        this.updateComponentList();
    }

    render() {
        this.renderBoardOutline();
        if (!this.componentsLayer || !this.overlayLayer) return;
        this.pinWorldPositions.clear();
        this.componentsLayer.innerHTML = '';
        this.overlayLayer.innerHTML = '';

        this.components.forEach(comp => {
            if (comp.layer === 'top' && !this.settings.showTop) return;
            if (comp.layer === 'bottom' && !this.settings.showBottom) return;

            const g = this.createSVGComponent(comp);
            this.componentsLayer.appendChild(g);
        });

        // Render Net Connections / Ratlines
        this.renderNetsOverlay();

        // Show transform handles ONLY in edit mode
        if (this.currentMode === 'edit' && this.selectedId) {
            const comp = this.getSelectedComponent();
            if (comp) {
                const transformBox = this.createTransformBox(comp);
                this.overlayLayer.appendChild(transformBox);
            }
        }

        if (this.compCountBadge) {
            this.compCountBadge.textContent = `${this.components.length} шт`;
        }
        if (this.netsCountBadge && window.NETS_MANAGER) {
            this.netsCountBadge.textContent = `${window.NETS_MANAGER.getAllNets().length}`;
        }
    }

    createSVGComponent(comp) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.className.baseVal = `board-component ${comp.id === this.selectedId ? 'selected' : ''}`;
        g.dataset.id = comp.id;

        const cx = comp.x + comp.width / 2;
        const cy = comp.y + comp.height / 2;
        g.setAttribute('transform', `rotate(${comp.rotation || 0}, ${cx}, ${cy})`);

        const isBottom = comp.layer === 'bottom';
        const isCad = this.settings.compStyle === 'cad';
        const fp = comp.footprint || '';

        // Render realistic body geometry according to element type
        this.renderComponentBody(g, comp, isBottom, fp);

        if (this.settings.showSilk) {
            const showDesig = comp.showDesignator !== false;
            const showVal = comp.showValue === true && Boolean(comp.value && comp.value.trim());

            if (showDesig || showVal) {
                const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                textGroup.className.baseVal = 'comp-label-group';

                let centerY = cy;
                let autoFontSize = Math.min(Math.max(comp.height * 0.30, 32), comp.width * 0.38);
                if (fp === 'RES-AXIAL-V' || fp === 'HOLE-3.6') {
                    autoFontSize = 28;
                    centerY = cy - comp.height * 0.45;
                } else if (fp === 'TO-92') {
                    autoFontSize = 30;
                    centerY = cy - comp.height * 0.16;
                }

                const effectiveFontSize = (comp.fontSize !== undefined && comp.fontSize !== null && comp.fontSize > 0) 
                    ? Number(comp.fontSize) 
                    : Math.max(8, Math.round(autoFontSize));

                if (showDesig && showVal) {
                    // Two-line layout: Top = Designator, Bottom = Value / Model
                    const fs1 = Math.max(7, Math.round(effectiveFontSize * 0.88));
                    const fs2 = Math.max(6, Math.round(effectiveFontSize * 0.68));
                    const lineSpacing = Math.round((fs1 + fs2) * 0.58);

                    const y1 = centerY - lineSpacing * 0.45;
                    const y2 = centerY + lineSpacing * 0.55;

                    // 1. Primary Designator (R1, D2...)
                    const t1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    t1.className.baseVal = 'comp-label comp-label-desig';
                    t1.setAttribute('x', cx);
                    t1.setAttribute('y', y1);
                    t1.setAttribute('text-anchor', 'middle');
                    t1.setAttribute('dominant-baseline', 'middle');
                    t1.setAttribute('font-size', `${fs1}px`);
                    t1.setAttribute('font-weight', 'bold');
                    t1.textContent = comp.designator;
                    textGroup.appendChild(t1);

                    // 2. Secondary Value (10k, TL072...)
                    const t2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    t2.className.baseVal = 'comp-label comp-label-value';
                    t2.setAttribute('x', cx);
                    t2.setAttribute('y', y2);
                    t2.setAttribute('text-anchor', 'middle');
                    t2.setAttribute('dominant-baseline', 'middle');
                    t2.setAttribute('font-size', `${fs2}px`);
                    t2.setAttribute('fill', isCad ? '#38bdf8' : (isBottom ? '#7dd3fc' : '#cbd5e1'));
                    t2.textContent = comp.value;
                    textGroup.appendChild(t2);
                } else {
                    // Single line layout
                    const singleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    singleText.className.baseVal = 'comp-label';
                    singleText.setAttribute('x', cx);
                    singleText.setAttribute('y', centerY);
                    singleText.setAttribute('text-anchor', 'middle');
                    singleText.setAttribute('dominant-baseline', 'middle');
                    singleText.setAttribute('font-size', `${effectiveFontSize}px`);
                    singleText.textContent = showDesig ? comp.designator : comp.value;
                    textGroup.appendChild(singleText);
                }

                const rot = (comp.rotation || 0) % 360;
                if (rot > 90 && rot <= 270) {
                    textGroup.setAttribute('transform', `rotate(180, ${cx}, ${centerY})`);
                }

                g.appendChild(textGroup);
            }
        }

        return g;
    }

    // =============================================================================
    // INTERACTIVE PIN ENGINE, NET HIGHLIGHTING & POLARITY HELPERS
    // =============================================================================

    getComponentPinInfo(comp, pinNum) {
        const pNum = parseInt(pinNum);
        const pins = this.getComponentPins(comp);
        const found = pins.find(p => p.num === pNum) || { num: pNum, name: `Вывод ${pNum}`, defaultName: `Вывод ${pNum}`, shape: 'circle' };
        
        let customVal = comp.customPins ? comp.customPins[pNum] : null;
        let net = '';
        let role = 'signal';
        let name = found.name;

        if (customVal && typeof customVal === 'object') {
            if (customVal.name) name = customVal.name;
            if (customVal.net) net = customVal.net;
            if (customVal.role) role = customVal.role;
        } else if (typeof customVal === 'string') {
            name = customVal;
        }

        const nameUp = name.toUpperCase();
        if (!net) {
            if (nameUp.includes('GND') || nameUp.includes('ОБЩ') || nameUp.includes('GROUND') || nameUp.includes('ЗЕМЛЯ')) {
                net = 'GND';
                role = 'ground';
            } else if (nameUp.includes('+5V') || nameUp.includes('VCC') || nameUp.includes('VDD')) {
                net = '+5V';
                role = 'power';
            } else if (nameUp.includes('+12V') || nameUp.includes('+24V') || nameUp.includes('VBAT')) {
                net = nameUp.includes('+12V') ? '+12V' : (nameUp.includes('+24V') ? '+24V' : 'VBAT');
                role = 'power';
            } else if (nameUp.includes('K (') || nameUp.includes('КАТОД') || nameUp.includes('- (')) {
                role = 'cathode';
            } else if (nameUp.includes('A (') || nameUp.includes('АНОД') || nameUp.includes('+ (')) {
                role = 'anode';
            }
        }

        return {
            num: pNum,
            name: name,
            net: net,
            role: role,
            shape: found.shape || 'circle'
        };
    }

    createPinPadElement(comp, pinNum, x, y, opts = {}) {
        const isSelected = comp.id === this.selectedId;
        const isCad = this.settings.compStyle === 'cad';
        const shape = opts.shape || 'circle';
        const isPin1 = !!opts.isPin1;
        const padR = opts.r || 18;
        const padW = opts.w || (padR * 2);
        const padH = opts.h || (padR * 2);
        const label = opts.label !== undefined ? opts.label : null;

        const pNum = parseInt(pinNum);
        const netObj = window.NETS_MANAGER ? window.NETS_MANAGER.getNetForPin(comp.id, pNum) : null;
        const pinInfo = this.getComponentPinInfo(comp, pNum);
        const netName = (netObj ? netObj.name : pinInfo.net) || '';

        // Exact Rotated World Coordinates on Board
        const cx = comp.x + comp.width / 2;
        const cy = comp.y + comp.height / 2;
        const rad = ((comp.rotation || 0) * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const dx = x - cx;
        const dy = y - cy;
        const worldX = cx + dx * cos - dy * sin;
        const worldY = cy + dx * sin + dy * cos;

        this.pinWorldPositions.set(`${comp.id}:${pNum}`, {
            x: worldX,
            y: worldY,
            compId: comp.id,
            pinNum: pNum,
            netId: netObj ? netObj.id : (netName || null),
            netName: netName
        });

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.className.baseVal = 'comp-pin-pad';
        g.dataset.compId = comp.id;
        g.dataset.pinNum = pNum.toString();
        if (netObj) {
            g.dataset.netId = netObj.id;
            g.dataset.netName = netObj.name;
        }

        const isNetHighlighted = Boolean(
            this.activeHighlightedNet && 
            (
                (netObj && (this.activeHighlightedNet === netObj.id || this.activeHighlightedNet.toLowerCase() === netObj.name.toLowerCase())) ||
                (netName && this.activeHighlightedNet.toLowerCase() === netName.toLowerCase())
            )
        );

        if (isNetHighlighted) {
            g.classList.add('highlighted-net');
            if (netObj && netObj.color) {
                g.style.setProperty('--net-color', netObj.color);
            }
        }

        let defaultFill = isSelected ? '#38bdf8' : (isPin1 ? '#ef4444' : (opts.isWiper ? '#f59e0b' : '#facc15'));
        if (opts.fill) defaultFill = opts.fill;

        if (shape === 'rect' || shape === 'square') {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', (x - padW / 2).toFixed(1));
            rect.setAttribute('y', (y - padH / 2).toFixed(1));
            rect.setAttribute('width', padW.toFixed(1));
            rect.setAttribute('height', padH.toFixed(1));
            rect.setAttribute('rx', opts.rx || '4');
            rect.setAttribute('fill', defaultFill);
            rect.setAttribute('stroke', '#0f172a');
            rect.setAttribute('stroke-width', '2');
            g.appendChild(rect);
        } else {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x.toFixed(1));
            circle.setAttribute('cy', y.toFixed(1));
            circle.setAttribute('r', padR.toFixed(1));
            circle.setAttribute('fill', defaultFill);
            circle.setAttribute('stroke', '#0f172a');
            circle.setAttribute('stroke-width', '2');
            g.appendChild(circle);
        }

        if (opts.hasHole !== false) {
            const hole = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            hole.setAttribute('cx', x.toFixed(1));
            hole.setAttribute('cy', y.toFixed(1));
            hole.setAttribute('r', (opts.holeR || 7).toFixed(1));
            hole.setAttribute('fill', '#060911');
            g.appendChild(hole);
        }

        // Optional Pin Label (1, 2, +, -, K, A)
        if (this.settings.showPinLabels) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.className.baseVal = 'comp-pin-label';
            let lblText = label !== null ? label : pinNum.toString();
            text.textContent = lblText;
            let lx = x;
            let ly = y - padR - 6;
            if (opts.labelPos === 'bottom') ly = y + padR + 16;
            else if (opts.labelPos === 'left') { lx = x - padW / 2 - 12; ly = y + 4; }
            else if (opts.labelPos === 'right') { lx = x + padW / 2 + 12; ly = y + 4; }
            else if (opts.labelPos === 'inside') { ly = y + 4; }

            text.setAttribute('x', lx.toFixed(1));
            text.setAttribute('y', ly.toFixed(1));
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('font-size', (opts.fontSize || 20).toString() + 'px');
            g.appendChild(text);
        }

        return g;
    }

    showPinTooltip(comp, pinNum, clientX, clientY) {
        if (!this.pinHudTooltip) return;
        const info = this.getComponentPinInfo(comp, pinNum);
        const rect = this.viewportContainer ? this.viewportContainer.getBoundingClientRect() : { left: 0, top: 0 };
        
        let roleText = 'Сигнал';
        let roleClass = 'role-signal';
        let roleIcon = '⚡';
        if (info.role === 'power') { roleText = 'Питание'; roleClass = 'role-power'; roleIcon = '🔴'; }
        else if (info.role === 'ground') { roleText = 'Общий / GND'; roleClass = 'role-ground'; roleIcon = '⏚'; }
        else if (info.role === 'passive') { roleText = 'Пассивный'; roleClass = 'role-passive'; roleIcon = '⚪'; }
        else if (info.role === 'anode') { roleText = 'Анод (+)'; roleClass = 'role-power'; roleIcon = '⊕'; }
        else if (info.role === 'cathode') { roleText = 'Катод (-)'; roleClass = 'role-ground'; roleIcon = '⊖'; }

        let netHtml = info.net ? `<span class="net-badge" title="Нажмите на контакт, чтобы подсветить всю цепь">Цепь: ${info.net}</span>` : '';

        this.pinHudTooltip.innerHTML = `
            <div class="pin-hud-header">
                <span class="pin-hud-comp">${comp.designator}</span>
                <span class="pin-hud-num-badge">№ ${info.num}</span>
            </div>
            <div class="pin-hud-signal">${info.name}</div>
            <div class="pin-hud-tags">
                <span class="role-badge ${roleClass}">${roleIcon} ${roleText}</span>
                ${netHtml}
            </div>
        `;

        const left = clientX - rect.left + 16;
        const top = clientY - rect.top + 16;
        this.pinHudTooltip.style.left = `${left}px`;
        this.pinHudTooltip.style.top = `${top}px`;
        this.pinHudTooltip.classList.add('active');
    }

    hidePinTooltip() {
        if (this.pinHudTooltip) {
            this.pinHudTooltip.classList.remove('active');
        }
    }

    highlightPinInTable(pinNum) {
        document.querySelectorAll('.pinout-table tbody tr').forEach(tr => {
            if (tr.dataset.pin === pinNum.toString()) {
                tr.classList.add('hovered-row');
            } else {
                tr.classList.remove('hovered-row');
            }
        });
    }

    clearPinTableHighlight() {
        document.querySelectorAll('.pinout-table tbody tr').forEach(tr => {
            tr.classList.remove('hovered-row');
        });
    }

    flipSelectedPolarity() {
        const comp = this.getSelectedComponent();
        if (!comp || comp.locked) return;

        // 1. Поворот на 180 градусов
        comp.rotation = ((comp.rotation || 0) + 180) % 360;

        // 2. Инверсия контактов 1 и 2 в customPins, если они заданы
        if (comp.customPins) {
            const p1 = comp.customPins[1];
            const p2 = comp.customPins[2];
            if (p1 !== undefined && p2 !== undefined) {
                comp.customPins[1] = p2;
                comp.customPins[2] = p1;
            }
        }

        this.render();
        this.updateInspector();
        this.saveHistory();
    }

    applyPinoutTemplate(templateKey) {
        const comp = this.getSelectedComponent();
        if (!comp || comp.locked) return;
        const fp = comp.footprint || '';
        const tplList = this.pinoutTemplates[fp] || [];
        const tpl = tplList.find(t => t.id === templateKey);
        if (!tpl) return;

        if (!comp.customPins) comp.customPins = {};
        Object.entries(tpl.pins).forEach(([pinNum, pinData]) => {
            comp.customPins[pinNum] = typeof pinData === 'object' ? JSON.parse(JSON.stringify(pinData)) : pinData;
        });

        this.render();
        this.updateInspector();
        this.saveHistory();
    }

    renderComponentBody(g, comp, isBottom, fp) {
        const isSelected = comp.id === this.selectedId;
        const isCad = this.settings.compStyle === 'cad';
        const fillOp = isSelected ? 0.45 : this.settings.compFillOpacity;

        // Base colors
        let strokeColor = isSelected ? '#38bdf8' : (isBottom ? '#0284c7' : (isCad ? '#38bdf8' : '#64748b'));
        let bodyFill = isSelected ? 'rgba(56, 189, 248, 0.35)' : 
                       (isCad ? (isBottom ? 'rgba(2, 132, 199, 0.25)' : 'rgba(56, 189, 248, 0.15)') : 
                                (isBottom ? '#0284c7' : '#1e293b'));
        
        const strokeWidth = isSelected ? '5' : (isCad ? '3' : '4');

        // =========================================================================
        // 1. КЕРАМИЧЕСКИЙ ВЫВОДНОЙ КОНДЕНСАТОР (CAP-CERAMIC / К10-7В / «Таблетка» / «Рыжик»)
        // =========================================================================
        if (fp === 'CAP-CERAMIC' || fp.startsWith('CAP-CERAMIC-DISC')) {
            const cx = comp.x + comp.width / 2;
            const cy = comp.y + comp.height / 2;
            const isHoriz = comp.width >= comp.height;

            const padR = Math.min(20, Math.min(comp.width, comp.height) * 0.22);
            const p1 = isHoriz ? [comp.x + padR, cy] : [cx, comp.y + padR];
            const p2 = isHoriz ? [comp.x + comp.width - padR, cy] : [cx, comp.y + comp.height - padR];

            const lead = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            lead.setAttribute('x1', p1[0]); lead.setAttribute('y1', p1[1]);
            lead.setAttribute('x2', p2[0]); lead.setAttribute('y2', p2[1]);
            lead.setAttribute('stroke', isCad ? 'rgba(56,189,248,0.7)' : '#94a3b8');
            lead.setAttribute('stroke-width', '4');
            g.appendChild(lead);

            const bodyW = isHoriz ? comp.width * 0.86 : comp.width * 0.88;
            const bodyH = isHoriz ? comp.height * 0.88 : comp.height * 0.86;
            const bx = cx - bodyW / 2;
            const by = cy - bodyH / 2;
            const bodyR = Math.min(bodyW, bodyH) / 2;

            const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            body.className.baseVal = 'comp-body';
            body.setAttribute('x', bx);
            body.setAttribute('y', by);
            body.setAttribute('width', bodyW);
            body.setAttribute('height', bodyH);
            body.setAttribute('rx', bodyR);
            body.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#ea580c'));
            body.setAttribute('fill-opacity', fillOp.toString());
            body.setAttribute('stroke', strokeColor);
            body.setAttribute('stroke-width', strokeWidth);
            g.appendChild(body);

            const innerRim = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            innerRim.setAttribute('x', bx + 4);
            innerRim.setAttribute('y', by + 4);
            innerRim.setAttribute('width', bodyW - 8);
            innerRim.setAttribute('height', bodyH - 8);
            innerRim.setAttribute('rx', Math.max(2, bodyR - 4));
            innerRim.setAttribute('fill', 'none');
            innerRim.setAttribute('stroke', isCad ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.35)');
            innerRim.setAttribute('stroke-width', '1.5');
            g.appendChild(innerRim);

            if (this.settings.showPads) {
                g.appendChild(this.createPinPadElement(comp, 1, p1[0], p1[1], { r: padR, label: '1' }));
                g.appendChild(this.createPinPadElement(comp, 2, p2[0], p2[1], { r: padR, label: '2' }));
            }
            return;
        }

        // =========================================================================
        // 1.1. МОНОЛИТНЫЙ ВЫВОДНОЙ КЕРАМИЧЕСКИЙ КОНДЕНСАТОР (CAP-CERAMIC-MONO / К10-17Б "Капелька")
        // =========================================================================
        if (fp.startsWith('CAP-CERAMIC-MONO') || fp.startsWith('CAP-MONO')) {
            const cx = comp.x + comp.width / 2;
            const cy = comp.y + comp.height / 2;
            const isHoriz = comp.width >= comp.height;

            const padR = Math.min(20, Math.min(comp.width, comp.height) * 0.22);
            const p1 = isHoriz ? [comp.x + padR, cy] : [cx, comp.y + padR];
            const p2 = isHoriz ? [comp.x + comp.width - padR, cy] : [cx, comp.y + comp.height - padR];

            const lead = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            lead.setAttribute('x1', p1[0]); lead.setAttribute('y1', p1[1]);
            lead.setAttribute('x2', p2[0]); lead.setAttribute('y2', p2[1]);
            lead.setAttribute('stroke', isCad ? 'rgba(56,189,248,0.7)' : '#94a3b8');
            lead.setAttribute('stroke-width', '4');
            g.appendChild(lead);

            const bodyW = isHoriz ? comp.width * 0.86 : comp.width * 0.88;
            const bodyH = isHoriz ? comp.height * 0.88 : comp.height * 0.86;
            const bx = cx - bodyW / 2;
            const by = cy - bodyH / 2;
            const bodyR = Math.min(bodyW, bodyH) * 0.35;

            const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            body.className.baseVal = 'comp-body';
            body.setAttribute('x', bx);
            body.setAttribute('y', by);
            body.setAttribute('width', bodyW);
            body.setAttribute('height', bodyH);
            body.setAttribute('rx', bodyR);
            body.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#eab308'));
            body.setAttribute('fill-opacity', fillOp.toString());
            body.setAttribute('stroke', strokeColor);
            body.setAttribute('stroke-width', strokeWidth);
            g.appendChild(body);

            if (this.settings.showPads) {
                g.appendChild(this.createPinPadElement(comp, 1, p1[0], p1[1], { r: padR, label: '1' }));
                g.appendChild(this.createPinPadElement(comp, 2, p2[0], p2[1], { r: padR, label: '2' }));
            }
            return;
        }

        // =========================================================================
        // 2. ТРАНЗИСТОРЫ TO-92 (КТ3102 / КТ3107 — V13..V16, V1, V5, V6, V11)
        // =========================================================================
        if (fp === 'TO-92') {
            const w = comp.width;
            const h = comp.height;
            const cx = comp.x + w / 2;
            const cy = comp.y + h / 2;
            const r = Math.min(w, h) * 0.48;

            const yFlat = cy - r * 0.80;
            const dy = cy - yFlat;
            const dx = Math.sqrt(Math.max(0, r * r - dy * dy));
            const x1 = cx - dx;
            const x2 = cx + dx;

            // Основной D-образный корпус TO-92 / КТ-26
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.className.baseVal = 'comp-body';
            path.setAttribute('d', `M ${x2.toFixed(1)} ${yFlat.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${x1.toFixed(1)} ${yFlat.toFixed(1)} Z`);
            path.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#0f172a'));
            path.setAttribute('fill-opacity', fillOp.toString());
            path.setAttribute('stroke', strokeColor);
            path.setAttribute('stroke-width', strokeWidth);
            g.appendChild(path);

            // Фаска / грань на срезе корпуса
            const flatFace = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            flatFace.setAttribute('x1', (x1 + 6).toFixed(1));
            flatFace.setAttribute('y1', (yFlat + 3).toFixed(1));
            flatFace.setAttribute('x2', (x2 - 6).toFixed(1));
            flatFace.setAttribute('y2', (yFlat + 3).toFixed(1));
            flatFace.setAttribute('stroke', isSelected ? '#38bdf8' : (isCad ? '#38bdf8' : '#94a3b8'));
            flatFace.setAttribute('stroke-width', '3.5');
            flatFace.setAttribute('stroke-linecap', 'round');
            g.appendChild(flatFace);

            // 3 контакта Э-Б-К (Эмиттер, База, Коллектор)
            if (this.settings.showPads) {
                const pinSpacing = r * 0.50;
                const py = cy + r * 0.14;
                const pinXs = [cx - pinSpacing, cx, cx + pinSpacing];
                const labels = ['E', 'B', 'C'];

                pinXs.forEach((px, idx) => {
                    g.appendChild(this.createPinPadElement(comp, idx + 1, px, py, {
                        r: 15,
                        shape: idx === 0 ? 'square' : 'circle',
                        isPin1: idx === 0,
                        label: labels[idx],
                        labelPos: 'bottom',
                        fontSize: 18
                    }));
                });
            }
            return;
        }

        // =========================================================================
        // 3. ТРАНЗИСТОР TO-126 С ФЛАНЦЕМ (КТ815 / КТ973 / BD139 — V3, V11)
        // =========================================================================
        if (fp === 'TO-126' || fp.startsWith('TO-126')) {
            const w = comp.width;
            const h = comp.height;
            const cx = comp.x + w / 2;
            const cy = comp.y + h / 2;
            const isVerticalMount = h >= w * 1.4;

            if (isVerticalMount) {
                // Вертикальное расположение (точно как в оригинале на плате Пиррс 1000 Люкс для V11)
                // 1. Основной прямоугольный шелкографический контур корпуса
                const bodyRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bodyRect.className.baseVal = 'comp-body';
                bodyRect.setAttribute('x', comp.x.toFixed(1));
                bodyRect.setAttribute('y', comp.y.toFixed(1));
                bodyRect.setAttribute('width', w.toFixed(1));
                bodyRect.setAttribute('height', h.toFixed(1));
                bodyRect.setAttribute('rx', '3');
                bodyRect.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#0f172a'));
                bodyRect.setAttribute('fill-opacity', fillOp.toString());
                bodyRect.setAttribute('stroke', strokeColor);
                bodyRect.setAttribute('stroke-width', strokeWidth);
                g.appendChild(bodyRect);

                // 2. Три горизонтальные отметки/вывода на левой грани (как на оригинальном чертеже)
                const pinYs = [comp.y + h * 0.408, comp.y + h * 0.550, comp.y + h * 0.686];
                pinYs.forEach(py => {
                    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    tick.setAttribute('x1', (comp.x - 6).toFixed(1));
                    tick.setAttribute('y1', py.toFixed(1));
                    tick.setAttribute('x2', (comp.x + w * 0.32).toFixed(1));
                    tick.setAttribute('y2', py.toFixed(1));
                    tick.setAttribute('stroke', isCad ? '#38bdf8' : (isBottom ? '#38bdf8' : '#94a3b8'));
                    tick.setAttribute('stroke-width', '3.5');
                    tick.setAttribute('stroke-linecap', 'round');
                    g.appendChild(tick);
                });

                // 3. Нижняя косая риска-ключ в левом нижнем углу (согласно чертежу платы)
                const keyNotch = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                keyNotch.setAttribute('x1', (comp.x + 2).toFixed(1));
                keyNotch.setAttribute('y1', (comp.y + h * 0.90).toFixed(1));
                keyNotch.setAttribute('x2', (comp.x + w * 0.45).toFixed(1));
                keyNotch.setAttribute('y2', (comp.y + h * 0.84).toFixed(1));
                keyNotch.setAttribute('stroke', isCad ? '#38bdf8' : '#94a3b8');
                keyNotch.setAttribute('stroke-width', '3');
                keyNotch.setAttribute('stroke-linecap', 'round');
                g.appendChild(keyNotch);

                // 4. Три контактные площадки (1-E: квадрат, 2-C: круг, 3-B: круг)
                if (this.settings.showPads) {
                    const padX = comp.x + w * 0.17;
                    const padPositions = [
                        { pin: 1, y: pinYs[0], shape: 'square', label: 'E', isPin1: true },
                        { pin: 2, y: pinYs[1], shape: 'circle', label: 'C', isPin1: false },
                        { pin: 3, y: pinYs[2], shape: 'circle', label: 'B', isPin1: false }
                    ];
                    const padSize = Math.max(28, w * 0.16);

                    padPositions.forEach(p => {
                        g.appendChild(this.createPinPadElement(comp, p.pin, padX, p.y, {
                            w: padSize,
                            h: padSize,
                            r: padSize / 2,
                            shape: p.shape,
                            isPin1: p.isPin1,
                            label: p.label,
                            labelPos: 'right',
                            fontSize: 18
                        }));
                    });
                }
            } else {
                // Стандартное горизонтальное/прямое расположение
                const flangeW = w * 0.86;
                const flangeH = h * 0.28;
                const flangeX = comp.x + (w - flangeW) / 2;
                const flangeY = comp.y;

                const flange = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                flange.setAttribute('x', flangeX.toFixed(1));
                flange.setAttribute('y', flangeY.toFixed(1));
                flange.setAttribute('width', flangeW.toFixed(1));
                flange.setAttribute('height', flangeH.toFixed(1));
                flange.setAttribute('rx', '4');
                flange.setAttribute('fill', isCad ? 'rgba(56,189,248,0.3)' : (isBottom ? '#38bdf8' : '#94a3b8'));
                flange.setAttribute('fill-opacity', (fillOp * 0.9).toString());
                flange.setAttribute('stroke', strokeColor);
                flange.setAttribute('stroke-width', strokeWidth);
                g.appendChild(flange);

                const holeCy = flangeY + flangeH * 0.48;
                const holeR = Math.max(12, Math.min(w, h) * 0.08);

                const fHole = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                fHole.setAttribute('cx', cx.toFixed(1));
                fHole.setAttribute('cy', holeCy.toFixed(1));
                fHole.setAttribute('r', holeR.toFixed(1));
                fHole.setAttribute('fill', '#060911');
                fHole.setAttribute('stroke', strokeColor);
                fHole.setAttribute('stroke-width', '2');
                g.appendChild(fHole);

                const bodyY = comp.y + flangeH * 0.65;
                const bodyH = h - flangeH * 0.65;

                const bodyRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bodyRect.className.baseVal = 'comp-body';
                bodyRect.setAttribute('x', comp.x.toFixed(1));
                bodyRect.setAttribute('y', bodyY.toFixed(1));
                bodyRect.setAttribute('width', w.toFixed(1));
                bodyRect.setAttribute('height', bodyH.toFixed(1));
                bodyRect.setAttribute('rx', '6');
                bodyRect.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#0f172a'));
                bodyRect.setAttribute('fill-opacity', fillOp.toString());
                bodyRect.setAttribute('stroke', strokeColor);
                bodyRect.setAttribute('stroke-width', strokeWidth);
                g.appendChild(bodyRect);

                if (this.settings.showPads) {
                    const py = comp.y + h - Math.max(16, h * 0.08);
                    const pinXs = [
                        comp.x + w * 0.20,
                        comp.x + w * 0.50,
                        comp.x + w * 0.80
                    ];
                    const labels = ['E', 'C', 'B'];
                    const padSize = Math.max(22, Math.min(w, h) * 0.085);

                    pinXs.forEach((px, idx) => {
                        g.appendChild(this.createPinPadElement(comp, idx + 1, px, py, {
                            w: padSize,
                            h: padSize,
                            r: padSize / 2,
                            shape: idx === 0 ? 'square' : 'circle',
                            isPin1: idx === 0,
                            label: labels[idx],
                            labelPos: 'top',
                            fontSize: 18
                        }));
                    });
                }
            }
            return;
        }

        // =========================================================================
        // 4.0. ПОДСТРОЕЧНЫЕ И ПЕРЕМЕННЫЕ РЕЗИСТОРЫ (RES-TRIM-ROUND / СП3-19 / Bourns 3386 / 3296)
        // =========================================================================
        if (fp.startsWith('RES-TRIM') || fp.startsWith('POT')) {
            const cx = comp.x + comp.width / 2;
            const cy = comp.y + comp.height / 2;
            const w = comp.width;
            const h = comp.height;
            const isRound = fp.includes('ROUND') || fp.includes('SP3') || fp.includes('3386') || !fp.includes('3296');

            if (isRound) {
                const r = Math.min(w, h) / 2 - 6;
                const flatCut = r * 0.82;

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.className.baseVal = 'comp-body';

                const dy = flatCut;
                const dx = Math.sqrt(Math.max(0, r * r - dy * dy));
                const x1 = cx - dx;
                const x2 = cx + dx;
                const yFlat = cy + dy;

                path.setAttribute('d', `M ${x1.toFixed(1)} ${yFlat.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${x2.toFixed(1)} ${yFlat.toFixed(1)} Z`);
                path.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#1e3a8a'));
                path.setAttribute('fill-opacity', fillOp.toString());
                path.setAttribute('stroke', strokeColor);
                path.setAttribute('stroke-width', strokeWidth);
                g.appendChild(path);

                const rotorR = r * 0.40;
                const rotor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                rotor.setAttribute('cx', cx.toFixed(1));
                rotor.setAttribute('cy', (cy - 4).toFixed(1));
                rotor.setAttribute('r', rotorR.toFixed(1));
                rotor.setAttribute('fill', isCad ? 'rgba(56,189,248,0.35)' : '#cbd5e1');
                rotor.setAttribute('stroke', isCad ? '#38bdf8' : '#64748b');
                rotor.setAttribute('stroke-width', '2');
                g.appendChild(rotor);

                const slot = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                const slotLen = rotorR * 0.75;
                slot.setAttribute('x1', (cx - slotLen * 0.707).toFixed(1));
                slot.setAttribute('y1', (cy - 4 - slotLen * 0.707).toFixed(1));
                slot.setAttribute('x2', (cx + slotLen * 0.707).toFixed(1));
                slot.setAttribute('y2', (cy - 4 + slotLen * 0.707).toFixed(1));
                slot.setAttribute('stroke', isCad ? '#38bdf8' : '#1e293b');
                slot.setAttribute('stroke-width', '4');
                slot.setAttribute('stroke-linecap', 'round');
                g.appendChild(slot);

                if (this.settings.showPads) {
                    const padPins = [
                        { pin: 1, x: cx - r * 0.55, y: cy + r * 0.52, isWiper: false, shape: 'circle', label: '1' },
                        { pin: 2, x: cx, y: cy - r * 0.62, isWiper: true, shape: 'square', label: 'W' },
                        { pin: 3, x: cx + r * 0.55, y: cy + r * 0.52, isWiper: false, shape: 'circle', label: '3' }
                    ];

                    padPins.forEach(p => {
                        g.appendChild(this.createPinPadElement(comp, p.pin, p.x, p.y, {
                            r: 18,
                            w: 36,
                            h: 36,
                            shape: p.shape,
                            isWiper: p.isWiper,
                            isPin1: p.pin === 1,
                            label: p.label
                        }));
                    });
                }
            } else {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.className.baseVal = 'comp-body';
                rect.setAttribute('x', comp.x);
                rect.setAttribute('y', comp.y);
                rect.setAttribute('width', w);
                rect.setAttribute('height', h);
                rect.setAttribute('rx', '6');
                rect.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#1e3a8a'));
                rect.setAttribute('fill-opacity', fillOp.toString());
                rect.setAttribute('stroke', strokeColor);
                rect.setAttribute('stroke-width', strokeWidth);
                g.appendChild(rect);

                if (this.settings.showPads) {
                    const pinX = [comp.x + w * 0.20, cx, comp.x + w * 0.80];
                    pinX.forEach((px, idx) => {
                        g.appendChild(this.createPinPadElement(comp, idx + 1, px, cy, {
                            r: 16,
                            w: 32,
                            h: 32,
                            shape: idx === 1 ? 'square' : 'circle',
                            isWiper: idx === 1,
                            isPin1: idx === 0,
                            label: idx === 1 ? 'W' : (idx + 1).toString()
                        }));
                    });
                }
            }
            return;
        }

        // =========================================================================
        // 4. РЕЗИСТОР (RES-AXIAL / МЛТ)
        // =========================================================================
        if (fp.startsWith('RES')) {
            const cx = comp.x + comp.width / 2;
            const cy = comp.y + comp.height / 2;
            const isHoriz = comp.width >= comp.height;
            const padR = Math.min(20, Math.min(comp.width, comp.height) * 0.22);

            if (isHoriz) {
                const lead = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                lead.setAttribute('x1', comp.x + padR);
                lead.setAttribute('y1', cy);
                lead.setAttribute('x2', comp.x + comp.width - padR);
                lead.setAttribute('y2', cy);
                lead.setAttribute('stroke', isCad ? 'rgba(56,189,248,0.7)' : '#94a3b8');
                lead.setAttribute('stroke-width', '4');
                g.appendChild(lead);

                const bodyW = comp.width * 0.52;
                const bodyH = comp.height * 0.65;
                const bx = cx - bodyW / 2;
                const by = cy - bodyH / 2;

                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.className.baseVal = 'comp-body';
                rect.setAttribute('x', bx);
                rect.setAttribute('y', by);
                rect.setAttribute('width', bodyW);
                rect.setAttribute('height', bodyH);
                rect.setAttribute('rx', '6');
                rect.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#b45309'));
                rect.setAttribute('fill-opacity', fillOp.toString());
                rect.setAttribute('stroke', strokeColor);
                rect.setAttribute('stroke-width', strokeWidth);
                g.appendChild(rect);

                const capW = Math.max(14, bodyW * 0.12);
                [bx, bx + bodyW - capW].forEach(cxPos => {
                    const cap = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    cap.setAttribute('x', cxPos);
                    cap.setAttribute('y', by);
                    cap.setAttribute('width', capW);
                    cap.setAttribute('height', bodyH);
                    cap.setAttribute('rx', '2');
                    cap.setAttribute('fill', isCad ? 'rgba(56,189,248,0.3)' : '#cbd5e1');
                    cap.setAttribute('stroke', strokeColor);
                    cap.setAttribute('stroke-width', '2');
                    g.appendChild(cap);
                });

                // ГОСТ-обозначение мощности
                const slash = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                slash.setAttribute('x1', cx - 18);
                slash.setAttribute('y1', cy + bodyH * 0.35);
                slash.setAttribute('x2', cx + 18);
                slash.setAttribute('y2', cy - bodyH * 0.35);
                slash.setAttribute('stroke', isCad ? 'rgba(56,189,248,0.6)' : '#ffffff');
                slash.setAttribute('stroke-width', '3');
                g.appendChild(slash);

                if (this.settings.showPads) {
                    g.appendChild(this.createPinPadElement(comp, 1, comp.x + padR, cy, { r: padR, label: '1' }));
                    g.appendChild(this.createPinPadElement(comp, 2, comp.x + comp.width - padR, cy, { r: padR, label: '2' }));
                }
            } else {
                // Вертикальный резистор
                const lead = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                lead.setAttribute('x1', cx);
                lead.setAttribute('y1', comp.y + padR);
                lead.setAttribute('x2', cx);
                lead.setAttribute('y2', comp.y + comp.height - padR);
                lead.setAttribute('stroke', isCad ? 'rgba(56,189,248,0.7)' : '#94a3b8');
                lead.setAttribute('stroke-width', '4');
                g.appendChild(lead);

                const bodyW = comp.width * 0.65;
                const bodyH = comp.height * 0.52;
                const bx = cx - bodyW / 2;
                const by = cy - bodyH / 2;

                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.className.baseVal = 'comp-body';
                rect.setAttribute('x', bx);
                rect.setAttribute('y', by);
                rect.setAttribute('width', bodyW);
                rect.setAttribute('height', bodyH);
                rect.setAttribute('rx', '6');
                rect.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#b45309'));
                rect.setAttribute('fill-opacity', fillOp.toString());
                rect.setAttribute('stroke', strokeColor);
                rect.setAttribute('stroke-width', strokeWidth);
                g.appendChild(rect);

                const capH = Math.max(14, bodyH * 0.12);
                [by, by + bodyH - capH].forEach(cyPos => {
                    const cap = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    cap.setAttribute('x', bx);
                    cap.setAttribute('y', cyPos);
                    cap.setAttribute('width', bodyW);
                    cap.setAttribute('height', capH);
                    cap.setAttribute('rx', '2');
                    cap.setAttribute('fill', isCad ? 'rgba(56,189,248,0.3)' : '#cbd5e1');
                    cap.setAttribute('stroke', strokeColor);
                    cap.setAttribute('stroke-width', '2');
                    g.appendChild(cap);
                });

                if (this.settings.showPads) {
                    g.appendChild(this.createPinPadElement(comp, 1, cx, comp.y + padR, { r: padR, label: '1' }));
                    g.appendChild(this.createPinPadElement(comp, 2, cx, comp.y + comp.height - padR, { r: padR, label: '2' }));
                }
            }
            return;
        }

        // =========================================================================
        // 6. ЭЛЕКТРОЛИТИЧЕСКИЙ РАДИАЛЬНЫЙ КОНДЕНСАТОР (CAP-RADIAL / К50-35)
        // =========================================================================
        if (fp === 'CAP-RADIAL' || fp.startsWith('CAP-RADIAL')) {
            const cx = comp.x + comp.width / 2;
            const cy = comp.y + comp.height / 2;
            const r = Math.min(comp.width, comp.height) / 2 - 8;
            const padDist = r * 0.42;

            // Корпус (круглый металлический бочонок)
            const can = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            can.className.baseVal = 'comp-body';
            can.setAttribute('cx', cx);
            can.setAttribute('cy', cy);
            can.setAttribute('r', r);
            can.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0369a1' : '#047857'));
            can.setAttribute('fill-opacity', fillOp.toString());
            can.setAttribute('stroke', strokeColor);
            can.setAttribute('stroke-width', strokeWidth);
            g.appendChild(can);

            // Контрастная минусовая полоса (Катод) — правильный круговой сегмент (хорда)
            const chordX = cx + r * 0.35;
            const dx = chordX - cx;
            const dy = Math.sqrt(Math.max(0, r * r - dx * dx));

            const minusBar = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            minusBar.setAttribute('d', `M ${chordX.toFixed(1)} ${(cy - dy).toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${chordX.toFixed(1)} ${(cy + dy).toFixed(1)} Z`);
            minusBar.setAttribute('fill', isCad ? 'rgba(56,189,248,0.25)' : 'rgba(255,255,255,0.25)');
            minusBar.setAttribute('stroke', strokeColor);
            minusBar.setAttribute('stroke-width', strokeWidth);
            g.appendChild(minusBar);

            // Символы «−» на минусовой полосе (сверху и снизу от катодного вывода)
            const mX = cx + r * 0.65;
            const minusFontSize = Math.max(18, Math.round(r * 0.16));

            const mText1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            mText1.className.baseVal = 'comp-silk-mark';
            mText1.setAttribute('x', mX.toFixed(1));
            mText1.setAttribute('y', (cy - r * 0.45).toFixed(1));
            mText1.setAttribute('fill', strokeColor);
            mText1.setAttribute('font-size', `${minusFontSize}px`);
            mText1.setAttribute('font-weight', 'bold');
            mText1.setAttribute('text-anchor', 'middle');
            mText1.setAttribute('dominant-baseline', 'middle');
            mText1.textContent = '−';
            g.appendChild(mText1);

            const mText2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            mText2.className.baseVal = 'comp-silk-mark';
            mText2.setAttribute('x', mX.toFixed(1));
            mText2.setAttribute('y', (cy + r * 0.45).toFixed(1));
            mText2.setAttribute('fill', strokeColor);
            mText2.setAttribute('font-size', `${minusFontSize}px`);
            mText2.setAttribute('font-weight', 'bold');
            mText2.setAttribute('text-anchor', 'middle');
            mText2.setAttribute('dominant-baseline', 'middle');
            mText2.textContent = '−';
            g.appendChild(mText2);

            // Четкий знак «+» у плюсовой клеммы (Анод, Pin 1)
            const plusFontSize = Math.max(22, Math.round(r * 0.20));
            const plusMark = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            plusMark.className.baseVal = 'comp-silk-mark';
            plusMark.setAttribute('x', (cx - padDist).toFixed(1));
            plusMark.setAttribute('y', (cy - Math.max(30, r * 0.35)).toFixed(1));
            plusMark.setAttribute('fill', strokeColor);
            plusMark.setAttribute('font-size', `${plusFontSize}px`);
            plusMark.setAttribute('font-weight', 'bold');
            plusMark.setAttribute('text-anchor', 'middle');
            plusMark.setAttribute('dominant-baseline', 'middle');
            plusMark.textContent = '+';
            g.appendChild(plusMark);

            if (this.settings.showPads) {
                const padSize = Math.max(28, Math.round(r * 0.16));
                const padRadius = Math.max(16, Math.round(r * 0.09));

                // Pin 1: + (Анод), квадратный пад
                g.appendChild(this.createPinPadElement(comp, 1, cx - padDist, cy, {
                    w: padSize,
                    h: padSize,
                    shape: 'square',
                    isPin1: true,
                    label: '+',
                    labelPos: 'top',
                    fontSize: 22
                }));

                // Pin 2: - (Катод), круглый пад
                g.appendChild(this.createPinPadElement(comp, 2, cx + padDist, cy, {
                    r: padRadius,
                    shape: 'circle',
                    isPin1: false,
                    label: '−',
                    labelPos: 'top',
                    fontSize: 22
                }));
            }
            return;
        }

        // =========================================================================
        // 7. ДИОДЫ И СТАБИЛИТРОНЫ (DIODE-AXIAL / КД522, 1N4148, 1N4007)
        // =========================================================================
        if (fp.startsWith('DIODE-AXIAL') || fp.startsWith('DIODE-DO')) {
            const cx = comp.x + comp.width / 2;
            const cy = comp.y + comp.height / 2;
            const isHoriz = comp.width >= comp.height;
            const padR = Math.min(18, Math.min(comp.width, comp.height) * 0.22);

            if (isHoriz) {
                const lead = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                lead.setAttribute('x1', comp.x + padR);
                lead.setAttribute('y1', cy);
                lead.setAttribute('x2', comp.x + comp.width - padR);
                lead.setAttribute('y2', cy);
                lead.setAttribute('stroke', isCad ? 'rgba(56,189,248,0.7)' : '#94a3b8');
                lead.setAttribute('stroke-width', '4');
                g.appendChild(lead);

                const bodyW = comp.width * 0.60;
                const bodyH = comp.height * 0.85;
                const bx = cx - bodyW / 2;
                const by = cy - bodyH / 2;

                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.className.baseVal = 'comp-body';
                rect.setAttribute('x', bx);
                rect.setAttribute('y', by);
                rect.setAttribute('width', bodyW);
                rect.setAttribute('height', bodyH);
                rect.setAttribute('rx', '8');
                rect.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#dc2626'));
                rect.setAttribute('fill-opacity', fillOp.toString());
                rect.setAttribute('stroke', strokeColor);
                rect.setAttribute('stroke-width', strokeWidth);
                g.appendChild(rect);

                // Полоса катода (белая полоса у вывода 1 / слева)
                const stripe = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                stripe.setAttribute('x', bx + 12);
                stripe.setAttribute('y', by);
                stripe.setAttribute('width', 18);
                stripe.setAttribute('height', bodyH);
                stripe.setAttribute('fill', '#ffffff');
                stripe.setAttribute('opacity', '0.95');
                g.appendChild(stripe);

                // Схематический символ диода (⯈|)
                const sym = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const s = Math.min(bodyH * 0.45, 28);
                sym.setAttribute('d', `M ${cx + s * 0.7} ${cy - s} L ${cx - s * 0.7} ${cy} L ${cx + s * 0.7} ${cy + s} Z M ${cx - s * 0.7} ${cy - s} L ${cx - s * 0.7} ${cy + s}`);
                sym.setAttribute('fill', isCad ? 'rgba(56,189,248,0.6)' : '#ffffff');
                sym.setAttribute('stroke', strokeColor);
                sym.setAttribute('stroke-width', '2');
                g.appendChild(sym);

                if (this.settings.showPads) {
                    // Pin 1: K (Катод), Pin 2: A (Анод)
                    g.appendChild(this.createPinPadElement(comp, 1, comp.x + padR, cy, { r: padR, isPin1: true, label: 'K', labelPos: 'top' }));
                    g.appendChild(this.createPinPadElement(comp, 2, comp.x + comp.width - padR, cy, { r: padR, isPin1: false, label: 'A', labelPos: 'top' }));
                }
            } else {
                const lead = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                lead.setAttribute('x1', cx);
                lead.setAttribute('y1', comp.y + padR);
                lead.setAttribute('x2', cx);
                lead.setAttribute('y2', comp.y + comp.height - padR);
                lead.setAttribute('stroke', isCad ? 'rgba(56,189,248,0.7)' : '#94a3b8');
                lead.setAttribute('stroke-width', '4');
                g.appendChild(lead);

                const bodyW = comp.width * 0.85;
                const bodyH = comp.height * 0.60;
                const bx = cx - bodyW / 2;
                const by = cy - bodyH / 2;

                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.className.baseVal = 'comp-body';
                rect.setAttribute('x', bx);
                rect.setAttribute('y', by);
                rect.setAttribute('width', bodyW);
                rect.setAttribute('height', bodyH);
                rect.setAttribute('rx', '8');
                rect.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#dc2626'));
                rect.setAttribute('fill-opacity', fillOp.toString());
                rect.setAttribute('stroke', strokeColor);
                rect.setAttribute('stroke-width', strokeWidth);
                g.appendChild(rect);

                const stripe = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                stripe.setAttribute('x', bx);
                stripe.setAttribute('y', by + 12);
                stripe.setAttribute('width', bodyW);
                stripe.setAttribute('height', 18);
                stripe.setAttribute('fill', '#ffffff');
                stripe.setAttribute('opacity', '0.95');
                g.appendChild(stripe);

                if (this.settings.showPads) {
                    g.appendChild(this.createPinPadElement(comp, 1, cx, comp.y + padR, { r: padR, isPin1: true, label: 'K', labelPos: 'right' }));
                    g.appendChild(this.createPinPadElement(comp, 2, cx, comp.y + comp.height - padR, { r: padR, isPin1: false, label: 'A', labelPos: 'right' }));
                }
            }
            return;
        }

        // =========================================================================
        // 7.1. ВЫВОДНЫЕ СВЕТОДИОДЫ (LED-THT-5MM / LED-THT-3MM)
        // =========================================================================
        if (fp.startsWith('LED-THT') || fp.startsWith('LED-5MM') || fp.startsWith('LED-3MM')) {
            const cx = comp.x + comp.width / 2;
            const cy = comp.y + comp.height / 2;
            const r = Math.min(comp.width, comp.height) / 2 - 8;

            // D-образная линза светодиода со срезом фланца на стороне катода (Pin 2 / справа)
            const flatX = cx + r * 0.78;
            const dy = Math.sqrt(Math.max(0, r * r - (flatX - cx) * (flatX - cx)));
            
            const lens = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            lens.className.baseVal = 'comp-body';
            lens.setAttribute('d', `M ${flatX.toFixed(1)} ${(cy - dy).toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${flatX.toFixed(1)} ${(cy + dy).toFixed(1)} Z`);
            lens.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#16a34a')); // Зеленый/красный купол
            lens.setAttribute('fill-opacity', fillOp.toString());
            lens.setAttribute('stroke', strokeColor);
            lens.setAttribute('stroke-width', strokeWidth);
            g.appendChild(lens);

            // Внутренняя светящаяся чашечка рефлектора
            const reflector = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            reflector.setAttribute('cx', (cx - 6).toFixed(1));
            reflector.setAttribute('cy', cy.toFixed(1));
            reflector.setAttribute('r', (r * 0.52).toFixed(1));
            reflector.setAttribute('fill', isCad ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.4)');
            reflector.setAttribute('stroke', strokeColor);
            reflector.setAttribute('stroke-width', '1.5');
            g.appendChild(reflector);

            if (this.settings.showPads) {
                const padDist = r * 0.45;
                // Pin 1: Анод (A / +), квадратный пад слева
                g.appendChild(this.createPinPadElement(comp, 1, cx - padDist, cy, {
                    w: 32,
                    h: 32,
                    shape: 'square',
                    isPin1: true,
                    label: 'A (+)',
                    labelPos: 'top',
                    fontSize: 18
                }));

                // Pin 2: Катод (K / -), круглый пад справа у среза фланца
                g.appendChild(this.createPinPadElement(comp, 2, cx + padDist, cy, {
                    r: 16,
                    shape: 'circle',
                    isPin1: false,
                    label: 'K (−)',
                    labelPos: 'top',
                    fontSize: 18
                }));
            }
            return;
        }

        // =========================================================================
        // 7.2. ВЫПРЯМИТЕЛЬНЫЕ ДИОДНЫЕ МОСТЫ (BRIDGE-DIP4 / WOB / DB-S)
        // =========================================================================
        if (fp.startsWith('BRIDGE') || fp.startsWith('DB-')) {
            const w = comp.width;
            const h = comp.height;

            // Корпус со скошенным углом у вывода 1 (+)
            const chamfer = 24;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.className.baseVal = 'comp-body';
            path.setAttribute('d', `
                M ${comp.x + chamfer} ${comp.y}
                L ${comp.x + w - 8} ${comp.y}
                A 8 8 0 0 1 ${comp.x + w} ${comp.y + 8}
                L ${comp.x + w} ${comp.y + h - 8}
                A 8 8 0 0 1 ${comp.x + w - 8} ${comp.y + h}
                L ${comp.x + 8} ${comp.y + h}
                A 8 8 0 0 1 ${comp.x} ${comp.y + h - 8}
                L ${comp.x} ${comp.y + chamfer}
                Z
            `);
            path.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#0f172a'));
            path.setAttribute('fill-opacity', fillOp.toString());
            path.setAttribute('stroke', strokeColor);
            path.setAttribute('stroke-width', strokeWidth);
            g.appendChild(path);

            // Обозначения выводов шелкографией: +, -, ~, ~
            const marks = [
                { text: '+', x: comp.x + 36, y: comp.y + 44, color: '#ef4444' },
                { text: '−', x: comp.x + w - 36, y: comp.y + 44, color: '#94a3b8' },
                { text: '~', x: comp.x + w - 36, y: comp.y + h - 28, color: '#38bdf8' },
                { text: '~', x: comp.x + 36, y: comp.y + h - 28, color: '#38bdf8' }
            ];

            marks.forEach(m => {
                const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                t.setAttribute('x', m.x);
                t.setAttribute('y', m.y);
                t.setAttribute('fill', m.color);
                t.setAttribute('font-size', '28px');
                t.setAttribute('font-weight', 'bold');
                t.setAttribute('text-anchor', 'middle');
                t.textContent = m.text;
                g.appendChild(t);
            });

            if (this.settings.showPads) {
                // 4 вывода: 1 (+), 2 (-), 3 (~), 4 (~)
                g.appendChild(this.createPinPadElement(comp, 1, comp.x + 40, comp.y + 40, { w: 34, h: 34, shape: 'square', isPin1: true, label: '+' }));
                g.appendChild(this.createPinPadElement(comp, 2, comp.x + w - 40, comp.y + 40, { r: 17, shape: 'circle', isPin1: false, label: '−' }));
                g.appendChild(this.createPinPadElement(comp, 3, comp.x + w - 40, comp.y + h - 40, { r: 17, shape: 'circle', isPin1: false, label: '~' }));
                g.appendChild(this.createPinPadElement(comp, 4, comp.x + 40, comp.y + h - 40, { r: 17, shape: 'circle', isPin1: false, label: '~' }));
            }
            return;
        }

        // =========================================================================
        // 8. СЕМИСЕГМЕНТНЫЙ ДВУХРАЗРЯДНЫЙ ДИСПЛЕЙ (DISP-7SEG-2)
        // =========================================================================
        if (fp.startsWith('DISP-7SEG')) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.className.baseVal = 'comp-body';
            rect.setAttribute('x', comp.x);
            rect.setAttribute('y', comp.y);
            rect.setAttribute('width', comp.width);
            rect.setAttribute('height', comp.height);
            rect.setAttribute('rx', '16');
            rect.setAttribute('fill', isCad ? bodyFill : '#020617');
            rect.setAttribute('fill-opacity', (fillOp * 0.95).toString());
            rect.setAttribute('stroke', strokeColor);
            rect.setAttribute('stroke-width', strokeWidth);
            g.appendChild(rect);

            const digitW = (comp.width - 180) / 2;
            const digitH = comp.height - 120;
            const digitY = comp.y + 60;

            const render7SegDigit = (dx, dy, dw, dh) => {
                const segColor = isCad ? 'rgba(56,189,248,0.45)' : '#ef4444';
                const segStroke = isCad ? '#38bdf8' : '#991b1b';
                const thick = Math.max(16, dw * 0.14);
                const halfH = dh / 2;

                const segs = [
                    `M ${dx + thick} ${dy} L ${dx + dw - thick} ${dy} L ${dx + dw - thick * 1.6} ${dy + thick} L ${dx + thick * 1.6} ${dy + thick} Z`,
                    `M ${dx + dw} ${dy + thick} L ${dx + dw} ${dy + halfH - thick * 0.4} L ${dx + dw - thick} ${dy + halfH - thick * 0.8} L ${dx + dw - thick} ${dy + thick * 1.6} Z`,
                    `M ${dx + dw} ${dy + halfH + thick * 0.4} L ${dx + dw} ${dy + dh - thick} L ${dx + dw - thick} ${dy + dh - thick * 1.6} L ${dx + dw - thick} ${dy + halfH + thick * 0.8} Z`,
                    `M ${dx + thick * 1.6} ${dy + dh - thick} L ${dx + dw - thick * 1.6} ${dy + dh - thick} L ${dx + dw - thick} ${dy + dh} L ${dx + thick} ${dy + dh} Z`,
                    `M ${dx} ${dy + halfH + thick * 0.4} L ${dx + thick} ${dy + halfH + thick * 0.8} L ${dx + thick} ${dy + dh - thick * 1.6} L ${dx} ${dy + dh - thick} Z`,
                    `M ${dx} ${dy + thick} L ${dx + thick} ${dy + thick * 1.6} L ${dx + thick} ${dy + halfH - thick * 0.8} L ${dx} ${dy + halfH - thick * 0.4} Z`,
                    `M ${dx + thick * 1.2} ${dy + halfH} L ${dx + thick * 1.8} ${dy + halfH - thick * 0.5} L ${dx + dw - thick * 1.8} ${dy + halfH - thick * 0.5} L ${dx + dw - thick * 1.2} ${dy + halfH} L ${dx + dw - thick * 1.8} ${dy + halfH + thick * 0.5} L ${dx + thick * 1.8} ${dy + halfH + thick * 0.5} Z`
                ];

                segs.forEach(d => {
                    const s = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    s.setAttribute('d', d);
                    s.setAttribute('fill', segColor);
                    s.setAttribute('stroke', segStroke);
                    s.setAttribute('stroke-width', '1.5');
                    g.appendChild(s);
                });
            };

            render7SegDigit(comp.x + 60, digitY, digitW, digitH);
            render7SegDigit(comp.x + 100 + digitW, digitY, digitW, digitH);

            if (this.settings.showPads) {
                const pinCount = 9;
                const step = comp.width / (pinCount + 1);
                for (let i = 1; i <= pinCount; i++) {
                    const px = comp.x + i * step;
                    g.appendChild(this.createPinPadElement(comp, i, px, comp.y - 12, { r: 15, isPin1: i === 1 }));
                    g.appendChild(this.createPinPadElement(comp, i + 9, px, comp.y + comp.height + 12, { r: 15 }));
                }
            }
            return;
        }

        // =========================================================================
        // 9. КВАРЦЕВЫЙ ГЕНЕРАТОР И РЕЗОНАТОР (QUARTZ-HC49 / QUARTZ-OSC / B1)
        // =========================================================================
        if (fp.startsWith('QUARTZ') || fp.startsWith('OSC-') || fp.startsWith('XTAL')) {
            const cx = comp.x + comp.width / 2;
            const cy = comp.y + comp.height / 2;
            const isOscillator = fp.includes('OSC') || fp === 'QUARTZ-OSC-DIL8' || fp === 'QUARTZ-OSC-DIL14';

            if (isOscillator) {
                const w = comp.width;
                const h = comp.height;

                const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                body.className.baseVal = 'comp-body';
                body.setAttribute('x', comp.x);
                body.setAttribute('y', comp.y);
                body.setAttribute('width', w);
                body.setAttribute('height', h);
                body.setAttribute('rx', '8');
                body.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#64748b'));
                body.setAttribute('fill-opacity', fillOp.toString());
                body.setAttribute('stroke', strokeColor);
                body.setAttribute('stroke-width', strokeWidth);
                g.appendChild(body);

                // Метка вывода 1 (Красная точка)
                const dot1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                dot1.setAttribute('cx', comp.x + 36);
                dot1.setAttribute('cy', comp.y + 36);
                dot1.setAttribute('r', '10');
                dot1.setAttribute('fill', '#ef4444');
                g.appendChild(dot1);

                const oscSym = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                oscSym.setAttribute('x', cx);
                oscSym.setAttribute('y', cy + 6);
                oscSym.setAttribute('fill', isCad ? '#38bdf8' : '#ffffff');
                oscSym.setAttribute('font-size', '28px');
                oscSym.setAttribute('font-weight', 'bold');
                oscSym.setAttribute('text-anchor', 'middle');
                oscSym.textContent = 'OSC ∿';
                g.appendChild(oscSym);

                if (this.settings.showPads) {
                    g.appendChild(this.createPinPadElement(comp, 1, comp.x + 28, comp.y + 28, { r: 18, isPin1: true }));
                    g.appendChild(this.createPinPadElement(comp, 2, comp.x + w - 28, comp.y + 28, { r: 18 }));
                    g.appendChild(this.createPinPadElement(comp, 3, comp.x + w - 28, comp.y + h - 28, { r: 18 }));
                    g.appendChild(this.createPinPadElement(comp, 4, comp.x + 28, comp.y + h - 28, { r: 18 }));
                }
                return;
            }

            // Кварцевый резонатор (Прямоугольный металлический корпус HC-49)
            const isHoriz = comp.width >= comp.height;

            const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            body.className.baseVal = 'comp-body';
            body.setAttribute('x', comp.x);
            body.setAttribute('y', comp.y);
            body.setAttribute('width', comp.width);
            body.setAttribute('height', comp.height);
            body.setAttribute('rx', '6');
            body.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#94a3b8'));
            body.setAttribute('fill-opacity', fillOp.toString());
            body.setAttribute('stroke', strokeColor);
            body.setAttribute('stroke-width', strokeWidth);
            g.appendChild(body);

            // Металлический ободок прямоугольного корпуса
            const innerRim = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            innerRim.setAttribute('x', comp.x + 4);
            innerRim.setAttribute('y', comp.y + 4);
            innerRim.setAttribute('width', Math.max(10, comp.width - 8));
            innerRim.setAttribute('height', Math.max(10, comp.height - 8));
            innerRim.setAttribute('rx', '3');
            innerRim.setAttribute('fill', 'none');
            innerRim.setAttribute('stroke', isCad ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.35)');
            innerRim.setAttribute('stroke-width', '1.5');
            g.appendChild(innerRim);

            if (this.settings.showPads) {
                if (isHoriz) {
                    const padDist = Math.max(20, comp.width * 0.12);
                    g.appendChild(this.createPinPadElement(comp, 1, comp.x + padDist, cy, { r: 18, isPin1: true, label: '1' }));
                    g.appendChild(this.createPinPadElement(comp, 2, comp.x + comp.width - padDist, cy, { r: 18, isPin1: false, label: '2' }));
                } else {
                    const padDist = Math.max(20, comp.height * 0.12);
                    g.appendChild(this.createPinPadElement(comp, 1, cx, comp.y + padDist, { r: 18, isPin1: true, label: '1' }));
                    g.appendChild(this.createPinPadElement(comp, 2, cx, comp.y + comp.height - padDist, { r: 18, isPin1: false, label: '2' }));
                }
            }
            return;
        }

        // =========================================================================
        // 10. ДРОССЕЛЬ / ИНДУКТИВНОСТЬ (INDUCTOR)
        // =========================================================================
        if (fp.startsWith('INDUCTOR')) {
            const cx = comp.x + comp.width / 2;
            const cy = comp.y + comp.height / 2;
            const r = Math.min(comp.width, comp.height) / 2 - 8;

            const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            ring.className.baseVal = 'comp-body';
            ring.setAttribute('cx', cx);
            ring.setAttribute('cy', cy);
            ring.setAttribute('r', r);
            ring.setAttribute('fill', bodyFill);
            ring.setAttribute('fill-opacity', fillOp.toString());
            ring.setAttribute('stroke', strokeColor);
            ring.setAttribute('stroke-width', strokeWidth);
            g.appendChild(ring);

            if (this.settings.showPads) {
                g.appendChild(this.createPinPadElement(comp, 1, cx - r * 0.45, cy, { r: 18, isPin1: true, label: '1' }));
                g.appendChild(this.createPinPadElement(comp, 2, cx + r * 0.45, cy, { r: 18, isPin1: false, label: '2' }));
            }
            return;
        }

        // =========================================================================
        // 11. КРЕПЕЖНОЕ ОТВЕРСТИЕ (HOLE-3.6 / H1)
        // =========================================================================
        if (fp.startsWith('HOLE')) {
            const cx = comp.x + comp.width / 2;
            const cy = comp.y + comp.height / 2;
            const r = Math.min(comp.width, comp.height) / 2;

            const hOuter = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            hOuter.className.baseVal = 'comp-body';
            hOuter.setAttribute('cx', cx);
            hOuter.setAttribute('cy', cy);
            hOuter.setAttribute('r', r);
            hOuter.setAttribute('fill', isCad ? 'rgba(56,189,248,0.08)' : '#334155');
            hOuter.setAttribute('stroke', '#38bdf8');
            hOuter.setAttribute('stroke-width', strokeWidth);
            g.appendChild(hOuter);

            const hInner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            hInner.setAttribute('cx', cx);
            hInner.setAttribute('cy', cy);
            hInner.setAttribute('r', r * 0.6);
            hInner.setAttribute('fill', '#060911');
            hInner.setAttribute('stroke', '#94a3b8');
            hInner.setAttribute('stroke-width', '2');
            g.appendChild(hInner);
            return;
        }

        // =========================================================================
        // 12. РАЗЪЕМЫ (CONN-HEADER / X1..X5)
        // =========================================================================
        if (fp.startsWith('CONN')) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.className.baseVal = 'comp-body';
            rect.setAttribute('x', comp.x);
            rect.setAttribute('y', comp.y);
            rect.setAttribute('width', comp.width);
            rect.setAttribute('height', comp.height);
            rect.setAttribute('rx', '8');
            rect.setAttribute('fill', bodyFill);
            rect.setAttribute('fill-opacity', fillOp.toString());
            rect.setAttribute('stroke', strokeColor);
            rect.setAttribute('stroke-width', strokeWidth);
            g.appendChild(rect);

            // Ключ-замок от переполюсовки (Key Notch)
            const notch = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            notch.setAttribute('x', comp.x + comp.width * 0.40);
            notch.setAttribute('y', comp.y);
            notch.setAttribute('width', comp.width * 0.20);
            notch.setAttribute('height', 14);
            notch.setAttribute('fill', '#060911');
            notch.setAttribute('stroke', strokeColor);
            notch.setAttribute('stroke-width', '1.5');
            g.appendChild(notch);

            const count = comp.pinCount || (comp.value && comp.value.match(/(\d+)-pin/i) ? parseInt(comp.value.match(/(\d+)-pin/i)[1], 10) : (comp.width > 2000 ? 14 : comp.width > 1200 ? 8 : comp.width > 900 ? 7 : comp.width > 700 ? 5 : 2));
            const pinStep = comp.width / (count + 1);

            // Треугольный маркер вывода 1 (▲)
            const tri = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const p1x = comp.x + pinStep;
            tri.setAttribute('points', `${p1x},${comp.y + 4} ${p1x - 8},${comp.y + 16} ${p1x + 8},${comp.y + 16}`);
            tri.setAttribute('fill', '#ef4444');
            g.appendChild(tri);

            if (this.settings.showPads) {
                const py = comp.y + comp.height / 2;
                for (let i = 1; i <= count; i++) {
                    const px = comp.x + i * pinStep;
                    g.appendChild(this.createPinPadElement(comp, i, px, py, {
                        w: 32,
                        h: 32,
                        r: 16,
                        shape: i === 1 ? 'square' : 'circle',
                        isPin1: i === 1,
                        label: i.toString(),
                        labelPos: 'bottom'
                    }));
                }
            }
            return;
        }

        // =========================================================================
        // SMD ЧИП-КОМПОНЕНТЫ (0805, 1206, 2512, RES/CAP/LED/DIODE)
        // =========================================================================
        if (fp.startsWith('RES-SMD') || fp.startsWith('CAP-SMD') || fp.startsWith('LED-SMD') || fp.startsWith('DIODE-SOD') || fp.startsWith('DIODE-SMA')) {
            const w = comp.width;
            const h = comp.height;
            const padW = Math.max(24, Math.round(w * 0.25));

            const isCap = fp.startsWith('CAP');
            const isLed = fp.startsWith('LED');
            const isDiode = fp.startsWith('DIODE');

            let smdBodyColor = isCad ? bodyFill : (isBottom ? '#0284c7' : (isCap ? '#b45309' : (isLed ? '#047857' : (isDiode ? '#0f172a' : '#1e293b'))));

            const bodyRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bodyRect.className.baseVal = 'comp-body';
            bodyRect.setAttribute('x', comp.x);
            bodyRect.setAttribute('y', comp.y);
            bodyRect.setAttribute('width', w);
            bodyRect.setAttribute('height', h);
            bodyRect.setAttribute('rx', '4');
            bodyRect.setAttribute('fill', smdBodyColor);
            bodyRect.setAttribute('fill-opacity', fillOp.toString());
            bodyRect.setAttribute('stroke', strokeColor);
            bodyRect.setAttribute('stroke-width', strokeWidth);
            g.appendChild(bodyRect);

            // Полоса катода для SMD диодов и светодиодов
            if (isDiode || isLed) {
                const kLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                kLine.setAttribute('x1', comp.x + padW + 6);
                kLine.setAttribute('y1', comp.y + 4);
                kLine.setAttribute('x2', comp.x + padW + 6);
                kLine.setAttribute('y2', comp.y + h - 4);
                kLine.setAttribute('stroke', isCad ? 'rgba(56,189,248,0.8)' : (isLed ? '#22c55e' : '#ffffff'));
                kLine.setAttribute('stroke-width', '4');
                g.appendChild(kLine);
            }

            if (this.settings.showPads) {
                const cy = comp.y + h / 2;
                g.appendChild(this.createPinPadElement(comp, 1, comp.x + padW / 2, cy, {
                    w: padW,
                    h: h + 8,
                    shape: 'rect',
                    isPin1: isDiode || isLed,
                    hasHole: false,
                    label: isDiode || isLed ? 'K' : '1'
                }));
                g.appendChild(this.createPinPadElement(comp, 2, comp.x + w - padW / 2, cy, {
                    w: padW,
                    h: h + 8,
                    shape: 'rect',
                    isPin1: false,
                    hasHole: false,
                    label: isDiode || isLed ? 'A' : '2'
                }));
            }
            return;
        }

        // =========================================================================
        // ТАНТАЛОВЫЙ КОНДЕНСАТОР SMD (CAP-TANT-SMD)
        // =========================================================================
        if (fp.startsWith('CAP-TANT')) {
            const w = comp.width;
            const h = comp.height;

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.className.baseVal = 'comp-body';
            rect.setAttribute('x', comp.x);
            rect.setAttribute('y', comp.y);
            rect.setAttribute('width', w);
            rect.setAttribute('height', h);
            rect.setAttribute('rx', '4');
            rect.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#d97706'));
            rect.setAttribute('fill-opacity', fillOp.toString());
            rect.setAttribute('stroke', strokeColor);
            rect.setAttribute('stroke-width', strokeWidth);
            g.appendChild(rect);

            // Полоса полярности + (Анод)
            const plusBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            plusBar.setAttribute('x', comp.x + 8);
            plusBar.setAttribute('y', comp.y + 4);
            plusBar.setAttribute('width', w * 0.22);
            plusBar.setAttribute('height', h - 8);
            plusBar.setAttribute('rx', '2');
            plusBar.setAttribute('fill', isCad ? 'rgba(56,189,248,0.5)' : '#fef08a');
            g.appendChild(plusBar);

            const plusSign = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            plusSign.setAttribute('x', comp.x + 8 + (w * 0.11));
            plusSign.setAttribute('y', comp.y + h / 2 + 5);
            plusSign.setAttribute('fill', '#000000');
            plusSign.setAttribute('font-size', '20px');
            plusSign.setAttribute('font-weight', 'bold');
            plusSign.setAttribute('text-anchor', 'middle');
            plusSign.textContent = '+';
            g.appendChild(plusSign);

            if (this.settings.showPads) {
                const padW = w * 0.22;
                const cy = comp.y + h / 2;
                g.appendChild(this.createPinPadElement(comp, 1, comp.x + padW / 2, cy, {
                    w: padW,
                    h: h + 8,
                    shape: 'rect',
                    isPin1: true,
                    hasHole: false,
                    label: '+'
                }));
                g.appendChild(this.createPinPadElement(comp, 2, comp.x + w - padW / 2, cy, {
                    w: padW,
                    h: h + 8,
                    shape: 'rect',
                    isPin1: false,
                    hasHole: false,
                    label: '−'
                }));
            }
            return;
        }

        // =========================================================================
        // МОЩНЫЙ ТРАНЗИСТОР / СТАБИЛИЗАТОР TO-220
        // =========================================================================
        if (fp === 'TO-220') {
            const w = comp.width;
            const h = comp.height;
            const tabH = h * 0.32;

            const tab = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            tab.setAttribute('x', comp.x);
            tab.setAttribute('y', comp.y);
            tab.setAttribute('width', w);
            tab.setAttribute('height', tabH);
            tab.setAttribute('rx', '4');
            tab.setAttribute('fill', isCad ? 'rgba(56,189,248,0.25)' : '#94a3b8');
            tab.setAttribute('stroke', strokeColor);
            tab.setAttribute('stroke-width', '2');
            g.appendChild(tab);

            const tabHole = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            tabHole.setAttribute('cx', comp.x + w / 2);
            tabHole.setAttribute('cy', comp.y + tabH / 2);
            tabHole.setAttribute('r', '18');
            tabHole.setAttribute('fill', '#060911');
            tabHole.setAttribute('stroke', strokeColor);
            tabHole.setAttribute('stroke-width', '1.5');
            g.appendChild(tabHole);

            const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            body.className.baseVal = 'comp-body';
            body.setAttribute('x', comp.x);
            body.setAttribute('y', comp.y + tabH);
            body.setAttribute('width', w);
            body.setAttribute('height', h - tabH);
            body.setAttribute('rx', '4');
            body.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#0f172a'));
            body.setAttribute('fill-opacity', fillOp.toString());
            body.setAttribute('stroke', strokeColor);
            body.setAttribute('stroke-width', strokeWidth);
            g.appendChild(body);

            if (this.settings.showPads) {
                const pinStep = (w - 40) / 2;
                for (let i = 0; i < 3; i++) {
                    const px = comp.x + 20 + i * pinStep;
                    const py = comp.y + h - 15;
                    g.appendChild(this.createPinPadElement(comp, i + 1, px, py, {
                        w: 28,
                        h: 28,
                        shape: 'rect',
                        isPin1: i === 0,
                        label: (i + 1).toString(),
                        labelPos: 'top'
                    }));
                }
            }
            return;
        }

        // =========================================================================
        // SMD ТРАНЗИСТОРЫ SOT-23 И СТАБИЛИЗАТОРЫ SOT-223
        // =========================================================================
        if (fp === 'SOT-23' || fp === 'SOT-223') {
            const w = comp.width;
            const h = comp.height;

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.className.baseVal = 'comp-body';
            rect.setAttribute('x', comp.x + w * 0.15);
            rect.setAttribute('y', comp.y + h * 0.20);
            rect.setAttribute('width', w * 0.70);
            rect.setAttribute('height', h * 0.60);
            rect.setAttribute('rx', '4');
            rect.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#0f172a'));
            rect.setAttribute('fill-opacity', fillOp.toString());
            rect.setAttribute('stroke', strokeColor);
            rect.setAttribute('stroke-width', strokeWidth);
            g.appendChild(rect);

            if (this.settings.showPads) {
                if (fp === 'SOT-23') {
                    g.appendChild(this.createPinPadElement(comp, 1, comp.x + w * 0.25, comp.y + h * 0.85, { w: 28, h: 28, shape: 'rect', isPin1: true, hasHole: false, label: '1' }));
                    g.appendChild(this.createPinPadElement(comp, 2, comp.x + w * 0.75, comp.y + h * 0.85, { w: 28, h: 28, shape: 'rect', isPin1: false, hasHole: false, label: '2' }));
                    g.appendChild(this.createPinPadElement(comp, 3, comp.x + w * 0.50, comp.y + h * 0.15, { w: 28, h: 28, shape: 'rect', isPin1: false, hasHole: false, label: '3' }));
                } else {
                    // SOT-223
                    g.appendChild(this.createPinPadElement(comp, 4, comp.x + w / 2, comp.y + h * 0.10, { w: w * 0.60, h: h * 0.20, shape: 'rect', isPin1: false, hasHole: false, label: 'TAB' }));
                    [w * 0.20, w * 0.50, w * 0.80].forEach((pxOffset, idx) => {
                        g.appendChild(this.createPinPadElement(comp, idx + 1, comp.x + pxOffset, comp.y + h - 18, { w: 32, h: 30, shape: 'rect', isPin1: idx === 0, hasHole: false, label: (idx + 1).toString() }));
                    });
                }
            }
            return;
        }

        // =========================================================================
        // МИКРОСХЕМЫ SMD: SOIC / SOP / TSSOP
        // =========================================================================
        if (fp.startsWith('SOIC') || fp.startsWith('SOP') || fp.startsWith('TSSOP')) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.className.baseVal = 'comp-body';
            rect.setAttribute('x', comp.x + 20);
            rect.setAttribute('y', comp.y + 10);
            rect.setAttribute('width', comp.width - 40);
            rect.setAttribute('height', comp.height - 20);
            rect.setAttribute('rx', '6');
            rect.setAttribute('fill', bodyFill);
            rect.setAttribute('fill-opacity', fillOp.toString());
            rect.setAttribute('stroke', strokeColor);
            rect.setAttribute('stroke-width', strokeWidth);
            g.appendChild(rect);

            const pin1Dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            pin1Dot.setAttribute('cx', comp.x + 36);
            pin1Dot.setAttribute('cy', comp.y + 24);
            pin1Dot.setAttribute('r', '8');
            pin1Dot.setAttribute('fill', isSelected ? '#38bdf8' : (isCad ? '#38bdf8' : '#ef4444'));
            g.appendChild(pin1Dot);

            if (this.settings.showPads) {
                const pinCount = fp.includes('28') ? 28 : fp.includes('20') ? 20 : fp.includes('16') ? 16 : fp.includes('14') ? 14 : 8;
                const half = pinCount / 2;
                const pinStep = (comp.width - 40) / (half + 0.2);

                for (let i = 0; i < half; i++) {
                    const px = comp.x + 20 + (i + 0.6) * pinStep;
                    // Верхний ряд (1..half)
                    g.appendChild(this.createPinPadElement(comp, i + 1, px, comp.y, { w: 24, h: 26, shape: 'rect', isPin1: i === 0, hasHole: false, label: (i + 1).toString() }));
                    // Нижний ряд (pinCount..half+1)
                    const botPin = pinCount - i;
                    g.appendChild(this.createPinPadElement(comp, botPin, px, comp.y + comp.height, { w: 24, h: 26, shape: 'rect', isPin1: false, hasHole: false, label: botPin.toString() }));
                }
            }
            return;
        }

        // =========================================================================
        // МИКРОСХЕМЫ QFP / TQFP
        // =========================================================================
        if (fp.startsWith('TQFP') || fp.startsWith('QFP')) {
            const w = comp.width;
            const h = comp.height;

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.className.baseVal = 'comp-body';
            rect.setAttribute('x', comp.x + w * 0.15);
            rect.setAttribute('y', comp.y + h * 0.15);
            rect.setAttribute('width', w * 0.70);
            rect.setAttribute('height', h * 0.70);
            rect.setAttribute('rx', '8');
            rect.setAttribute('fill', bodyFill);
            rect.setAttribute('fill-opacity', fillOp.toString());
            rect.setAttribute('stroke', strokeColor);
            rect.setAttribute('stroke-width', strokeWidth);
            g.appendChild(rect);

            const pin1Dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            pin1Dot.setAttribute('cx', comp.x + w * 0.25);
            pin1Dot.setAttribute('cy', comp.y + h * 0.25);
            pin1Dot.setAttribute('r', '10');
            pin1Dot.setAttribute('fill', '#ef4444');
            g.appendChild(pin1Dot);
            return;
        }

        // =========================================================================
        // ВИНТОВОЙ КЛЕММНИК
        // =========================================================================
        if (fp.startsWith('CONN-SCREW')) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.className.baseVal = 'comp-body';
            rect.setAttribute('x', comp.x);
            rect.setAttribute('y', comp.y);
            rect.setAttribute('width', comp.width);
            rect.setAttribute('height', comp.height);
            rect.setAttribute('rx', '6');
            rect.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#047857'));
            rect.setAttribute('fill-opacity', fillOp.toString());
            rect.setAttribute('stroke', strokeColor);
            rect.setAttribute('stroke-width', strokeWidth);
            g.appendChild(rect);

            const cy = comp.y + comp.height / 2;
            [comp.x + comp.width * 0.28, comp.x + comp.width * 0.72].forEach((px, idx) => {
                g.appendChild(this.createPinPadElement(comp, idx + 1, px, cy, { r: 22, isPin1: idx === 0, label: (idx + 1).toString() }));
            });
            return;
        }

        // =========================================================================
        // ТАКТОВАЯ КНОПКА (SW-TACT-6X6)
        // =========================================================================
        if (fp.startsWith('SW-TACT')) {
            const cx = comp.x + comp.width / 2;
            const cy = comp.y + comp.height / 2;

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.className.baseVal = 'comp-body';
            rect.setAttribute('x', comp.x + 10);
            rect.setAttribute('y', comp.y + 10);
            rect.setAttribute('width', comp.width - 20);
            rect.setAttribute('height', comp.height - 20);
            rect.setAttribute('rx', '6');
            rect.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#475569'));
            rect.setAttribute('fill-opacity', fillOp.toString());
            rect.setAttribute('stroke', strokeColor);
            rect.setAttribute('stroke-width', strokeWidth);
            g.appendChild(rect);

            const btnCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            btnCircle.setAttribute('cx', cx);
            btnCircle.setAttribute('cy', cy);
            btnCircle.setAttribute('r', (comp.width - 20) * 0.28);
            btnCircle.setAttribute('fill', isCad ? 'rgba(56,189,248,0.4)' : '#0f172a');
            btnCircle.setAttribute('stroke', strokeColor);
            btnCircle.setAttribute('stroke-width', '2');
            g.appendChild(btnCircle);

            if (this.settings.showPads) {
                g.appendChild(this.createPinPadElement(comp, 1, comp.x + 16, comp.y + 16, { r: 14, isPin1: true, label: '1' }));
                g.appendChild(this.createPinPadElement(comp, 2, comp.x + comp.width - 16, comp.y + 16, { r: 14, label: '2' }));
                g.appendChild(this.createPinPadElement(comp, 3, comp.x + comp.width - 16, comp.y + comp.height - 16, { r: 14, label: '3' }));
                g.appendChild(this.createPinPadElement(comp, 4, comp.x + 16, comp.y + comp.height - 16, { r: 14, label: '4' }));
            }
            return;
        }

        // =========================================================================
        // ЭЛЕКТРОМАГНИТНОЕ РЕЛЕ (RELAY-MINI)
        // =========================================================================
        if (fp.startsWith('RELAY')) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.className.baseVal = 'comp-body';
            rect.setAttribute('x', comp.x);
            rect.setAttribute('y', comp.y);
            rect.setAttribute('width', comp.width);
            rect.setAttribute('height', comp.height);
            rect.setAttribute('rx', '8');
            rect.setAttribute('fill', isCad ? bodyFill : (isBottom ? '#0284c7' : '#1e3a8a'));
            rect.setAttribute('fill-opacity', fillOp.toString());
            rect.setAttribute('stroke', strokeColor);
            rect.setAttribute('stroke-width', strokeWidth);
            g.appendChild(rect);

            // Пиктограмма катушки и контактов реле
            const coilText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            coilText.setAttribute('x', comp.x + comp.width / 2);
            coilText.setAttribute('y', comp.y + comp.height / 2);
            coilText.setAttribute('fill', 'rgba(255,255,255,0.7)');
            coilText.setAttribute('font-size', '28px');
            coilText.setAttribute('font-weight', 'bold');
            coilText.setAttribute('text-anchor', 'middle');
            coilText.textContent = '[ ∿ RELAY ∿ ]';
            g.appendChild(coilText);

            if (this.settings.showPads) {
                const w = comp.width;
                const h = comp.height;
                g.appendChild(this.createPinPadElement(comp, 1, comp.x + 30, comp.y + 30, { r: 18, isPin1: true, label: 'COIL+' }));
                g.appendChild(this.createPinPadElement(comp, 2, comp.x + 30, comp.y + h - 30, { r: 18, label: 'COIL−' }));
                g.appendChild(this.createPinPadElement(comp, 3, comp.x + w - 30, comp.y + 30, { r: 18, label: 'NO' }));
                g.appendChild(this.createPinPadElement(comp, 4, comp.x + w - 30, comp.y + h / 2, { r: 18, label: 'COM' }));
                g.appendChild(this.createPinPadElement(comp, 5, comp.x + w - 30, comp.y + h - 30, { r: 18, label: 'NC' }));
            }
            return;
        }

        // =========================================================================
        // 13. МИКРОСХЕМЫ DIP (D2 AT89C51, D1, D6, D7, D4, D5, D8, D12, D3, D11, D13)
        // =========================================================================
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.className.baseVal = 'comp-body';
        rect.setAttribute('x', comp.x);
        rect.setAttribute('y', comp.y);
        rect.setAttribute('width', comp.width);
        rect.setAttribute('height', comp.height);
        rect.setAttribute('rx', '10');
        rect.setAttribute('fill', bodyFill);
        rect.setAttribute('fill-opacity', fillOp.toString());
        rect.setAttribute('stroke', strokeColor);
        rect.setAttribute('stroke-width', strokeWidth);
        g.appendChild(rect);

        const innerFrame = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        innerFrame.setAttribute('x', comp.x + 18);
        innerFrame.setAttribute('y', comp.y + 18);
        innerFrame.setAttribute('width', comp.width - 36);
        innerFrame.setAttribute('height', comp.height - 36);
        innerFrame.setAttribute('rx', '6');
        innerFrame.setAttribute('fill', 'none');
        innerFrame.setAttribute('stroke', isCad ? 'rgba(56,189,248,0.25)' : 'rgba(255,255,255,0.1)');
        innerFrame.setAttribute('stroke-width', '1.5');
        g.appendChild(innerFrame);

        const isVertDip = comp.height > comp.width * 1.2;
        const pinCount = fp.includes('40') ? 40 : fp.includes('28') ? 28 : fp.includes('20') ? 20 : fp.includes('18') ? 18 : fp.includes('16') ? 16 : fp.includes('14') ? 14 : 8;
        const half = pinCount / 2;

        if (isVertDip) {
            // Вертикальный DIP (Ключ/выемка сверху, Pin 1 слева вверху)
            const cx = comp.x + comp.width / 2;
            const notchR = Math.min(36, comp.width * 0.22);
            const notch = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            notch.setAttribute('d', `M ${cx - notchR} ${comp.y} A ${notchR} ${notchR} 0 0 0 ${cx + notchR} ${comp.y}`);
            notch.setAttribute('fill', isCad ? 'rgba(56,189,248,0.2)' : '#060911');
            notch.setAttribute('stroke', strokeColor);
            notch.setAttribute('stroke-width', '2.5');
            g.appendChild(notch);

            // Точка первого вывода (слева вверху)
            const pin1Dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            pin1Dot.setAttribute('cx', comp.x + 28);
            pin1Dot.setAttribute('cy', comp.y + 28);
            pin1Dot.setAttribute('r', '8');
            pin1Dot.setAttribute('fill', isSelected ? '#38bdf8' : (isCad ? '#38bdf8' : '#ef4444'));
            g.appendChild(pin1Dot);

            if (this.settings.showPads) {
                const pinStep = comp.height / (half + 0.5);
                for (let i = 0; i < half; i++) {
                    const py = comp.y + (i + 0.75) * pinStep;
                    const pinLeft = i + 1;             // 1..half (сверху вниз)
                    const pinRight = pinCount - i;      // pinCount..half+1 (сверху вниз)

                    // Левый ряд выводов
                    g.appendChild(this.createPinPadElement(comp, pinLeft, comp.x - 5, py, {
                        w: 38,
                        h: 32,
                        shape: pinLeft === 1 ? 'square' : 'rect',
                        isPin1: pinLeft === 1,
                        label: pinLeft.toString(),
                        labelPos: 'left'
                    }));

                    // Правый ряд выводов
                    g.appendChild(this.createPinPadElement(comp, pinRight, comp.x + comp.width + 5, py, {
                        w: 38,
                        h: 32,
                        shape: 'rect',
                        isPin1: false,
                        label: pinRight.toString(),
                        labelPos: 'right'
                    }));
                }
            }
        } else {
            // Горизонтальный DIP (Ключ/выемка слева, Pin 1 слева внизу по стандарту JEDEC/ГОСТ)
            const cy = comp.y + comp.height / 2;
            const notchR = Math.min(42, comp.height * 0.18);
            const notch = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            notch.setAttribute('d', `M ${comp.x} ${cy - notchR} A ${notchR} ${notchR} 0 0 1 ${comp.x} ${cy + notchR}`);
            notch.setAttribute('fill', isCad ? 'rgba(56,189,248,0.2)' : '#060911');
            notch.setAttribute('stroke', strokeColor);
            notch.setAttribute('stroke-width', '2.5');
            g.appendChild(notch);

            // Точка первого вывода (слева внизу возле ключа)
            const pin1Dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            pin1Dot.setAttribute('cx', comp.x + Math.min(40, comp.width * 0.15));
            pin1Dot.setAttribute('cy', comp.y + comp.height - Math.min(40, comp.height * 0.25));
            pin1Dot.setAttribute('r', '10');
            pin1Dot.setAttribute('fill', isSelected ? '#38bdf8' : (isCad ? '#38bdf8' : '#ef4444'));
            g.appendChild(pin1Dot);

            if (this.settings.showPads) {
                const pinStep = comp.width / (half + 0.5);
                for (let i = 0; i < half; i++) {
                    const px = comp.x + (i + 0.75) * pinStep;
                    const pinBot = i + 1;               // 1..half (слева направо по нижнему ряду)
                    const pinTop = pinCount - i;        // pinCount..half+1 (слева направо по верхнему ряду)

                    // Нижний ряд (1..half, Pin 1 слева внизу)
                    g.appendChild(this.createPinPadElement(comp, pinBot, px, comp.y + comp.height + 5, {
                        w: 32,
                        h: 38,
                        shape: pinBot === 1 ? 'square' : 'rect',
                        isPin1: pinBot === 1,
                        label: pinBot.toString(),
                        labelPos: 'bottom'
                    }));

                    // Верхний ряд (pinCount..half+1, Pin N слева вверху)
                    g.appendChild(this.createPinPadElement(comp, pinTop, px, comp.y - 5, {
                        w: 32,
                        h: 38,
                        shape: 'rect',
                        isPin1: false,
                        label: pinTop.toString(),
                        labelPos: 'top'
                    }));
                }
            }
        }
    }

    createTransformBox(comp) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const cx = comp.x + comp.width / 2;
        const cy = comp.y + comp.height / 2;
        g.setAttribute('transform', `rotate(${comp.rotation || 0}, ${cx}, ${cy})`);

        if (comp.locked) {
            g.className.baseVal = 'transform-box is-locked';
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.className.baseVal = 'transform-box-rect';
            rect.setAttribute('x', comp.x - 8);
            rect.setAttribute('y', comp.y - 8);
            rect.setAttribute('width', comp.width + 16);
            rect.setAttribute('height', comp.height + 16);
            rect.setAttribute('rx', '4');
            g.appendChild(rect);

            const lockBadge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            lockBadge.setAttribute('x', cx);
            lockBadge.setAttribute('y', comp.y - 14);
            lockBadge.setAttribute('text-anchor', 'middle');
            lockBadge.setAttribute('font-size', '24');
            lockBadge.textContent = '🔒';
            g.appendChild(lockBadge);
            return g;
        }

        g.className.baseVal = 'transform-box';

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.className.baseVal = 'transform-box-rect';
        rect.setAttribute('x', comp.x - 8);
        rect.setAttribute('y', comp.y - 8);
        rect.setAttribute('width', comp.width + 16);
        rect.setAttribute('height', comp.height + 16);
        rect.setAttribute('rx', '4');
        g.appendChild(rect);

        const zoom = this.camera.zoom || 0.15;
        const handleSize = Math.min(80, Math.max(28, Math.round(12 / zoom)));
        const halfHandle = handleSize / 2;

        const handles = [
            { id: 'nw', x: comp.x - 8, y: comp.y - 8, cursor: 'nwse-resize' },
            { id: 'n',  x: cx, y: comp.y - 8, cursor: 'ns-resize' },
            { id: 'ne', x: comp.x + comp.width + 8, y: comp.y - 8, cursor: 'nesw-resize' },
            { id: 'e',  x: comp.x + comp.width + 8, y: cy, cursor: 'ew-resize' },
            { id: 'se', x: comp.x + comp.width + 8, y: comp.y + comp.height + 8, cursor: 'nwse-resize' },
            { id: 's',  x: cx, y: comp.y + comp.height + 8, cursor: 'ns-resize' },
            { id: 'sw', x: comp.x - 8, y: comp.y + comp.height + 8, cursor: 'nesw-resize' },
            { id: 'w',  x: comp.x - 8, y: cy, cursor: 'ew-resize' }
        ];

        handles.forEach(h => {
            const hRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            hRect.className.baseVal = 'transform-handle';
            hRect.dataset.handle = h.id;
            hRect.setAttribute('x', h.x - halfHandle);
            hRect.setAttribute('y', h.y - halfHandle);
            hRect.setAttribute('width', handleSize);
            hRect.setAttribute('height', handleSize);
            hRect.setAttribute('rx', '4');
            hRect.style.cursor = h.cursor;
            g.appendChild(hRect);
        });

        const rotDist = Math.max(70, Math.round(25 / zoom));
        const rotRadius = Math.min(50, Math.max(18, Math.round(8 / zoom)));
        const rotY = comp.y - 8 - rotDist;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.className.baseVal = 'rotate-line';
        line.setAttribute('x1', cx);
        line.setAttribute('y1', comp.y - 8);
        line.setAttribute('x2', cx);
        line.setAttribute('y2', rotY);
        g.appendChild(line);

        const rotCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        rotCircle.className.baseVal = 'rotate-handle';
        rotCircle.setAttribute('cx', cx);
        rotCircle.setAttribute('cy', rotY);
        rotCircle.setAttribute('r', rotRadius);
        g.appendChild(rotCircle);

        return g;
    }

    initInspectorFootprintTreeDropdown() {
        if (!this.btnInspFootprintTrigger || !this.inspFootprintDropdown) return;

        this.btnInspFootprintTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = this.inspFootprintDropdown.classList.contains('active');
            this.inspFootprintDropdown.classList.toggle('active', !isActive);

            if (!isActive) {
                if (this.inspTreeSearch) {
                    this.inspTreeSearch.value = '';
                    this.filterInspectorTree('');
                }
                const comp = this.getSelectedComponent();
                if (comp) {
                    this.highlightAndScrollCurrentFootprint(comp);
                }
            }
        });

        if (this.inspTreeSearch) {
            this.inspTreeSearch.addEventListener('click', (e) => e.stopPropagation());
            this.inspTreeSearch.addEventListener('input', (e) => {
                this.filterInspectorTree((e.target.value || '').trim().toLowerCase());
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.inspFootprintDropdown && !this.inspFootprintDropdown.contains(e.target)) {
                this.inspFootprintDropdown.classList.remove('active');
            }
        });

        this.renderInspectorTree();
    }

    highlightAndScrollCurrentFootprint(comp) {
        if (!this.inspFootprintTree || !comp) return;

        // Снимаем предыдущую подсветку
        this.inspFootprintTree.querySelectorAll('.tree-header.current-selected').forEach(el => {
            el.classList.remove('current-selected');
        });

        const targetFp = comp.footprint;
        const targetVal = (comp.value || '').trim().toLowerCase();
        const targetPreset = (comp.preset || '').trim().toLowerCase();

        let targetLeaf = null;

        // 1. Поиск по прямому совпадению comp.preset
        if (targetPreset) {
            targetLeaf = this.inspFootprintTree.querySelector(`.leaf-item[data-preset="${comp.preset}"]`);
        }

        // 2. Поиск по совпадению значения или имени пресета
        if (!targetLeaf && targetVal) {
            const presetLeaves = Array.from(this.inspFootprintTree.querySelectorAll(`.leaf-item[data-fp="${targetFp}"][data-preset]`));
            targetLeaf = presetLeaves.find(leaf => {
                const pKey = (leaf.dataset.preset || '').toLowerCase();
                const pVal = (leaf.dataset.presetValue || '').toLowerCase();
                const pName = (leaf.dataset.presetName || '').toLowerCase();
                return pKey === targetVal || 
                       pVal === targetVal || 
                       pName === targetVal || 
                       (pVal && targetVal.includes(pVal)) || 
                       (targetVal && pName.includes(targetVal)) || 
                       (pVal && pVal.includes(targetVal));
            });
        }

        // 3. Если пресет не найден или не задан — подсвечиваем базовый корпус
        if (!targetLeaf) {
            targetLeaf = this.inspFootprintTree.querySelector(`.leaf-item[data-fp="${targetFp}"][data-is-base="true"]`) ||
                         this.inspFootprintTree.querySelector(`.leaf-item[data-fp="${targetFp}"]`);
        }

        if (targetLeaf) {
            targetLeaf.classList.add('current-selected');

            // Раскрываем всех родителей (категорию, подкатегорию, папку корпуса)
            let parentNode = targetLeaf.closest('.tree-node');
            while (parentNode && parentNode !== this.inspFootprintTree) {
                parentNode.classList.add('expanded');
                const parentChildren = parentNode.parentElement;
                if (parentChildren && parentChildren.classList.contains('tree-children')) {
                    parentNode = parentChildren.closest('.tree-node');
                } else {
                    break;
                }
            }

            // Плавная прокрутка к элементу
            setTimeout(() => {
                targetLeaf.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 60);
        }
    }

    renderInspectorTree() {
        if (!this.inspFootprintTree) return;
        this.inspFootprintTree.innerHTML = '';

        this.catalogTree.forEach(category => {
            const catNode = document.createElement('div');
            catNode.className = 'tree-node';

            const catHeader = document.createElement('div');
            catHeader.className = 'tree-header folder-header category-root';
            catHeader.innerHTML = `
                <span class="tree-toggle">▶</span>
                <span class="tree-icon">${category.icon || '📁'}</span>
                <span class="tree-label">${category.name}</span>
            `;

            const catChildren = document.createElement('div');
            catChildren.className = 'tree-children';

            catHeader.addEventListener('click', (e) => {
                e.stopPropagation();
                catNode.classList.toggle('expanded');
            });

            category.subcategories.forEach(subcat => {
                const fpItems = [];
                subcat.footprints.forEach(fpKey => {
                    const tpl = this.footprintTemplates[fpKey];
                    if (!tpl) return;
                    const presetsForFp = Object.entries(this.componentPresets).filter(([k, pr]) => pr.footprint === fpKey);
                    fpItems.push({ fpKey, tpl, presets: presetsForFp });
                });

                // Если в подкатегории 1 корпус без моделей — отображаем напрямую
                if (fpItems.length === 1 && fpItems[0].presets.length === 0) {
                    const item = fpItems[0];
                    const leafNode = document.createElement('div');
                    leafNode.className = 'tree-node';
                    leafNode.dataset.search = `${category.name} ${subcat.name} ${item.fpKey} ${item.tpl.name}`.toLowerCase();

                    const leafHeader = document.createElement('div');
                    leafHeader.className = 'tree-header leaf-item';
                    leafHeader.dataset.fp = item.fpKey;
                    leafHeader.dataset.isBase = "true";
                    leafHeader.innerHTML = `
                        <span class="tree-toggle empty-toggle"></span>
                        <span class="tree-icon">📄</span>
                        <span class="tree-label">${item.tpl.name || item.fpKey}</span>
                    `;
                    leafHeader.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.changeSelectedComponentFootprint(item.fpKey);
                    });

                    leafNode.appendChild(leafHeader);
                    catChildren.appendChild(leafNode);
                    return;
                }

                const subNode = document.createElement('div');
                subNode.className = 'tree-node';

                const subHeader = document.createElement('div');
                subHeader.className = 'tree-header folder-header';
                subHeader.innerHTML = `
                    <span class="tree-toggle">▶</span>
                    <span class="tree-icon">📂</span>
                    <span class="tree-label">${subcat.name}</span>
                `;

                const subChildren = document.createElement('div');
                subChildren.className = 'tree-children';

                subHeader.addEventListener('click', (e) => {
                    e.stopPropagation();
                    subNode.classList.toggle('expanded');
                });

                fpItems.forEach(item => {
                    const { fpKey, tpl, presets } = item;

                    if (presets.length === 0) {
                        const fpNode = document.createElement('div');
                        fpNode.className = 'tree-node';
                        fpNode.dataset.search = `${category.name} ${subcat.name} ${fpKey} ${tpl.name}`.toLowerCase();

                        const fpHeader = document.createElement('div');
                        fpHeader.className = 'tree-header leaf-item';
                        fpHeader.dataset.fp = fpKey;
                        fpHeader.dataset.isBase = "true";
                        fpHeader.innerHTML = `
                            <span class="tree-toggle empty-toggle"></span>
                            <span class="tree-icon">📄</span>
                            <span class="tree-label">${tpl.name || fpKey}</span>
                        `;
                        fpHeader.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.changeSelectedComponentFootprint(fpKey);
                        });

                        fpNode.appendChild(fpHeader);
                        subChildren.appendChild(fpNode);
                    } else {
                        const fpNode = document.createElement('div');
                        fpNode.className = 'tree-node';
                        fpNode.dataset.search = `${category.name} ${subcat.name} ${fpKey} ${tpl.name} ${presets.map(p => p[1].name + ' ' + p[1].value).join(' ')}`.toLowerCase();

                        const fpHeader = document.createElement('div');
                        fpHeader.className = 'tree-header folder-header';
                        fpHeader.innerHTML = `
                            <span class="tree-toggle">▶</span>
                            <span class="tree-icon">📁</span>
                            <span class="tree-label">${fpKey} (${tpl.name})</span>
                        `;

                        const fpChildren = document.createElement('div');
                        fpChildren.className = 'tree-children';

                        fpHeader.addEventListener('click', (e) => {
                            e.stopPropagation();
                            fpNode.classList.toggle('expanded');
                        });

                        // 1. Базовый корпус
                        const baseLeaf = document.createElement('div');
                        baseLeaf.className = 'tree-node';
                        baseLeaf.dataset.search = `${fpKey} базовый чистый`.toLowerCase();

                        const baseHeader = document.createElement('div');
                        baseHeader.className = 'tree-header leaf-item';
                        baseHeader.dataset.fp = fpKey;
                        baseHeader.dataset.isBase = "true";
                        baseHeader.innerHTML = `
                            <span class="tree-toggle empty-toggle"></span>
                            <span class="tree-icon">📄</span>
                            <span class="tree-label">Базовый корпус (${fpKey})</span>
                        `;
                        baseHeader.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.changeSelectedComponentFootprint(fpKey);
                        });
                        baseLeaf.appendChild(baseHeader);
                        fpChildren.appendChild(baseLeaf);

                        // 2. Модели с предустановленной распиновкой
                        presets.forEach(([presetKey, pr]) => {
                            const presetLeaf = document.createElement('div');
                            presetLeaf.className = 'tree-node';
                            presetLeaf.dataset.search = `${fpKey} ${pr.name} ${pr.value} ${pr.notes || ''}`.toLowerCase();

                            const presetHeader = document.createElement('div');
                            presetHeader.className = 'tree-header leaf-item';
                            presetHeader.dataset.fp = fpKey;
                            presetHeader.dataset.preset = presetKey;
                            presetHeader.dataset.presetName = pr.name;
                            presetHeader.dataset.presetValue = pr.value || '';
                            presetHeader.innerHTML = `
                                <span class="tree-toggle empty-toggle"></span>
                                <span class="tree-icon">📄</span>
                                <span class="tree-label" title="${pr.notes || pr.name}">${pr.name}</span>
                            `;
                            presetHeader.addEventListener('click', (e) => {
                                e.stopPropagation();
                                this.changeSelectedComponentFootprint(fpKey, presetKey);
                            });

                            presetLeaf.appendChild(presetHeader);
                            fpChildren.appendChild(presetLeaf);
                        });

                        fpNode.appendChild(fpHeader);
                        fpNode.appendChild(fpChildren);
                        subChildren.appendChild(fpNode);
                    }
                });

                subNode.appendChild(subHeader);
                subNode.appendChild(subChildren);
                catChildren.appendChild(subNode);
            });

            catNode.appendChild(catHeader);
            catNode.appendChild(catChildren);
            this.inspFootprintTree.appendChild(catNode);
        });
    }

    filterInspectorTree(query) {
        if (!this.inspFootprintTree) return;

        if (!query) {
            this.inspFootprintTree.querySelectorAll('.tree-node').forEach(node => {
                node.style.display = '';
            });
            return;
        }

        this.inspFootprintTree.querySelectorAll('.category-root').forEach(rootHeader => {
            const catNode = rootHeader.closest('.tree-node');
            let catMatches = false;

            catNode.querySelectorAll('.tree-children > .tree-node').forEach(subNode => {
                let subMatches = false;

                subNode.querySelectorAll('.tree-children > .tree-node').forEach(itemNode => {
                    const searchText = (itemNode.dataset.search || itemNode.textContent).toLowerCase();
                    const isMatch = searchText.includes(query);

                    if (isMatch) {
                        itemNode.style.display = '';
                        itemNode.classList.add('expanded');
                        subMatches = true;
                    } else {
                        itemNode.style.display = 'none';
                    }
                });

                if (subMatches) {
                    subNode.style.display = '';
                    subNode.classList.add('expanded');
                    catMatches = true;
                } else {
                    subNode.style.display = 'none';
                }
            });

            if (catMatches) {
                catNode.style.display = '';
                catNode.classList.add('expanded');
            } else {
                catNode.style.display = 'none';
            }
        });
    }

    changeSelectedComponentFootprint(fpKey, presetKey = null) {
        const comp = this.getSelectedComponent();
        if (!comp) return;

        if (presetKey && this.componentPresets[presetKey]) {
            const pr = this.componentPresets[presetKey];
            comp.preset = presetKey;
            comp.footprint = pr.footprint || fpKey;
            comp.value = pr.value || pr.name;
            comp.notes = pr.notes || comp.notes;
            comp.customPins = JSON.parse(JSON.stringify(pr.pins || {}));
        } else {
            comp.preset = null;
            comp.footprint = fpKey;
        }

        const tpl = this.footprintTemplates[comp.footprint];
        if (tpl) {
            comp.width = tpl.width;
            comp.height = tpl.height;
            if (this.inspW) this.inspW.value = comp.width;
            if (this.inspH) this.inspH.value = comp.height;
        }

        if (this.inspFootprintDropdown) {
            this.inspFootprintDropdown.classList.remove('active');
        }

        this.render();
        this.updateInspector();
        this.saveHistory();
        this.updateComponentList();
    }

    getComponentPins(comp) {
        const fp = comp.footprint || 'DIP-8';
        const tpl = this.footprintTemplates[fp] || {};
        const pins = [];
        const customPins = comp.customPins || {};

        const parsePinData = (pNum, defaultName, shape = 'circle', extra = {}) => {
            let customVal = customPins[pNum];
            let name = defaultName;
            let net = '';
            let role = 'signal';

            if (customVal && typeof customVal === 'object') {
                if (customVal.name) name = customVal.name;
                if (customVal.net) net = customVal.net;
                if (customVal.role) role = customVal.role;
            } else if (typeof customVal === 'string' && customVal.trim()) {
                name = customVal;
            }

            const nameUp = name.toUpperCase();
            if (!net) {
                if (nameUp.includes('GND') || nameUp.includes('ОБЩ') || nameUp.includes('GROUND') || nameUp.includes('ЗЕМЛЯ')) {
                    net = 'GND';
                    role = 'ground';
                } else if (nameUp.includes('+5V') || nameUp.includes('VCC') || nameUp.includes('VDD')) {
                    net = '+5V';
                    role = 'power';
                } else if (nameUp.includes('+12V') || nameUp.includes('+24V') || nameUp.includes('VBAT')) {
                    net = nameUp.includes('+12V') ? '+12V' : (nameUp.includes('+24V') ? '+24V' : 'VBAT');
                    role = 'power';
                }
            }

            return {
                num: pNum,
                name: name,
                defaultName: defaultName,
                net: net,
                role: role,
                shape: shape,
                ...extra
            };
        };

        if (tpl.pins && tpl.pins.length > 0) {
            tpl.pins.forEach(p => {
                pins.push(parsePinData(p.num, p.name || `Вывод ${p.num}`, p.shape || (p.num === 1 ? 'square' : 'circle'), { xRatio: p.xRatio, yRatio: p.yRatio }));
            });
        } else if (tpl.shape === 'dip' || fp.startsWith('DIP') || fp.startsWith('SOIC') || fp.startsWith('SOP') || fp.startsWith('TSSOP')) {
            const pinCount = tpl.pinCount || (fp.includes('40') ? 40 : fp.includes('28') ? 28 : fp.includes('20') ? 20 : fp.includes('18') ? 18 : fp.includes('16') ? 16 : fp.includes('14') ? 14 : 8);
            const half = pinCount / 2;
            const isVertDip = comp.height > comp.width * 1.2;
            if (isVertDip) {
                for (let i = 1; i <= half; i++) {
                    pins.push(parsePinData(i, `Вывод ${i}`, i === 1 ? 'square' : 'circle', { col: 'left', index: i - 1 }));
                }
                for (let i = half + 1; i <= pinCount; i++) {
                    pins.push(parsePinData(i, `Вывод ${i}`, 'circle', { col: 'right', index: pinCount - i }));
                }
            } else {
                for (let i = 1; i <= half; i++) {
                    pins.push(parsePinData(i, `Вывод ${i}`, i === 1 ? 'square' : 'circle', { row: 'bottom', index: i - 1 }));
                }
                for (let i = half + 1; i <= pinCount; i++) {
                    pins.push(parsePinData(i, `Вывод ${i}`, 'circle', { row: 'top', index: pinCount - i }));
                }
            }
        } else if (tpl.shape === 'disp-7seg' || fp.startsWith('DISP-7SEG')) {
            for (let i = 1; i <= 18; i++) {
                pins.push(parsePinData(i, i === 1 ? 'Анод 1 (COM)' : i === 10 ? 'Анод 2 (COM)' : `Сегмент ${i}`, (i === 1 || i === 10) ? 'square' : 'circle'));
            }
        } else {
            const pinCount = tpl.pinCount || 2;
            for (let i = 1; i <= pinCount; i++) {
                pins.push(parsePinData(i, `Вывод ${i}`, i === 1 ? 'square' : 'circle'));
            }
        }
        return pins;
    }

    updateInspector() {
        const comp = this.getSelectedComponent();
        const viewPinout = document.getElementById('viewPinoutContainer');
        const editPinout = document.getElementById('editPinoutContainer');

        if (!comp) {
            // Nothing selected: Show board / layer settings
            if (this.inspectorHeaderTitle) {
                this.inspectorHeaderTitle.textContent = 'Стиль и отображение слоев';
            }
            if (this.btnDeselectRight) {
                this.btnDeselectRight.style.display = 'none';
            }
            if (this.inspectorPanel) {
                this.inspectorPanel.style.display = 'none';
            }
            if (this.layersSettingsSection) {
                this.layersSettingsSection.style.display = 'block';
            }
            return;
        }

        // Component selected: Show inspector and hide layer settings
        if (this.layersSettingsSection) {
            this.layersSettingsSection.style.display = 'none';
        }
        if (this.inspectorPanel) {
            this.inspectorPanel.style.display = 'block';
        }
        if (this.btnDeselectRight) {
            this.btnDeselectRight.style.display = 'inline-flex';
        }
        if (this.inspectorHeaderTitle) {
            this.inspectorHeaderTitle.textContent = `${comp.designator}${comp.value ? ' (' + comp.value + ')' : ''}`;
        }

        const tpl = this.footprintTemplates[comp.footprint] || {};
        const pins = this.getComponentPins(comp);

        if (this.currentMode === 'view') {
            if (this.viewInfoCard) this.viewInfoCard.style.display = 'flex';
            if (this.inspectorEditForm) this.inspectorEditForm.style.display = 'none';

            if (this.viewCardDesignator) this.viewCardDesignator.textContent = (comp.designator || '-') + (comp.locked ? ' 🔒' : '');
            if (this.viewCardValue) this.viewCardValue.textContent = comp.value || '-';
            if (this.viewCardFootprint) this.viewCardFootprint.textContent = `${comp.footprint} (${tpl.name || 'Базовый'})`;
            if (this.viewCardLayer) this.viewCardLayer.textContent = comp.layer === 'bottom' ? 'Обратная сторона (Bottom)' : 'Лицевая сторона (Top)';
            if (this.viewCardCoords) this.viewCardCoords.textContent = `X: ${comp.x}, Y: ${comp.y} | W: ${comp.width}, H: ${comp.height} (${comp.rotation || 0}°)${comp.locked ? ' [🔒 Закреплен]' : ''}`;
            if (this.viewCardNotes) this.viewCardNotes.textContent = comp.notes || 'Нет дополнительных заметок';

            if (viewPinout) {
                if (pins.length > 0) {
                    let html = `
                        <div class="pinout-accordion" id="viewPinoutAccordion">
                            <div class="pinout-accordion-header" id="btnToggleViewPinout" title="Нажмите, чтобы развернуть/свернуть список выводов">
                                <div class="pinout-header-title">
                                    <span>Распиновка</span>
                                    <span class="pinout-count-badge">${pins.length} выв.</span>
                                </div>
                                <span class="pinout-accordion-arrow">▾</span>
                            </div>
                            <div class="pinout-scroll-wrapper">
                                <table class="pinout-table">
                                    <thead><tr><th style="width: 36px;">№</th><th>Сигнал / Назначение</th><th>Цепь (Net)</th></tr></thead>
                                    <tbody>
                    `;
                    pins.forEach(p => {
                        let roleClass = 'role-signal';
                        let roleText = 'Сигнал';
                        if (p.role === 'power') { roleClass = 'role-power'; roleText = 'Питание'; }
                        else if (p.role === 'ground') { roleClass = 'role-ground'; roleText = 'GND'; }
                        else if (p.role === 'passive') { roleClass = 'role-passive'; roleText = 'Пассив'; }
                        else if (p.role === 'anode') { roleClass = 'role-power'; roleText = 'Анод (+)'; }
                        else if (p.role === 'cathode') { roleClass = 'role-ground'; roleText = 'Катод (-)'; }

                        let netHtml = p.net ? `<span class="net-badge clickable-net" data-net="${p.net}" title="Нажмите, чтобы подсветить цепь">${p.net}</span>` : '<span style="color: var(--text-muted);">-</span>';

                        html += `
                            <tr data-pin="${p.num}">
                                <td><span class="pin-badge pin-${p.shape}">${p.num}</span></td>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <span style="font-weight: 500; color: var(--text-primary);">${p.name}</span>
                                        <span class="role-badge ${roleClass}">${roleText}</span>
                                    </div>
                                </td>
                                <td>${netHtml}</td>
                            </tr>
                        `;
                    });
                    html += `       </tbody>
                                </table>
                            </div>
                        </div>`;
                    viewPinout.innerHTML = html;
                    viewPinout.style.display = 'block';

                    const acc = document.getElementById('viewPinoutAccordion');
                    const btn = document.getElementById('btnToggleViewPinout');
                    if (btn && acc) {
                        btn.addEventListener('click', () => {
                            acc.classList.toggle('collapsed');
                        });
                    }

                    // Net badge click handling
                    viewPinout.querySelectorAll('.clickable-net').forEach(badge => {
                        badge.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const net = badge.dataset.net;
                            if (this.activeHighlightedNet === net) {
                                this.activeHighlightedNet = null;
                            } else {
                                this.activeHighlightedNet = net;
                            }
                            this.render();
                            this.updateInspector();
                        });
                    });
                } else {
                    viewPinout.style.display = 'none';
                }
            }
        } else {
            if (this.viewInfoCard) this.viewInfoCard.style.display = 'none';
            if (this.inspectorEditForm) this.inspectorEditForm.style.display = 'block';

            const isLocked = !!comp.locked;

            // Update Lock status banner
            if (this.inspLockBanner) {
                this.inspLockBanner.classList.toggle('is-locked', isLocked);
            }
            if (this.inspLockStatusText) {
                this.inspLockStatusText.innerHTML = isLocked ? '🔒 Закреплен (защищен от изменений)' : '🔓 Не закреплен';
            }
            if (this.btnToggleLockInsp) {
                this.btnToggleLockInsp.textContent = isLocked ? '🔓 Разблокировать' : '📌 Закрепить';
                this.btnToggleLockInsp.className = isLocked ? 'btn btn-sm btn-primary' : 'btn btn-sm';
            }
            if (this.quickToggleLock) {
                this.quickToggleLock.textContent = isLocked ? '🔓 Разблокировать' : '📌 Закрепить';
                this.quickToggleLock.classList.toggle('btn-primary', isLocked);
            }

            // Disable or enable edit controls based on lock status
            const inputsToDisable = [
                this.inspDesignator, this.inspValue, this.inspShowDesignator, this.inspShowValue,
                this.inspLayer, this.inspX, this.inspY,
                this.inspW, this.inspH, this.inspRot, this.inspNotes, this.inspScaleSlider,
                this.btnScaleDown, this.btnScaleUp, this.btnScaleReset, this.btnAspectLock,
                this.btnResetCompInsp, this.btnDeleteCompInsp, this.btnInspFootprintTrigger,
                this.quickScaleDown, this.quickScaleUp, this.btnScopeSingle, this.btnScopeGroup,
                this.inspLockGroupResize, this.inspFontSize, this.btnFontSizeDown,
                this.btnFontSizeUp, this.btnFontSizeAuto
            ];
            inputsToDisable.forEach(el => {
                if (el) el.disabled = isLocked;
            });

            ['quickRotateLeft', 'quickRotateRight', 'quickRotate90', 'quickFlipLayer', 'quickResetComp', 'quickDelete'].forEach(id => {
                const b = document.getElementById(id);
                if (b) b.disabled = isLocked;
            });

            if (this.inspDesignator) this.inspDesignator.value = comp.designator || '';
            if (this.inspValue) this.inspValue.value = comp.value || '';
            if (this.inspShowDesignator) this.inspShowDesignator.checked = comp.showDesignator !== false;
            if (this.inspShowValue) this.inspShowValue.checked = comp.showValue === true;
            if (this.inspPreviewDesig) this.inspPreviewDesig.textContent = comp.designator || '-';
            if (this.inspPreviewVal) this.inspPreviewVal.textContent = comp.value || 'номинал';

            if (this.inspFootprintLabel) this.inspFootprintLabel.textContent = comp.footprint || 'DIP-8';
            if (this.inspLayer) this.inspLayer.value = comp.layer || 'top';
            if (this.inspX) this.inspX.value = comp.x || 0;
            if (this.inspY) this.inspY.value = comp.y || 0;
            if (this.inspW) this.inspW.value = comp.width || 100;
            if (this.inspH) this.inspH.value = comp.height || 100;
            if (this.inspRot) this.inspRot.value = comp.rotation || 0;
            if (this.inspNotes) this.inspNotes.value = comp.notes || '';

            // Font Size inspector values
            const autoFs = this.getComponentAutoFontSize(comp);
            if (this.inspFontSize) {
                this.inspFontSize.value = (comp.fontSize !== undefined && comp.fontSize !== null) ? comp.fontSize : '';
                this.inspFontSize.placeholder = `Авто (${autoFs}px)`;
            }
            if (this.inspFontSizeBadge) {
                if (comp.fontSize) {
                    this.inspFontSizeBadge.textContent = `${comp.fontSize} px`;
                    this.inspFontSizeBadge.style.color = 'var(--accent-blue)';
                } else {
                    this.inspFontSizeBadge.textContent = `Авто (${autoFs} px)`;
                    this.inspFontSizeBadge.style.color = 'var(--text-secondary)';
                }
            }

            // Calculate and display scale percentage
            const baseW = (tpl && tpl.width) ? tpl.width : (comp.width || 100);
            const scalePercent = baseW > 0 ? Math.round(((comp.width || 100) / baseW) * 100) : 100;
            if (this.inspScaleValue) this.inspScaleValue.textContent = `${scalePercent}%`;
            if (this.inspScaleSlider) this.inspScaleSlider.value = scalePercent;

            // Aspect ratio lock state
            if (this.btnAspectLock) this.btnAspectLock.classList.toggle('active', !!this.aspectRatioLocked);
            if (this.aspectLockIcon) this.aspectLockIcon.textContent = this.aspectRatioLocked ? '🔒' : '🔓';

            // Update Resize Scope Controls & Group Counts
            const allGroup = this.getAllGroupComponents(comp);
            const activeGroup = this.getGroupComponents(comp);
            const protectedCount = allGroup.length - activeGroup.length;

            if (this.scopeFootprintName) {
                this.scopeFootprintName.textContent = comp.footprint || 'DIP-8';
            }
            if (this.groupCompCountBadge) {
                let badgeTitle = `${allGroup.length} шт. с корпусом ${comp.footprint}`;
                if (protectedCount > 0) {
                    badgeTitle += ` (${protectedCount} защищено/закреплено)`;
                }
                this.groupCompCountBadge.textContent = `${activeGroup.length}/${allGroup.length} шт`;
                this.groupCompCountBadge.title = badgeTitle;
            }
            if (this.btnScopeSingle) this.btnScopeSingle.classList.toggle('active', this.resizeScope === 'single');
            if (this.btnScopeGroup) this.btnScopeGroup.classList.toggle('active', this.resizeScope === 'group');

            if (this.inspLockGroupResize) {
                this.inspLockGroupResize.checked = !!comp.lockGroupResize;
                this.inspLockGroupResize.disabled = isLocked;
            }

            if (editPinout) {
                if (pins.length > 0) {
                    const tplList = this.pinoutTemplates[comp.footprint] || [];
                    let templatePickerHtml = '';
                    if (tplList.length > 0) {
                        templatePickerHtml = `
                            <div class="pinout-template-bar" style="margin-bottom: 12px; padding: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px;">
                                <label style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; display: block;">Быстрый шаблон цоколевки:</label>
                                <div style="display: flex; gap: 6px;">
                                    <select class="form-input pinout-template-select" id="pinoutTemplateSelect" style="flex: 1; font-size: 12px; padding: 4px 8px;" ${isLocked ? 'disabled' : ''}>
                                        <option value="">-- Выбрать цоколевку (${comp.footprint}) --</option>
                                        ${tplList.map(t => `<option value="${t.id}">${t.name} (${t.desc || ''})</option>`).join('')}
                                    </select>
                                    <button type="button" class="btn btn-sm btn-outline" id="btnFlipPolarityInsp" title="Развернуть полярность на 180°" ${isLocked ? 'disabled' : ''}>⇄ 180°</button>
                                </div>
                            </div>
                        `;
                    }

                    let html = `
                        <div class="pinout-accordion" id="editPinoutAccordion">
                            <div class="pinout-accordion-header" id="btnToggleEditPinout" title="Нажмите, чтобы развернуть/свернуть список выводов">
                                <div class="pinout-header-title">
                                    <span>Распиновка выводов</span>
                                    <span class="pinout-count-badge">${pins.length} выв.</span>
                                </div>
                                <span class="pinout-accordion-arrow">▾</span>
                            </div>
                            <div class="pinout-scroll-wrapper">
                                ${templatePickerHtml}
                                <table class="pinout-table edit-pinout-table">
                                    <thead><tr><th style="width: 32px;">№</th><th>Сигнал / Имя</th><th style="width: 80px;">Цепь (Net)</th><th style="width: 80px;">Роль</th></tr></thead>
                                    <tbody>
                    `;
                    pins.forEach(p => {
                        html += `
                            <tr data-pin="${p.num}">
                                <td><span class="pin-badge pin-${p.shape}">${p.num}</span></td>
                                <td>
                                    <input type="text" class="pinout-input pinout-input-name" data-pin="${p.num}" value="${p.name}" placeholder="${p.defaultName}" ${isLocked ? 'disabled' : ''}>
                                </td>
                                <td>
                                    <input type="text" class="pinout-input pinout-input-net" data-pin="${p.num}" value="${p.net || ''}" placeholder="GND / +5V..." ${isLocked ? 'disabled' : ''}>
                                </td>
                                <td>
                                    <select class="pinout-input pinout-select-role" data-pin="${p.num}" ${isLocked ? 'disabled' : ''}>
                                        <option value="signal" ${p.role === 'signal' ? 'selected' : ''}>Сигнал</option>
                                        <option value="power" ${p.role === 'power' ? 'selected' : ''}>Питание</option>
                                        <option value="ground" ${p.role === 'ground' ? 'selected' : ''}>GND</option>
                                        <option value="passive" ${p.role === 'passive' ? 'selected' : ''}>Пассив</option>
                                        <option value="anode" ${p.role === 'anode' ? 'selected' : ''}>Анод (+)</option>
                                        <option value="cathode" ${p.role === 'cathode' ? 'selected' : ''}>Катод (-)</option>
                                    </select>
                                </td>
                            </tr>
                        `;
                    });
                    html += `       </tbody>
                                </table>
                            </div>
                        </div>`;
                    editPinout.innerHTML = html;
                    editPinout.style.display = 'block';

                    const acc = document.getElementById('editPinoutAccordion');
                    const btn = document.getElementById('btnToggleEditPinout');
                    if (btn && acc) {
                        btn.addEventListener('click', () => {
                            acc.classList.toggle('collapsed');
                        });
                    }

                    const tplSel = document.getElementById('pinoutTemplateSelect');
                    if (tplSel && !isLocked) {
                        tplSel.addEventListener('change', (e) => {
                            if (e.target.value) {
                                this.applyPinoutTemplate(e.target.value);
                            }
                        });
                    }

                    const btnFlipInsp = document.getElementById('btnFlipPolarityInsp');
                    if (btnFlipInsp && !isLocked) {
                        btnFlipInsp.addEventListener('click', () => {
                            this.flipSelectedPolarity();
                        });
                    }

                    if (!isLocked) {
                        const updatePinData = (pinNum, field, val) => {
                            if (!comp.customPins) comp.customPins = {};
                            let current = comp.customPins[pinNum];
                            if (!current || typeof current !== 'object') {
                                current = { name: typeof current === 'string' ? current : `Вывод ${pinNum}`, net: '', role: 'signal' };
                            }
                            current[field] = val;
                            comp.customPins[pinNum] = current;
                        };

                        editPinout.querySelectorAll('.pinout-input-name').forEach(inp => {
                            inp.addEventListener('input', (e) => {
                                updatePinData(e.target.dataset.pin, 'name', e.target.value);
                            });
                            inp.addEventListener('change', () => { this.render(); this.saveHistory(); });
                        });

                        editPinout.querySelectorAll('.pinout-input-net').forEach(inp => {
                            inp.addEventListener('input', (e) => {
                                updatePinData(e.target.dataset.pin, 'net', e.target.value.trim());
                            });
                            inp.addEventListener('change', () => { this.render(); this.saveHistory(); });
                        });

                        editPinout.querySelectorAll('.pinout-select-role').forEach(sel => {
                            sel.addEventListener('change', (e) => {
                                updatePinData(e.target.dataset.pin, 'role', e.target.value);
                                this.render();
                                this.saveHistory();
                            });
                        });
                    }
                } else {
                    editPinout.style.display = 'none';
                }
            }
        }
    }

    updateComponentList() {
        if (!this.compListEl) return;
        const search = (this.searchInput ? this.searchInput.value : '').trim().toLowerCase();
        const activePill = document.querySelector('.filter-pills .pill.active');
        const catFilter = activePill ? activePill.dataset.cat : 'all';

        this.compListEl.innerHTML = '';

        const filtered = this.components.filter(c => {
            const matchesSearch = !search || 
                c.designator.toLowerCase().includes(search) || 
                (c.value && c.value.toLowerCase().includes(search)) ||
                (c.footprint && c.footprint.toLowerCase().includes(search));

            if (!matchesSearch) return false;
            if (catFilter === 'all') return true;

            const tpl = this.footprintTemplates[c.footprint];
            const cat = tpl ? tpl.category : '';
            return cat.toLowerCase().includes(catFilter.toLowerCase()) || 
                   (catFilter === 'ic' && c.designator.startsWith('D')) ||
                   (catFilter === 'res' && c.designator.startsWith('R')) ||
                   (catFilter === 'cap' && c.designator.startsWith('C')) ||
                   (catFilter === 'trans' && (c.designator.startsWith('V') || c.designator.startsWith('U'))) ||
                   (catFilter === 'conn' && c.designator.startsWith('X'));
        });

        filtered.sort((a, b) => a.designator.localeCompare(b.designator, undefined, { numeric: true }));

        filtered.forEach(c => {
            const li = document.createElement('li');
            li.className = `component-item ${c.id === this.selectedId ? 'selected' : ''}`;
            li.dataset.id = c.id;

            li.innerHTML = `
                <div class="comp-badge">
                    <span>${c.designator}</span>
                    <span class="layer-tag ${c.layer}">${c.layer}</span>
                    ${c.lockGroupResize ? '<span class="item-group-lock-icon" title="Запрещено групповое масштабирование">🛡️</span>' : ''}
                    ${c.locked ? '<span class="item-lock-icon" title="Элемент закреплен">🔒</span>' : ''}
                </div>
                <div class="comp-desc">${c.value || c.footprint}</div>
            `;

            li.addEventListener('click', () => {
                this.selectComponent(c.id);
                this.panToComponent(c);
            });

            this.compListEl.appendChild(li);
        });
    }

    updateComponentListSelection() {
        document.querySelectorAll('.component-item').forEach(li => {
            li.classList.toggle('selected', li.dataset.id === this.selectedId);
        });
    }

    exportJSON() {
        const data = {
            title: this.boardMeta.title,
            board: this.boardMeta.code,
            exportDate: new Date().toISOString(),
            dimensions: this.boardMeta.dimensions,
            components: this.components
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `boardview_pirrs1000_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // =============================================================================
    // NETS ENGINE, AIRWIRES / RATLINES & NETLIST INSPECTOR
    // =============================================================================

    highlightNet(netId, originPin = null) {
        this.activeHighlightedNet = netId;
        this.activeOriginPin = originPin;
        this.render();
        this.renderNetsListHighlight();
    }

    renderNetsOverlay() {
        if (!this.netsOverlayLayer) return;
        this.netsOverlayLayer.innerHTML = '';

        if (this.netsDisplayMode === 'off' && !this.activeHighlightedNet) {
            return;
        }

        const drawLine = (p1, p2, color, isHighlighted = false) => {
            if (!p1 || !p2) return;
            // 1. Glow shadow path
            const glow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            glow.className.baseVal = 'ratline-base ratline-glow';
            glow.setAttribute('x1', p1.x.toFixed(1));
            glow.setAttribute('y1', p1.y.toFixed(1));
            glow.setAttribute('x2', p2.x.toFixed(1));
            glow.setAttribute('y2', p2.y.toFixed(1));
            glow.setAttribute('stroke', color);
            glow.setAttribute('stroke-width', isHighlighted ? '7' : '3');
            glow.style.color = color;
            this.netsOverlayLayer.appendChild(glow);

            // 2. Animated / crisp core line
            const core = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            core.className.baseVal = `ratline-base ratline-core ${isHighlighted ? '' : 'ratline-static'}`;
            core.setAttribute('x1', p1.x.toFixed(1));
            core.setAttribute('y1', p1.y.toFixed(1));
            core.setAttribute('x2', p2.x.toFixed(1));
            core.setAttribute('y2', p2.y.toFixed(1));
            core.setAttribute('stroke', color);
            core.setAttribute('stroke-width', isHighlighted ? '3' : '1.5');
            this.netsOverlayLayer.appendChild(core);
        };

        // 1. Draw Active Net Connections
        if (this.activeHighlightedNet) {
            const net = window.NETS_MANAGER ? (window.NETS_MANAGER.getNetById(this.activeHighlightedNet) || window.NETS_MANAGER.getAllNets().find(n => n.name.toLowerCase() === this.activeHighlightedNet.toLowerCase())) : null;
            if (net && net.nodes && net.nodes.length > 1) {
                const color = net.color || '#38bdf8';
                const nodePositions = [];
                net.nodes.forEach(node => {
                    const pos = this.pinWorldPositions.get(`${node.compId}:${node.pin}`) || this.getPinWorldCoordinates(node.compId, node.pin);
                    if (pos) {
                        nodePositions.push({ ...pos, compId: node.compId, pinNum: node.pin });
                    }
                });

                if (nodePositions.length > 1) {
                    if (this.activeOriginPin) {
                        // Star mode from clicked pin
                        const origin = nodePositions.find(p => p.compId === this.activeOriginPin.compId && parseInt(p.pinNum) === parseInt(this.activeOriginPin.pinNum)) || nodePositions[0];
                        nodePositions.forEach(p => {
                            if (p !== origin) {
                                drawLine(origin, p, color, true);
                            }
                        });
                    } else {
                        // Minimum Spanning Tree (MST)
                        const mstEdges = this.computeMST(nodePositions);
                        mstEdges.forEach(edge => {
                            drawLine(edge.p1, edge.p2, color, true);
                        });
                    }
                }
            }
        }

        // 2. Draw All Nets if in 'all' mode
        if (this.netsDisplayMode === 'all' && window.NETS_MANAGER) {
            window.NETS_MANAGER.getAllNets().forEach(net => {
                if (this.activeHighlightedNet && (net.id === this.activeHighlightedNet || net.name.toLowerCase() === this.activeHighlightedNet.toLowerCase())) {
                    return; // Already drawn with high emphasis
                }
                if (net.nodes && net.nodes.length > 1) {
                    const nodePositions = [];
                    net.nodes.forEach(node => {
                        const pos = this.pinWorldPositions.get(`${node.compId}:${node.pin}`) || this.getPinWorldCoordinates(node.compId, node.pin);
                        if (pos) nodePositions.push(pos);
                    });
                    if (nodePositions.length > 1) {
                        const mst = this.computeMST(nodePositions);
                        mst.forEach(edge => {
                            drawLine(edge.p1, edge.p2, net.color || '#64748b', false);
                        });
                    }
                }
            });
        }
    }

    computeMST(points) {
        if (!points || points.length < 2) return [];
        const n = points.length;
        const inMST = new Array(n).fill(false);
        const minEdge = new Array(n).fill(Infinity);
        const parent = new Array(n).fill(-1);

        minEdge[0] = 0;
        const edges = [];

        for (let count = 0; count < n; count++) {
            let u = -1;
            for (let i = 0; i < n; i++) {
                if (!inMST[i] && (u === -1 || minEdge[i] < minEdge[u])) {
                    u = i;
                }
            }
            if (u === -1 || minEdge[u] === Infinity) break;
            inMST[u] = true;

            if (parent[u] !== -1) {
                edges.push({ p1: points[parent[u]], p2: points[u] });
            }

            for (let v = 0; v < n; v++) {
                if (!inMST[v]) {
                    const dist = Math.hypot(points[u].x - points[v].x, points[u].y - points[v].y);
                    if (dist < minEdge[v]) {
                        minEdge[v] = dist;
                        parent[v] = u;
                    }
                }
            }
        }
        return edges;
    }

    getPinWorldCoordinates(compId, pinNum) {
        const key = `${typeof compId === 'object' ? compId.id : compId}:${pinNum}`;
        if (this.pinWorldPositions.has(key)) {
            return this.pinWorldPositions.get(key);
        }
        const comp = typeof compId === 'object' ? compId : this.components.find(c => c.id === compId);
        if (!comp) return null;

        const cx = comp.x + comp.width / 2;
        const cy = comp.y + comp.height / 2;
        const rad = ((comp.rotation || 0) * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const pNum = parseInt(pinNum) || 1;
        let localX = comp.x + comp.width * 0.5;
        let localY = comp.y + comp.height * 0.5;

        const fp = comp.footprint || '';
        if (fp.startsWith('RES-AXIAL') || fp.startsWith('CAP-CERAMIC') || fp.startsWith('DIODE-DO35')) {
            localX = pNum === 1 ? comp.x + comp.width * 0.15 : comp.x + comp.width * 0.85;
        }

        const dx = localX - cx;
        const dy = localY - cy;
        return {
            x: cx + dx * cos - dy * sin,
            y: cy + dx * sin + dy * cos
        };
    }

    renderNetsList() {
        if (!this.netsListEl || !window.NETS_MANAGER) return;
        const search = (this.netsSearchInput ? this.netsSearchInput.value : '').trim().toLowerCase();
        const typeFilter = this.currentNetFilterType || 'all';

        this.netsListEl.innerHTML = '';
        const allNets = window.NETS_MANAGER.getAllNets();

        const filtered = allNets.filter(net => {
            const matchesSearch = !search || 
                net.name.toLowerCase().includes(search) || 
                (net.label && net.label.toLowerCase().includes(search)) ||
                (net.description && net.description.toLowerCase().includes(search)) ||
                (net.nodes && net.nodes.some(n => n.compId.toLowerCase().includes(search)));

            if (!matchesSearch) return false;
            if (typeFilter === 'all') return true;
            return (net.type || 'signal').toLowerCase() === typeFilter.toLowerCase();
        });

        filtered.forEach(net => {
            const li = document.createElement('li');
            const isActive = Boolean(
                this.activeHighlightedNet && 
                (this.activeHighlightedNet === net.id || this.activeHighlightedNet.toLowerCase() === net.name.toLowerCase())
            );
            li.className = `net-item ${isActive ? 'active' : ''}`;
            li.dataset.netId = net.id;

            const nodesCount = net.nodes ? net.nodes.length : 0;
            const nodesPreview = (net.nodes || []).slice(0, 6).map(n => `<span class="net-node-tag">${n.compId}.${n.pin}</span>`).join('');
            const moreTag = nodesCount > 6 ? `<span class="net-node-tag">+${nodesCount - 6}</span>` : '';

            li.innerHTML = `
                <div class="net-item-header">
                    <div class="net-title-group">
                        <span class="net-color-dot" style="background-color: ${net.color || '#38bdf8'}; color: ${net.color || '#38bdf8'};"></span>
                        <span class="net-name">${net.name}</span>
                        <span class="net-type-badge net-type-${net.type || 'signal'}">${net.type || 'сигнал'}</span>
                    </div>
                    <span class="net-nodes-count">${nodesCount} выв.</span>
                </div>
                ${net.description ? `<div class="net-desc">${net.description}</div>` : ''}
                <div class="net-nodes-preview">
                    ${nodesPreview}
                    ${moreTag}
                </div>
            `;

            li.addEventListener('click', () => {
                if (isActive) {
                    this.highlightNet(null);
                } else {
                    this.highlightNet(net.id);
                    this.fitNetToScreen(net);
                }
            });

            this.netsListEl.appendChild(li);
        });
    }

    renderNetsListHighlight() {
        if (!this.netsListEl) return;
        this.netsListEl.querySelectorAll('.net-item').forEach(li => {
            const netId = li.dataset.netId;
            const isActive = Boolean(
                this.activeHighlightedNet && 
                (this.activeHighlightedNet === netId || this.activeHighlightedNet.toLowerCase() === netId.toLowerCase())
            );
            li.classList.toggle('active', isActive);
        });
    }

    fitNetToScreen(net) {
        if (!net || !net.nodes || net.nodes.length === 0) return;
        const points = [];
        net.nodes.forEach(node => {
            const pos = this.pinWorldPositions.get(`${node.compId}:${node.pin}`) || this.getPinWorldCoordinates(node.compId, node.pin);
            if (pos) points.push(pos);
        });
        if (points.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });

        const padding = 350;
        const rectW = Math.max(maxX - minX + padding * 2, 800);
        const rectH = Math.max(maxY - minY + padding * 2, 600);
        const rectCX = (minX + maxX) / 2;
        const rectCY = (minY + maxY) / 2;

        const vpW = this.viewportContainer.clientWidth || 1200;
        const vpH = this.viewportContainer.clientHeight || 800;

        const scaleX = vpW / rectW;
        const scaleY = vpH / rectH;
        const targetZoom = Math.min(Math.max(Math.min(scaleX, scaleY) * 0.85, 0.08), 1.2);

        this.camera.zoom = targetZoom;
        this.camera.x = vpW / 2 - rectCX * targetZoom;
        this.camera.y = vpH / 2 - rectCY * targetZoom;
        this.updateTransform();
    }
}

function initBoardviewApp() {
    if (!window.app) {
        window.app = new BoardviewApp();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBoardviewApp);
} else {
    initBoardviewApp();
}

