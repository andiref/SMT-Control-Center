        // ─── STATE ──────────────────────────────────────────────────────────
        var currentUser = null;
        var tasks = {};
        var handovers = {};
        var lineReports = {};
        var lineStatus = { L1: 'OK', L2: 'OK', L3: 'OK', L4: 'OK', L5: 'OK', L6: 'OK' };
        var currentView = 'board';
        var toastTimer;
        var confirmCallback = null;
        var editingReportId = null;
        var editingHandoverId = null;

        var LINES = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
        var PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
        var STATUSES = ['Open', 'In Progress', 'Pending Parts', 'Resolved'];
        var CATS = ['Quality Issue', 'Equipment Fault', 'Process Issue', 'Technician Task', 'Preventive Maint.'];
        var CAT_ICON = { 'Quality Issue': '🔍', 'Equipment Fault': '⚙️', 'Process Issue': '📋', 'Technician Task': '👷',
            'Preventive Maint.': '🛠️' };

        // ─── SESSION PERSISTENCE ──────────────────────────────────────────
        var SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours (one shift)

        function saveUser(user) {
            try { localStorage.setItem('smt_user', JSON.stringify({ _ts: Date.now(), data: user })); } catch (e) {}
        }

        function loadStoredUser() {
            try {
                var raw = localStorage.getItem('smt_user');
                if (raw) {
                    var stored = JSON.parse(raw);
                    // Support legacy format (no _ts wrapper)
                    var user = stored._ts ? stored.data : stored;
                    var ts   = stored._ts || 0;
                    if (stored._ts && Date.now() - ts > SESSION_TTL_MS) {
                        localStorage.removeItem('smt_user');
                        return null;
                    }
                    if (user && user.name && user.badge) {
                        return user;
                    }
                }
            } catch (e) {}
            return null;
        }

        function clearStoredUser() {
            try { localStorage.removeItem('smt_user'); } catch (e) {}
        }

        // ─── THEME ───────────────────────────────────────────────────────────
        var themeToggleBtns = [];
        function applyTheme(light) {
            document.body.classList.toggle('light', !!light);
            var icon  = light ? '☀️' : '🌙';
            var label = light ? '☀️ Light mode' : '🌙 Dark mode';
            var mobile  = document.getElementById('theme-toggle-mobile');
            var desktop = document.getElementById('theme-toggle-desktop');
            var sidebar = document.getElementById('theme-toggle-sidebar');
            if (mobile)  mobile.textContent  = icon;
            if (desktop) desktop.textContent = icon;
            if (sidebar) sidebar.textContent = label;
            try { localStorage.setItem('smt_theme', light ? 'light' : 'dark'); } catch(e) {}
            var meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute('content', light ? '#f0f2f8' : '#0a0a0f');
        }
        function toggleTheme() {
            applyTheme(!document.body.classList.contains('light'));
        }
        // Apply saved preference immediately on load
        (function() {
            try {
                var saved = localStorage.getItem('smt_theme');
                if (saved === 'light') applyTheme(true);
            } catch(e) {}
        })();
        // Wire buttons after DOM ready (initThemeToggles called from initApp)
        function initThemeToggles() {
            themeToggleBtns = [
                document.getElementById('theme-toggle-mobile'),
                document.getElementById('theme-toggle-desktop'),
                document.getElementById('theme-toggle-sidebar')
            ];
            themeToggleBtns.forEach(function(btn) {
                if (btn) btn.addEventListener('click', toggleTheme);
            });
            // Set initial label
            applyTheme(document.body.classList.contains('light'));
        }

        // ─── HELPERS ─────────────────────────────────────────────────────────
        function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;'); }

        function sanitizeFirebase(str) {
            return String(str).replace(/\./g, '_').replace(/\$/g, '_').replace(/#/g, '_')
                .replace(/\[/g, '_').replace(/\]/g, '_').replace(/\//g, '_');
        }

        function getShift() {
            var h = new Date().getHours();
            if (h >= 7 && h < 15) return 'Shift 1 (7AM-3PM)';
            if (h >= 15 && h < 23) return 'Shift 2 (3PM-11PM)';
            return 'Shift 3 (11PM-7AM)';
        }

        function taskArray() {
            return Object.keys(tasks).map(function(id) { return Object.assign({}, tasks[id], { _id: id }); })
                .filter(function(t) { return !t.archived; });
        }

        function archivedArray() {
            return Object.keys(tasks).map(function(id) { return Object.assign({}, tasks[id], { _id: id }); })
                .filter(function(t) { return t.archived; });
        }

        function statusKey(s) { return s.replace(/ /g, ''); }

        function fmtDate(ts) {
            if (!ts) return '';
            return new Date(ts).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
                minute: '2-digit' });
        }

        function showToast(msg) {
            var el = document.getElementById('toast');
            if (!el) return;
            el.textContent = msg;
            el.classList.add('show');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(function() { el.classList.remove('show'); }, 2000);
        }

        function todayStr() {
            var n = new Date();
            return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate())
                .padStart(2, '0');
        }

        function getDateRange(fromId, toId) {
            var fromVal = document.getElementById(fromId).value;
            var toVal = document.getElementById(toId).value;
            var from = fromVal ? new Date(fromVal + 'T00:00:00') : new Date(0);
            var to = toVal ? new Date(toVal + 'T23:59:59') : new Date(8640000000000000);
            return { from: from, to: to };
        }

        function autoWidth(ws, rows) {
            if (!rows.length) return;
            var keys = Object.keys(rows[0]);
            ws['!cols'] = keys.map(function(k) {
                var max = k.length;
                rows.forEach(function(r) { var v = String(r[k] || ''); if (v.length > max) max = v.length; });
                return { wch: Math.min(max + 2, 60) };
            });
        }

        // ─── NEW FEATURE HELPERS ───────────────────────────────────────────
        function logAudit(action, details, taskId) {
            if (!currentUser) return;
            auditRef.push({ user: currentUser.name, badge: currentUser.badge, action: action, details: details || '', taskId: taskId || '', timestamp: Date.now() });
        }
        function getAgeClass(created) {
            if (!created) return '';
            var hours = (Date.now() - created) / 3600000;
            if (hours >= 2) return 'escalated';
            if (hours >= 1) return 'warning';
            return '';
        }
        function fmtAge(created) {
            if (!created) return '';
            var age = Date.now() - created;
            var h = Math.floor(age / 3600000);
            var m = Math.floor((age % 3600000) / 60000);
            return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
        }
        function checkDuplicateIssue(line, title) {
            var arr = taskArray();
            var keywords = title.toLowerCase().split(/\s+/).filter(function(w) { return w.length > 3; });
            return arr.find(function(t) {
                if (t.line !== line || t.status === 'Resolved') return false;
                return keywords.some(function(k) { return (t.title || '').toLowerCase().indexOf(k) !== -1; });
            });
        }
        function checkDuplicateLineReport(line, date, shift, model) {
            var arr = Object.keys(lineReports).map(function(id) { return Object.assign({}, lineReports[id], { _id: id }); });
            return arr.find(function(r) { return r.line === line && r.date === date && r.shift === shift && r.model === model; });
        }
        function autoArchiveResolved() {
            var cutoff = Date.now() - (7 * 24 * 3600000);
            Object.keys(tasks).forEach(function(id) {
                var t = tasks[id];
                if (t && t.status === 'Resolved' && !t.archived && t.created && t.created < cutoff) {
                    tasksRef.child(id).update({ archived: true });
                    logAudit('archive', 'Auto-archived after 7 days: ' + (t.title || ''), id);
                }
            });
        }

        // ─── ROLE HELPERS ────────────────────────────────────────────────────
        function getRole() { return currentUser ? currentUser.role : 'technician'; }

        function can(perm) {
            var r = getRole();
            if (r === 'admin') return true;
            if (r === 'engineer' || r === 'leader') {
                if (perm === 'permadelete' || perm === 'manageUsers') return false;
                return true;
            }
            if (r === 'technician') {
                if (perm === 'archive' || perm === 'restore' || perm === 'delete' || perm ===
                    'permadelete' || perm === 'manageUsers') return false;
                return true;
            }
            return false;
        }

        function isAdmin() { return getRole() === 'admin'; }

        // ─── DOM REFS ──────────────────────────────────────────────────────
        var loginOverlay = document.getElementById('login-overlay');
        var loginForm = document.getElementById('login-form');
        var loginName = document.getElementById('login-name');
        var loginBadge = document.getElementById('login-badge');
        var loginBtn = document.getElementById('login-btn');
        var loginError = document.getElementById('login-error');
        var createAdminSection = document.getElementById('create-admin-section');
        var createAdminName = document.getElementById('create-admin-name');
        var createAdminBadge = document.getElementById('create-admin-badge');
        var createAdminBtn = document.getElementById('create-admin-btn');
        var createAdminError = document.getElementById('create-admin-error');

        var app = document.getElementById('app');
        var userAvatar = document.getElementById('user-avatar');
        var userNameTag = document.getElementById('user-name-tag');
        var logoutBtnVisible = document.getElementById('logout-btn-visible');

        // ─── FIREBASE REFERENCES ────────────────────────────────────────────
        var usersRef = db.ref('users');
        var tasksRef = db.ref('smt_tasks');
        var handoverRef = db.ref('smt_handovers');
        var lineReportRef = db.ref('smt_linereports');
        var auditRef = db.ref('smt_audit');

        // ─── CHECK USERS ──────────────────────────────────────────────────
        function checkUsersExist() {
            usersRef.once('value').then(function(snap) {
                var data = snap.val();
                if (data && Object.keys(data).length > 0) {
                    createAdminSection.classList.remove('show');
                    loginForm.style.display = '';
                } else {
                    createAdminSection.classList.add('show');
                    loginForm.style.display = 'none';
                }
            }).catch(console.error);
        }

        // ─── LOGIN / CREATE ADMIN ──────────────────────────────────────────
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            var name = loginName.value.trim();
            var badge = loginBadge.value.trim();
            if (!name || !badge) { loginError.textContent = 'Please enter name and badge.'; return; }
            loginError.textContent = '';
            loginBtn.disabled = true;
            loginBtn.textContent = '…';

            usersRef.child(badge).once('value').then(function(snap) {
                var userData = snap.val();
                if (userData && userData.name && userData.name.toLowerCase() === name.toLowerCase()) {
                    currentUser = { badge: badge, name: userData.name, role: userData.role || 'technician' };
                    loginSuccess();
                } else {
                    loginError.textContent = 'Invalid name or badge.';
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Sign In →';
                }
            }).catch(function(err) {
                loginError.textContent = 'Error: ' + err.message;
                loginBtn.disabled = false;
                loginBtn.textContent = 'Sign In →';
            });
        });

        createAdminBtn.addEventListener('click', function() {
            var name = createAdminName.value.trim();
            var badge = createAdminBadge.value.trim();
            if (!name || !badge) { createAdminError.textContent = 'Both fields required.'; return; }
            createAdminError.textContent = '';
            createAdminBtn.disabled = true;
            createAdminBtn.textContent = 'Creating…';

            usersRef.child(badge).once('value').then(function(snap) {
                if (snap.exists()) {
                    createAdminError.textContent = 'Badge already exists.';
                    createAdminBtn.disabled = false;
                    createAdminBtn.textContent = 'Create Admin →';
                    return;
                }
                usersRef.child(badge).set({
                    name: name,
                    role: 'admin'
                }).then(function() {
                    currentUser = { badge: badge, name: name, role: 'admin' };
                    loginSuccess();
                }).catch(function(err) {
                    createAdminError.textContent = 'Error: ' + err.message;
                    createAdminBtn.disabled = false;
                    createAdminBtn.textContent = 'Create Admin →';
                });
            }).catch(function(err) {
                createAdminError.textContent = 'Error: ' + err.message;
                createAdminBtn.disabled = false;
                createAdminBtn.textContent = 'Create Admin →';
            });
        });

        function loginSuccess() {
            // Sign into Firebase anonymously so Security Rules recognise this session
            firebase.auth().signInAnonymously().catch(function(err) {
                console.warn('Firebase anon auth failed:', err.message);
            });
            saveUser(currentUser);
            loginOverlay.classList.add('hidden');
            app.classList.add('show');
            userAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
            userNameTag.textContent = currentUser.name;
            // Sidebar user info
            var sAvatar = document.getElementById('sidebar-avatar');
            if (sAvatar) sAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
            var sName = document.getElementById('sidebar-name');
            if (sName) sName.textContent = currentUser.name;
            var sRole = document.getElementById('sidebar-role');
            if (sRole) sRole.textContent = (currentUser.role || 'technician').charAt(0).toUpperCase() + (currentUser.role || 'technician').slice(1);
            applyRoleUI();
            if (!appInitialized) { initApp(); appInitialized = true; }
            renderAll();
        }

        // ─── LOGOUT ──────────────────────────────────────────────────────────
        function logout() {
            currentUser = null;
            clearStoredUser();
            firebase.auth().signOut().catch(function() {});
            loginOverlay.classList.remove('hidden');
            app.classList.remove('show');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In →';
            loginName.value = '';
            loginBadge.value = '';
            loginError.textContent = '';
            checkUsersExist();
            showToast('Signed out');
        }

        logoutBtnVisible.addEventListener('click', logout);

        // ─── APPLY ROLE UI ──────────────────────────────────────────────────
        function applyRoleUI() {
            var r = getRole();
            var isAdmin = r === 'admin';
            var isTech = r === 'technician';
            document.getElementById('btn-users').style.display = isAdmin ? '' : 'none';
            document.getElementById('btn-archive').style.display = isTech ? 'none' : '';
            document.getElementById('btn-audit').style.display = isAdmin ? '' : 'none';
            // Sidebar
            var snavUsers = document.getElementById('snav-users');
            if (snavUsers) snavUsers.style.display = isAdmin ? '' : 'none';
            var snavAudit = document.getElementById('snav-audit');
            if (snavAudit) snavAudit.style.display = isAdmin ? '' : 'none';
        }

