// === config - replace with yours ===
const CLIENT_ID = "284711238420-jei4nevj7bh2jedqkfri7g1vcbc3ac6u.apps.googleusercontent.com";
// include openid/profile/email so we can fetch user name for the pill
const SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly openid profile email";
const SPREADSHEET_ID = "1HBZhADqWF_9FpHUlU106nh4J7i4hvDot8Xnkgjg_pks";
const RANGE = "'Data Template'!A1:Z1000";
// local preview image path (your uploaded file) - used in signin modal
const PREVIEW_IMAGE_PATH = "/mnt/data/a39ed741-c198-4012-88e7-03c63c8f7a25.png";
// ===================================

let tokenClient;

function log(...args) { console.log(...args); }
function err(...args) { console.error(...args); }

/* ----------------- UI helpers (modal + pill) ----------------- */
function hideSignInModal() {
    const modal = document.getElementById('signin-modal');
    if (modal) {
        modal.style.transition = 'opacity 220ms ease';
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
        }, 240);
    }
    const headerBtn = document.getElementById('signin-btn');
    if (headerBtn) headerBtn.style.display = 'none';
}

function showSignInModal() {
    const modal = document.getElementById('signin-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.setAttribute('aria-hidden', 'false');
    }
    const headerBtn = document.getElementById('signin-btn');
    if (headerBtn) headerBtn.style.display = 'inline-block';
}

function showSignInPill(displayName) {
    let pill = document.getElementById('signed-pill');
    if (!pill) {
        pill = document.createElement('div');
        pill.id = 'signed-pill';
        pill.style.position = 'fixed';
        pill.style.top = '14px';
        pill.style.right = '18px';
        pill.style.zIndex = 9999;
        pill.style.background = 'rgba(255,255,255,0.04)';
        pill.style.color = '#dff';
        pill.style.border = '1px solid rgba(255,255,255,0.06)';
        pill.style.padding = '8px 12px';
        pill.style.borderRadius = '20px';
        pill.style.fontWeight = '600';
        pill.style.fontSize = '13px';
        pill.style.backdropFilter = 'blur(6px)';
        pill.style.display = 'flex';
        pill.style.gap = '10px';
        pill.style.alignItems = 'center';

        const nameSpan = document.createElement('span');
        nameSpan.id = 'signed-name';
        nameSpan.style.whiteSpace = 'nowrap';
        pill.appendChild(nameSpan);

        const outBtn = document.createElement('button');
        outBtn.textContent = 'Sign out';
        outBtn.style.background = 'transparent';
        outBtn.style.border = '1px solid rgba(255,255,255,0.08)';
        outBtn.style.color = '#dff';
        outBtn.style.padding = '6px 8px';
        outBtn.style.borderRadius = '12px';
        outBtn.style.cursor = 'pointer';
        outBtn.onclick = () => { doSignOut(); };
        pill.appendChild(outBtn);

        document.body.appendChild(pill);
    }

    const nameSpan = document.getElementById('signed-name');
    nameSpan.textContent = displayName ? `Signed in — ${displayName}` : 'Signed in';
}

function removeSignInPill() {
    const pill = document.getElementById('signed-pill');
    if (pill) pill.remove();
}

function doSignOut() {
    try {
        // Clear gapi token locally
        gapi.client.setToken({ access_token: null });
    } catch (e) {
        console.warn('gapi token clear error', e);
    }
    // Optionally revoke token server-side (commented)
    // let token = gapi.client && gapi.client.getToken && gapi.client.getToken().access_token;
    // if (token) { fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method:'POST' }); }

    removeSignInPill();
    showSignInModal();
}

/* ----------------- GIS + gapi initialization ----------------- */

window.onload = function () {
    log('origin=', window.location.origin);

    if (typeof gapi === 'undefined' || typeof google === 'undefined') {
        err('Required scripts not loaded. Make sure you included both:');
        err('- https://accounts.google.com/gsi/client');
        err('- https://apis.google.com/js/api.js');
        return;
    }

    // load gapi client
    gapi.load('client', async () => {
        try {
            await gapi.client.init({
                discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
            });
            log('gapi.client initialized (discovery loaded)');
        } catch (e) {
            err('gapi.client.init error (discovery load):', e);
        }

        // init token client
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse) => {
                if (tokenResponse.error) {
                    err('Token response error:', tokenResponse);
                    const st = document.getElementById('status');
                    if (st) st.innerText = 'Token error — see console';
                    return;
                }
                log('Received access token');
                gapi.client.setToken({ access_token: tokenResponse.access_token });

                // hide modal and show signed-in indicator (try to fetch name)
                hideSignInModal();
                showUserInfoFromToken().catch(() => showSignInPill());

                // fetch sheet
                fetchSheet();
            }
        });

        // wire buttons: modal button and header fallback
        const modalBtn = document.getElementById('modal-signin-btn');
        if (modalBtn) {
            modalBtn.addEventListener('click', () => {
                tokenClient.requestAccessToken({ prompt: 'consent' });
            });
        }
        const headerBtn = document.getElementById('signin-btn');
        if (headerBtn) {
            headerBtn.addEventListener('click', () => {
                tokenClient.requestAccessToken({ prompt: 'consent' });
            });
        } else {
            log('signin-btn not found — modal will be primary entry');
        }
    });
};

/* Fetch userinfo using token to display name in pill (requires openid/profile/email scope) */
async function showUserInfoFromToken() {
    try {
        const token = gapi.client.getToken().access_token;
        if (!token) { showSignInPill(); return; }
        const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: 'Bearer ' + token }
        });
        if (!r.ok) { showSignInPill(); return; }
        const info = await r.json();
        showSignInPill(info.name || info.email || 'Signed in');
    } catch (e) {
        console.warn('userinfo fetch failed', e);
        showSignInPill();
    }
}

/* ----------------- Sheets fetch ----------------- */
async function fetchSheet() {
    try {
        const resp = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE
        });
        const rows = resp.result.values || [];
        log('Loaded rows:', rows.length);
        console.log(rows);
        const st = document.getElementById('status');
        if (st) st.innerText = `Loaded ${rows.length} rows`;
        if (rows.length > 0) {
            const headers = rows[0];
            const data = rows.slice(1).map(r => {
                const obj = {};
                headers.forEach((h, i) => obj[h] = r[i] || '');
                return obj;
            });
            window._sheetData = data;
            if (typeof createFromData === 'function') {
                createFromData(window._sheetData);
            } else {
                log('three createFromData not ready yet — _sheetData stored, will create after init.');
            }
        } else {
            log('No rows found in sheet.');
        }
    } catch (e) {
        err('Sheets request failed:', e);
        const st = document.getElementById('status');
        if (st) st.innerText = 'Sheets API error — see console';
    }
}

/* ===========================================================
   THREE.js CSS3D integration (tiles, coloring, 4 arrangements)
   =========================================================== */

(function () {
    // ---------- CONFIG ----------
    const CONTAINER_ID = 'container';
    const TABLE_COLS = 20, TABLE_ROWS = 10;
    const GRID_X = 5, GRID_Y = 4, GRID_Z = 10;
    const SPACING_X = 140, SPACING_Y = 180, SPACING_Z = 220;
    const RADIUS = 800;
    // --------------------------------

    // ---------- helpers ----------
    function rowsToObjects(rows) {
        if (!rows || rows.length === 0) return [];
        if (Array.isArray(rows[0])) {
            const headers = rows[0].map(h => String(h).trim());
            return rows.slice(1).map(r => {
                const obj = {};
                headers.forEach((h, i) => obj[h] = r[i] || '');
                return obj;
            });
        }
        return rows;
    }

    function parseNetWorth(raw) {
        if (raw == null) return 0;
        const s = String(raw).replace(/[^0-9.-]+/g, '');
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }

    function colorForNetWorth(n) {
        if (n < 100000) return 'rgba(255,77,77,0.95)';        // red
        if (n <= 200000) return 'rgba(255,153,0,0.95)';      // orange
        return 'rgba(0,204,102,0.95)';                       // green
    }
    // --------------------------------

    // three scene state
    let scene, camera, cssRenderer, controls;
    let objects = [], targets = { table: [], sphere: [], helix: [], grid: [] };

    function initThree() {
        const container = document.getElementById(CONTAINER_ID);
        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || Math.max(window.innerHeight * 0.75, 600);

        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(40, width / height, 1, 10000);
        camera.position.set(0, 0, 3000);

        cssRenderer = new THREE.CSS3DRenderer();
        cssRenderer.setSize(width, height);
        cssRenderer.domElement.style.position = 'relative';
        cssRenderer.domElement.style.top = '0';
        container.innerHTML = '';
        container.appendChild(cssRenderer.domElement);

        if (typeof THREE.TrackballControls !== 'undefined') {
            controls = new THREE.TrackballControls(camera, cssRenderer.domElement);
            controls.minDistance = 500;
            controls.maxDistance = 6000;
            controls.addEventListener('change', render);
        }

        window.addEventListener('resize', onWindowResize);
    }

    function onWindowResize() {
        const container = document.getElementById(CONTAINER_ID);
        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || Math.max(window.innerHeight * 0.75, 600);
        camera.aspect = width / height; camera.updateProjectionMatrix();
        cssRenderer.setSize(width, height);
        render();
    }

    // --- makeTileElement (smaller + performant) ---
    function makeTileElement(item, index) {
        const TILE_W = 110;
        const TILE_H = 140;

        function pick(obj, candidates) {
            if (!obj) return '';
            const keys = Object.keys(obj);
            const lowerMap = {};
            keys.forEach(k => lowerMap[k.toLowerCase()] = k);
            for (const c of candidates) {
                const found = lowerMap[c.toLowerCase()];
                if (found) return obj[found];
            }
            return '';
        }

        const name = pick(item, ['name', 'full name', 'fullname']) || Object.values(item)[0] || '';
        const role = pick(item, ['role', 'title', 'job', 'position']) || '';
        const photo = pick(item, ['photo_url', 'photo', 'image', 'avatar']) || '';
        const netRaw = pick(item, ['net worth', 'net_worth', 'net', 'worth']) || '';
        const age = pick(item, ['age']) || '';
        const country = pick(item, ['country', 'location']) || '';
        const interest = pick(item, ['interest', 'interests', 'hobby']) || '';
        const netVal = (function parseNet(n) { if (!n) return 0; const s = String(n).replace(/[^0-9.-]+/g, ''); const v = parseFloat(s); return isNaN(v) ? 0 : v; })(netRaw);

        const element = document.createElement('div');
        element.className = 'element';
        element.style.width = TILE_W + 'px';
        element.style.height = TILE_H + 'px';
        element.style.boxSizing = 'border-box';
        element.style.padding = '6px';
        element.style.borderRadius = '8px';
        element.style.display = 'flex';
        element.style.flexDirection = 'column';
        element.style.justifyContent = 'space-between';
        element.style.overflow = 'hidden';
        element.style.color = '#011';
        element.style.background = colorForNetWorth(netVal);
        element.style.cursor = 'default';
        element.style.border = '1px solid rgba(255,255,255,0.04)';
        element.style.willChange = 'transform, opacity';
        element.style.position = 'relative';

        const number = document.createElement('div');
        number.className = 'number';
        number.style.position = 'absolute';
        number.style.top = '6px';
        number.style.right = '8px';
        number.style.fontSize = '11px';
        number.style.opacity = '0.9';
        number.textContent = index + 1;
        element.appendChild(number);

        if (photo) {
            const imgWrap = document.createElement('div');
            imgWrap.style.width = '100%';
            imgWrap.style.height = '48px';
            imgWrap.style.overflow = 'hidden';
            imgWrap.style.borderRadius = '6px';
            imgWrap.style.marginBottom = '6px';
            imgWrap.style.flex = '0 0 48px';
            imgWrap.style.background = 'rgba(0,0,0,0.06)';

            const img = document.createElement('img');
            img.decoding = 'async';
            img.loading = 'lazy';
            img.src = photo;
            img.alt = name;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.display = 'block';
            img.onerror = () => { img.style.display = 'none'; };
            imgWrap.appendChild(img);
            element.appendChild(imgWrap);
        } else {
            const spacer = document.createElement('div');
            spacer.style.height = '6px';
            spacer.style.flex = '0 0 6px';
            element.appendChild(spacer);
        }

        const nameEl = document.createElement('div');
        nameEl.style.fontSize = '13px';
        nameEl.style.fontWeight = '700';
        nameEl.style.lineHeight = '1.1';
        nameEl.style.color = '#001816';
        nameEl.textContent = name;
        element.appendChild(nameEl);

        const roleEl = document.createElement('div');
        roleEl.style.fontSize = '11px';
        roleEl.style.opacity = '0.95';
        roleEl.textContent = role;
        element.appendChild(roleEl);

        const metaRow = document.createElement('div');
        metaRow.style.display = 'flex';
        metaRow.style.justifyContent = 'space-between';
        metaRow.style.fontSize = '11px';
        metaRow.style.marginTop = '4px';
        metaRow.style.opacity = '0.95';

        const ageEl = document.createElement('div');
        ageEl.textContent = age ? `Age: ${age}` : '';
        metaRow.appendChild(ageEl);

        const countryEl = document.createElement('div');
        countryEl.textContent = country || '';
        countryEl.style.textAlign = 'right';
        metaRow.appendChild(countryEl);

        element.appendChild(metaRow);

        if (interest) {
            const interestEl = document.createElement('div');
            interestEl.style.fontSize = '10px';
            interestEl.style.marginTop = '6px';
            interestEl.style.whiteSpace = 'nowrap';
            interestEl.style.overflow = 'hidden';
            interestEl.style.textOverflow = 'ellipsis';
            interestEl.textContent = `Interests: ${interest}`;
            element.appendChild(interestEl);
        }

        const netEl = document.createElement('div');
        netEl.style.fontSize = '12px';
        netEl.style.fontWeight = '700';
        netEl.style.marginTop = '6px';
        netEl.textContent = netRaw;
        element.appendChild(netEl);

        return element;
    }

    // targets builders
    function buildTableTargets(count) {
        targets.table = [];
        for (let i = 0; i < count; i++) {
            const col = i % TABLE_COLS;
            const row = Math.floor(i / TABLE_COLS);
            const obj = new THREE.Object3D();
            obj.position.x = (col - (TABLE_COLS / 2 - 0.5)) * SPACING_X;
            obj.position.y = - (row - (TABLE_ROWS / 2 - 0.5)) * SPACING_Y;
            obj.position.z = 0;
            targets.table.push(obj);
        }
    }

    function buildSphereTargets(count) {
        targets.sphere = [];
        const vector = new THREE.Vector3();
        for (let i = 0; i < count; i++) {
            const phi = Math.acos(-1 + (2 * i) / count);
            const theta = Math.sqrt(count * Math.PI) * phi;
            const obj = new THREE.Object3D();
            obj.position.setFromSphericalCoords(RADIUS, phi, theta);
            vector.copy(obj.position).multiplyScalar(2);
            obj.lookAt(vector);
            targets.sphere.push(obj);
        }
    }

    function buildHelixTargets(count) {
        targets.helix = [];
        const radius = 900;
        const separation = 16;
        const thetaStep = 0.55;

        for (let i = 0; i < count; i++) {
            const side = i % 2;
            const j = Math.floor(i / 2);
            const t = j * thetaStep;
            const offset = side ? Math.PI : 0;
            const obj = new THREE.Object3D();
            obj.position.x = Math.cos(t + offset) * radius;
            obj.position.z = Math.sin(t + offset) * radius;
            obj.position.y = - (j - (count / 4)) * separation;
            obj.lookAt(new THREE.Vector3(0, obj.position.y, 0));
            targets.helix.push(obj);
        }
    }

    function buildGridTargets(count) {
        targets.grid = [];
        for (let i = 0; i < count; i++) {
            const xi = i % GRID_X;
            const yi = Math.floor(i / GRID_X) % GRID_Y;
            const zi = Math.floor(i / (GRID_X * GRID_Y));
            const obj = new THREE.Object3D();
            obj.position.x = (xi - (GRID_X - 1) / 2) * SPACING_X;
            obj.position.y = ((GRID_Y - 1) / 2 - yi) * SPACING_Y;
            obj.position.z = (zi - (GRID_Z - 1) / 2) * SPACING_Z;
            targets.grid.push(obj);
        }
    }

    // batched creation
    function createFromData(rowsOrObjects) {
        const data = rowsToObjects(rowsOrObjects);
        const count = data.length;
        if (!Array.isArray(data) || count === 0) {
            console.warn('createFromData: no data provided');
            const st = document.getElementById('status');
            if (st) st.innerText = 'No data to display';
            return;
        }

        objects.forEach(o => scene.remove(o));
        objects = [];
        targets = { table: [], sphere: [], helix: [], grid: [] };

        buildTableTargets(count);
        buildSphereTargets(count);
        buildHelixTargets(count);
        buildGridTargets(count);

        const BATCH = 30;
        let i = 0;

        function createChunk() {
            const end = Math.min(i + BATCH, count);
            for (; i < end; i++) {
                const el = makeTileElement(data[i], i);
                const obj = new THREE.CSS3DObject(el);
                obj.position.x = Math.random() * 4000 - 2000;
                obj.position.y = Math.random() * 4000 - 2000;
                obj.position.z = Math.random() * 4000 - 2000;
                scene.add(obj);
                objects.push(obj);
            }
            const st = document.getElementById('status');
            if (st) st.innerText = `Creating tiles: ${objects.length}/${count}`;
            if (i < count) {
                if (typeof requestIdleCallback !== 'undefined') {
                    requestIdleCallback(createChunk, { timeout: 200 });
                } else {
                    setTimeout(createChunk, 50);
                }
            } else {
                transformTo(targets.table, 800);
                if (st) st.innerText = `Status: ${count} tiles created`;
            }
        }

        createChunk();
    }

    // transform using TWEEN
    function transformTo(targetArray, duration) {
        if (typeof TWEEN === 'undefined') {
            for (let i = 0; i < objects.length; i++) {
                const obj = objects[i];
                const t = targetArray[i] || new THREE.Object3D();
                obj.position.copy(t.position);
                obj.rotation.copy(t.rotation || new THREE.Euler());
            }
            return;
        }

        TWEEN.removeAll();
        for (let i = 0; i < objects.length; i++) {
            const object = objects[i];
            const target = targetArray[i] || new THREE.Object3D();

            new TWEEN.Tween(object.position)
                .to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
                .easing(TWEEN.Easing.Exponential.InOut)
                .start();

            new TWEEN.Tween(object.rotation)
                .to({ x: (target.rotation && target.rotation.x) || 0, y: (target.rotation && target.rotation.y) || 0, z: (target.rotation && target.rotation.z) || 0 }, Math.random() * duration + duration)
                .easing(TWEEN.Easing.Exponential.InOut)
                .start();
        }

        new TWEEN.Tween(camera.position)
            .to({ x: 0, y: 0, z: 3000 }, duration * 1.2)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start();
    }

    // render & animate
    function animate() {
        requestAnimationFrame(animate);
        if (typeof TWEEN !== 'undefined') TWEEN.update();
        if (controls && controls.update) controls.update();
        if (cssRenderer && scene && camera) cssRenderer.render(scene, camera);
    }

    function render() {
        if (cssRenderer && scene && camera) cssRenderer.render(scene, camera);
    }

    // UI wiring
    function wireUI() {
        const bTable = document.getElementById('table');
        const bSphere = document.getElementById('sphere');
        const bHelix = document.getElementById('helix');
        const bGrid = document.getElementById('grid');

        if (bTable) bTable.addEventListener('click', () => transformTo(targets.table, 1000));
        if (bSphere) bSphere.addEventListener('click', () => transformTo(targets.sphere, 1200));
        if (bHelix) bHelix.addEventListener('click', () => transformTo(targets.helix, 1400));
        if (bGrid) bGrid.addEventListener('click', () => transformTo(targets.grid, 1200));
    }

    function start() {
        if (typeof THREE === 'undefined' || typeof THREE.CSS3DObject === 'undefined' || typeof THREE.CSS3DRenderer === 'undefined') {
            console.error('Three.js or CSS3DRenderer not loaded. Include three.min.js and CSS3DRenderer.js before this script.');
            const st = document.getElementById('status');
            if (st) st.innerText = 'Three/CSS3D not loaded';
            return;
        }
        initThree();
        wireUI();
        animate();
        const st = document.getElementById('status');
        if (st) st.innerText = 'Status: ready — waiting for sheet data';

        // show modal if not already signed in
        // if gapi has a token already, skip modal and show pill
        try {
            const tok = gapi.client && gapi.client.getToken && gapi.client.getToken();
            if (tok && tok.access_token) {
                // attempt to show user info
                showUserInfoFromToken().catch(() => showSignInPill());
            } else {
                showSignInModal();
            }
        } catch (e) {
            showSignInModal();
        }
    }

    window.createFromData = createFromData;
    window._threeInit = start;

    window.addEventListener('load', start);

})(); // end three IIFE
