/* Minimal dock presentation; the existing webOS app launcher stays intact. */
(function () {
    'use strict';
    var overlay = document.getElementById('allAppsDrawer');
    var drawerGrid = document.getElementById('allAppsGrid');
    var drawerOpen = false, cards = [], selected = 0;
    var oldRender = window.renderAppsShelf;
    function getApp(id) {
        for (var i = 0; i < state.catalog.length; i++) {
            if (state.catalog[i].id === id) return state.catalog[i];
        }
        return null;
    }
    function getDockApps() {
        var used = {}, pinned = [];
        state.favorites.forEach(function(id) {
            var app = getApp(id);
            if (app && !used[id]) { used[id] = true; pinned.push(app); }
        });
        return pinned;
    }
    function paint(app, button) {
        var icon = document.createElement('div');
        var device = devicePreset(app, state.hdmiDevices);
        icon.className = 'app-icon';
        icon.style.background = 'rgba(23,28,41,.54)';
        if (isHDMI(app)) {
            icon.style.background = 'rgba(100,29,48,.42)';
            if (device.logo) {
                var fb = document.createElement('span');
                fb.className = 'app-art-fallback';
                fb.textContent = device.title || app.title;
                icon.appendChild(fb);
                addTileImage(icon, 'assets/brands/' + device.logo + '.svg', true);
            } else icon.innerHTML = deviceArtwork(device.shape);
        } else {
            if (app.id === 'netflix') icon.style.background = 'rgba(23,8,16,.66)';
            else if (app.id === 'spotify-beehive') icon.style.background = 'rgba(11,39,26,.66)';
            var fb2 = document.createElement('span');
            fb2.className = 'app-art-fallback';
            fb2.textContent = app.title;
            icon.appendChild(fb2);
            var logo = APP_LOGOS[app.id];
            if (logo || app.iconUrl)
                addTileImage(icon, logo ? 'assets/brands/' + logo + '.svg' : app.iconUrl, !!logo);
        }
        button.appendChild(icon);
    }
    function tile(app, dockTile) {
        var btn = document.createElement('button');
        var title = devicePreset(app, state.hdmiDevices).title || app.title;
        btn.className = dockTile ? 'app-tile nav-item' : 'all-app-card';
        btn.dataset.id = app.id;
        btn.setAttribute('aria-label', title);
        if (dockTile) {
            btn.dataset.title = title;
            btn.dataset.tag = app.tag;
            btn.dataset.desc = app.desc;
            btn.dataset.color = app.color;
        }
        paint(app, btn);
        if (!dockTile) {
            var caption = document.createElement('span');
            caption.className = 'all-app-card-title';
            caption.textContent = title;
            btn.appendChild(caption);
        }
        btn.addEventListener('mouseenter', function () {
            if (dockTile) setMainFocus(btn);
            else focusCard(btn);
        });
        btn.addEventListener('click', function () {
            if (!dockTile) closeDrawer();
            launchApp(app.id);
        });
        return btn;
    }
    function dockRender() {
        if (shelfEdit) { oldRender(); return; } // preserve original 12-app reorder UI
        var grid = document.getElementById('appsGrid');
        grid.innerHTML = '';
        var pins = getDockApps();
        pins.forEach(function (app) { grid.appendChild(tile(app, true)); });
        var more = document.createElement('button');
        more.className = 'app-tile more-tile nav-item';
        more.id = 'moreAppsBtn';
        more.dataset.id = '__more__';
        more.setAttribute('aria-label', 'All apps and inputs');
        var dots = document.createElement('span');
        dots.className = 'more-dots';
        dots.setAttribute('aria-hidden', 'true');
        dots.textContent = '•••';
        more.appendChild(dots);
        more.addEventListener('mouseenter', function () { setMainFocus(more); });
        more.addEventListener('click', openDrawer);
        grid.appendChild(more);
        var maxWidth = Math.min(1080, window.innerWidth - 72);
        grid.style.width = Math.min(maxWidth, (pins.length + 1) * 162 + 18) + 'px';
        refreshMainNavList();
    }
    function focusCard(btn) {
        if (!btn) return;
        cards.forEach(function (x) { x.classList.remove('focused'); });
        btn.classList.add('focused');
        btn.focus();
        selected = cards.indexOf(btn);
        var box = btn.getBoundingClientRect();
        var bounds = drawerGrid.getBoundingClientRect();
        if (box.bottom > bounds.bottom - 8) drawerGrid.scrollTop += box.bottom - bounds.bottom + 14;
        else if (box.top < bounds.top + 8) drawerGrid.scrollTop -= bounds.top - box.top + 14;
    }
    function openDrawer() {
        if (shelfEdit) return;
        drawerOpen = true;
        overlay.classList.add('active');
        drawerGrid.innerHTML = '';
        cards = [];
        var shown = {};
        getDockApps().forEach(function (app) { shown[app.id] = true; });
        state.favorites.concat(state.catalog.map(function (app) { return app.id; }))
            .forEach(function (id) {
                if (shown[id]) return;
                shown[id] = true;
                var app = getApp(id);
                if (!app) return;
                if (state.installedAppIds && !state.installedAppIds[id] &&
                    !isHDMI(app) && id !== 'com.webos.app.mediadiscovery') return;
                var btn = tile(app, false);
                drawerGrid.appendChild(btn);
                cards.push(btn);
            });
        if (cards.length) focusCard(cards[0]);
        else document.getElementById('closeAllAppsBtn').focus();
    }
    function closeDrawer() {
        drawerOpen = false;
        overlay.classList.remove('active');
        var more = document.getElementById('moreAppsBtn');
        if (more) setMainFocus(more);
    }
    function moveCard(key) {
        if (!cards.length) return;
        var cols = window.innerWidth <= 1000 ? 3 : 4;
        var n = selected + (key === 'ArrowDown' ? cols :
            key === 'ArrowUp' ? -cols : key === 'ArrowRight' ? 1 : -1);
        if (n < 0 || n >= cards.length) return;
        if ((key === 'ArrowLeft' || key === 'ArrowRight') &&
            Math.floor(n / cols) !== Math.floor(selected / cols)) return;
        focusCard(cards[n]);
    }
    document.addEventListener('keydown', function (e) {
        if (!drawerOpen) return;
        // Capture-phase navigation bypasses the original key listener, so
        // maintain its OLED screensaver activity timestamp ourselves.
        window.lastActivity = Date.now();
        if (e.keyCode === 461 || e.key === 'Escape' || e.key === 'GoBack') closeDrawer();
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                 e.key === 'ArrowUp' || e.key === 'ArrowDown') moveCard(e.key);
        else if (e.key === 'Enter') {
            if (cards.length) cards[selected].click();
            else closeDrawer();
        } else return;
        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);
    document.getElementById('closeAllAppsBtn').addEventListener('click', closeDrawer);

    // Upgrade old four-slot preferences without replacing the user's
    // existing favorites. This happens once, after app discovery if possible.
    function migratePreviousDock() {
        if (localStorage.getItem('fmtv_dock_migrated_v2') === 'done') return;
        var old = null;
        try { old = JSON.parse(localStorage.getItem('fmtv_dock_slots') || 'null'); }
        catch (e) {}
        if (Array.isArray(old)) {
            var preferred = [];
            old.forEach(function(token) {
                var app = getApp(token);
                if (!app && token === 'auto-apple-tv') {
                    app = state.catalog.filter(function(entry) {
                        return /^apple tv/i.test(entry.title || '') ||
                               /appletv/i.test(entry.id || '');
                    })[0];
                }
                if (!app && token === 'auto-switch') {
                    app = state.catalog.filter(function(entry) {
                        return isHDMI(entry) && state.hdmiDevices[entry.id] === 'switch';
                    })[0];
                }
                if (app && preferred.indexOf(app.id) === -1) preferred.push(app.id);
            });
            if (preferred.length) {
                state.favorites = preferred.concat(state.favorites.filter(function(id) {
                    return preferred.indexOf(id) === -1;
                }));
                try { localStorage.setItem('fmtv_favorites', JSON.stringify(state.favorites)); }
                catch (e) {}
            }
        }
        try { localStorage.setItem('fmtv_dock_migrated_v2', 'done'); }
        catch (e) {}
    }
    var nativeAddLaunchPoints = window.addLaunchPoints;
    if (typeof nativeAddLaunchPoints === 'function') {
        window.addLaunchPoints = function(points) {
            nativeAddLaunchPoints(points);
            migratePreviousDock();
            dockRender();
        };
    }
    setTimeout(function() {
        migratePreviousDock();
        dockRender();
    }, 5000);

    window.renderAppsShelf = dockRender;
    dockRender();
})();
