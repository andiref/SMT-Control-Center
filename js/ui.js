        // ─── INIT APP ──────────────────────────────────────────────────────
        var appInitialized = false;
        function initApp() {
            buildLineGrid();
            setDefaultDates();
            initListeners();
            initNav();
            initFormHandlers();
            initThemeToggles();
            updateHeader();
            setInterval(updateHeader, 60000);
        }

        function buildLineGrid() {
            var grid = document.getElementById('h-line-status');
            if (!grid) return;
            grid.innerHTML = LINES.map(function(l) {
                return '<div class="line-status-item" id="ls-' + l + '">' +
                    '<div class="ls-name">' + l + '</div>' +
                    '<div class="ls-btns">' +
                    ['OK', 'Issue', 'Down'].map(function(s) {
                        return '<button class="ls-btn' + (s === 'OK' ? ' active-OK' : '') +
                            '" data-line="' + l + '" data-status="' + s + '">' + s + '</button>';
                    }).join('') +
                    '</div>' +
                    '</div>';
            }).join('');
            document.querySelectorAll('.ls-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var line = btn.getAttribute('data-line');
                    var st = btn.getAttribute('data-status');
                    lineStatus[line] = st;
                    document.querySelectorAll('.ls-btn[data-line="' + line + '"]').forEach(function(b) {
                        b.className = 'ls-btn' + (b.getAttribute('data-status') === st ? ' active-' +
                            st : '');
                    });
                });
            });
        }

        function setDefaultDates() {
            var today = todayStr();
            var d = new Date();
            d.setDate(d.getDate() - 7);
            var week = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate())
                .padStart(2, '0');
            ['exp-from', 'hexp-from', 'lrexp-from'].forEach(function(id) {
                var el = document.getElementById(id);
                if (el) el.value = week;
            });
            ['exp-to', 'hexp-to', 'lrexp-to'].forEach(function(id) {
                var el = document.getElementById(id);
                if (el) el.value = today;
            });
            var hd = document.getElementById('h-date');
            if (hd) hd.value = today;
            var lrd = document.getElementById('lr-date');
            if (lrd) lrd.value = today;
        }

        // ─── FIREBASE LISTENERS ─────────────────────────────────────────────
        // Connection state monitoring
        db.ref('.info/connected').on('value', function(snap) {
            var connected = snap.val();
            var dd = document.getElementById('sync-dot');
            var dl = document.getElementById('sync-label');
            var md = document.getElementById('sync-dot-mobile');
            var ml = document.getElementById('sync-label-mobile');
            if (connected) {
                if (dd) dd.className = 'sync-dot live';
                if (dl) dl.textContent = 'Live — all shifts synced';
                if (md) md.className = 'sync-dot live';
                if (ml) ml.textContent = 'Live — all shifts synced';
            } else {
                if (dd) dd.className = 'sync-dot error';
                if (dl) dl.textContent = 'Offline — changes queued locally';
                if (md) md.className = 'sync-dot error';
                if (ml) ml.textContent = 'Offline — changes queued locally';
            }
        });

        function setSyncStatus(live, msg, time) {
            // Desktop sync bar
            var dd = document.getElementById('sync-dot');
            var dl = document.getElementById('sync-label');
            var dt = document.getElementById('sync-time');
            if (dd) dd.className = 'sync-dot' + (live ? ' live' : ' error');
            if (dl) dl.textContent = msg;
            if (dt && time) dt.textContent = time;
            // Mobile sync bar
            var md = document.getElementById('sync-dot-mobile');
            var ml = document.getElementById('sync-label-mobile');
            var mt = document.getElementById('sync-time-mobile');
            if (md) md.className = 'sync-dot' + (live ? ' live' : ' error');
            if (ml) ml.textContent = msg;
            if (mt && time) mt.textContent = time;
        }

        function initListeners() {
            function safeOnValue(ref, callback, errorCallback, retries) {
                retries = retries || 3;
                ref.on('value', callback, function(err) {
                    console.error('Firebase error:', err);
                    if (retries > 0) {
                        setTimeout(function() {
                            safeOnValue(ref, callback, errorCallback, retries - 1);
                        }, 2000);
                    } else if (errorCallback) {
                        errorCallback(err);
                    }
                });
            }

            safeOnValue(tasksRef, function(snap) {
                tasks = snap.val() || {};
                renderAll();
                setSyncStatus(true, 'Live — all shifts synced',
                    'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            }, function(err) {
                setSyncStatus(false, 'Error: ' + err.message, null);
            });

            safeOnValue(handoverRef.orderByChild('created').limitToLast(30), function(snap) {
                handovers = snap.val() || {};
                if (currentView === 'handover') renderHandover();
            });

            safeOnValue(lineReportRef.orderByChild('created').limitToLast(100), function(snap) {
                lineReports = snap.val() || {};
                if (currentView === 'linereport') renderLineReport();
            });

            safeOnValue(usersRef, function() {
                if (currentView === 'users' && isAdmin()) renderUserList();
                if (currentView === 'audit') populateAuditUserFilter();
            });

            safeOnValue(auditRef.orderByChild('timestamp').limitToLast(500), function(snap) {
                auditLog = snap.val() || {};
                if (currentView === 'audit') renderAudit();
            });
        }

        // ─── SHOW CONFIRM ────────────────────────────────────────────────────
        function showConfirm(title, msg, onYes) {
            document.getElementById('confirm-title').textContent = title;
            document.getElementById('confirm-msg').textContent = msg || 'This action cannot be undone.';
            document.getElementById('confirm-overlay').classList.add('show');
            confirmCallback = onYes;
        }

        document.getElementById('confirm-yes').addEventListener('click', function() {
            document.getElementById('confirm-overlay').classList.remove('show');
            if (confirmCallback) confirmCallback();
            confirmCallback = null;
        });
        document.getElementById('confirm-no').addEventListener('click', function() {
            document.getElementById('confirm-overlay').classList.remove('show');
            confirmCallback = null;
        });

        // ─── NAV ─────────────────────────────────────────────────────────────
        function initNav() {
            var navBtns = {
                'btn-board': 'board',
                'btn-add': 'add',
                'btn-linereport': 'linereport',
                'btn-handover': 'handover',
                'btn-summary': 'summary',
                'btn-archive': 'archive',
                'btn-audit': 'audit',
                'btn-users': 'users'
            };
            Object.keys(navBtns).forEach(function(id) {
                var btn = document.getElementById(id);
                if (!btn) return;
                btn.addEventListener('click', function() {
                    switchView(navBtns[id]);
                });
            });
            var auditBtn = document.getElementById('btn-audit');
            if (auditBtn) auditBtn.addEventListener('click', function() { switchView('audit'); });
            var snavAudit = document.getElementById('snav-audit');
            if (snavAudit) snavAudit.addEventListener('click', function() { switchView('audit'); });

            // Sidebar nav buttons
            document.querySelectorAll('#sidebar-nav .snav-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var target = btn.getAttribute('data-target');
                    if (target && navBtns[target]) switchView(navBtns[target]);
                });
            });
            // Sidebar logout
            var sLogout = document.getElementById('sidebar-logout-btn2');
            if (sLogout) sLogout.addEventListener('click', logout);

            document.getElementById('btn-clear-filters').addEventListener('click', function() {
                document.getElementById('fl').value = '';
                document.getElementById('fp').value = '';
                document.getElementById('fs').value = '';
                renderBoard();
            });
            document.getElementById('fl').addEventListener('change', renderBoard);
            document.getElementById('fp').addEventListener('change', renderBoard);
            document.getElementById('fs').addEventListener('change', renderBoard);
            var searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.addEventListener('input', renderBoard);
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    document.getElementById('confirm-overlay').classList.remove('show');
                }
            });
        }

        function switchView(v) {
            if (v === 'users' && !isAdmin()) { showToast('Admin only'); return; }
            if (v === 'audit' && !isAdmin()) { showToast('Admin only'); return; }
            currentView = v;
            var viewToBtn = { board: 'btn-board', add: 'btn-add', linereport: 'btn-linereport',
                handover: 'btn-handover', summary: 'btn-summary', archive: 'btn-archive', audit: 'btn-audit', users: 'btn-users' };
            ['board', 'add', 'linereport', 'handover', 'summary', 'archive', 'audit', 'users'].forEach(function(name) {
                var btn = document.getElementById('btn-' + name);
                if (btn) btn.classList.toggle('active', name === v);
            });
            // Sidebar active state
            document.querySelectorAll('#sidebar-nav .snav-btn').forEach(function(btn) {
                btn.classList.toggle('active', btn.getAttribute('data-target') === viewToBtn[v]);
            });
            document.getElementById('board-view').style.display = v === 'board' ? 'block' : 'none';
            document.getElementById('add-view').className = v === 'add' ? 'active' : '';
            document.getElementById('linereport-view').style.display = v === 'linereport' ? 'block' : 'none';
            document.getElementById('handover-view').style.display = v === 'handover' ? 'block' : 'none';
            document.getElementById('summary-view').className = v === 'summary' ? 'active' : '';
            document.getElementById('archive-view').style.display = v === 'archive' ? 'block' : 'none';
            document.getElementById('audit-view').style.display = v === 'audit' ? 'block' : 'none';
            document.getElementById('users-view').style.display = v === 'users' ? 'block' : 'none';

            if (v === 'board') renderBoard();
            if (v === 'summary') { renderSummary(); updateHeader(); updateLineGrid(); }
            if (v === 'archive') renderArchive();
            if (v === 'handover') renderHandover();
            if (v === 'linereport') renderLineReport();
            if (v === 'audit') renderAudit();
            if (v === 'users') renderUserList();
            if (v === 'add') {
                document.getElementById('f-shift').value = getShift();
                var now = new Date();
                if (!document.getElementById('f-date').value) {
                    document.getElementById('f-date').value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
                }
                if (!document.getElementById('f-time').value) {
                    document.getElementById('f-time').value = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
                }
            }
            applyRoleUI();
        }

        // ─── RENDER ALL ──────────────────────────────────────────────────────
        function renderAll() {
            updateHeader();
            updateLineGrid();
            if (currentView === 'board') renderBoard();
            if (currentView === 'summary') renderSummary();
            if (currentView === 'archive') renderArchive();
            if (currentView === 'handover') renderHandover();
            if (currentView === 'linereport') renderLineReport();
            if (currentView === 'audit') renderAudit();
            if (currentView === 'users') renderUserList();
            applyRoleUI();
        }

        // ─── UPDATE HEADER ──────────────────────────────────────────────────
        function updateHeader() {
            var now = new Date();
            var dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
            var shiftStr = getShift() + ' · ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            document.getElementById('date-label').textContent = dateStr;
            document.getElementById('shift-label').textContent = shiftStr;
            // Sidebar labels
            var ssl = document.getElementById('sidebar-shift-label');
            if (ssl) ssl.textContent = shiftStr;
            var sdl = document.getElementById('sidebar-date-label');
            if (sdl) sdl.textContent = dateStr;

            var arr = taskArray();
            var open = arr.filter(function(t) { return t.status !== 'Resolved'; }).length;
            var done = arr.filter(function(t) { return t.status === 'Resolved'; }).length;
            var crit = arr.filter(function(t) { return t.priority === 'Critical' && t.status !== 'Resolved'; }).length;

            // Mobile counts
            document.getElementById('open-count').textContent = open;
            document.getElementById('done-count').textContent = done;
            var cb = document.getElementById('critical-banner');
            if (crit > 0) { cb.style.display = ''; document.getElementById('critical-num').textContent = crit; }
            else cb.style.display = 'none';

            // Desktop counts
            var ocd = document.getElementById('open-count-desk');
            if (ocd) ocd.textContent = open;
            var dcd = document.getElementById('done-count-desk');
            if (dcd) dcd.textContent = done;
            var cbd = document.getElementById('critical-banner-desk');
            var cnd = document.getElementById('critical-num-desk');
            if (cbd && cnd) { if (crit > 0) { cbd.style.display = ''; cnd.textContent = crit; } else cbd.style.display = 'none'; }
        }

        function updateLineGrid() {
            var arr = taskArray();
            var html = LINES.map(function(l) {
                var lt = arr.filter(function(t) { return t.line === l && t.status !== 'Resolved'; });
                var cls = lt.some(function(t) { return t.priority === 'Critical'; }) ? 'crit' :
                    lt.some(function(t) { return t.priority === 'High'; }) ? 'hi' :
                    lt.length > 0 ? 'med' : 'clear';
                return '<div class="line-card ' + cls + '" data-line="' + l + '"><div class="lname">' + l +
                    '</div><div class="ldot"></div><div class="lcount">' + (lt.length ? lt.length + ' open' : 'Clear') + '</div></div>';
            }).join('');
            // Desktop grid
            var dg = document.getElementById('line-grid');
            if (dg) { dg.innerHTML = html; dg.querySelectorAll('.line-card').forEach(function(el) { el.addEventListener('click', function() { filterByLine(el.getAttribute('data-line')); }); }); }
            // Mobile grid
            var mg = document.getElementById('line-grid-mobile');
            if (mg) { mg.innerHTML = html; mg.querySelectorAll('.line-card').forEach(function(el) { el.addEventListener('click', function() { filterByLine(el.getAttribute('data-line')); }); }); }
        }

        function filterByLine(l) {
            document.getElementById('fl').value = l;
            switchView('board');
        }

        // ─── RENDER BOARD ────────────────────────────────────────────────────
        function renderBoard() {
            var fl = document.getElementById('fl').value;
            var fp = document.getElementById('fp').value;
            var fs = document.getElementById('fs').value;
            var searchTerm = document.getElementById('search-input') ? document.getElementById('search-input').value.trim().toLowerCase() : '';
            var arr = taskArray().filter(function(t) {
                if (fl && t.line !== fl) return false;
                if (fp && t.priority !== fp) return false;
                if (fs && t.status !== fs) return false;
                if (searchTerm) {
                    var combined = (t.title + ' ' + t.line + ' ' + t.category + ' ' + (t.note || '')).toLowerCase();
                    if (combined.indexOf(searchTerm) === -1) return false;
                }
                return true;
            });
            arr.sort(function(a, b) { return PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority); });
            var list = document.getElementById('task-list');
            if (!arr.length) {
                list.innerHTML =
                    '<div class="empty"><div class="empty-icon">✅</div><div>No issues match the filter</div></div>';
                return;
            }
            var isTech = getRole() === 'technician';
            list.innerHTML = arr.map(function(t) {
                var assigned = t.assignee || 'Unassigned';
                var shift = t.shift ? t.shift.split('(')[0].trim() : '';
                var time = t.time || '--:--';
                var needsRemark = t.status === 'Pending Parts' || t.status === 'Resolved' || t.status === 'In Progress';
                var hasSavedRemark = (t.partEta || t.actionNote);
                var remarkHtml = '';
                if (needsRemark) {
                    if (hasSavedRemark) {
                        remarkHtml = '<div class="task-remark-saved">' +
                            (t.partEta ? '<div class="task-remark-saved-row"><div class="task-remark-saved-lbl">Part ETA</div><div class="task-remark-saved-val">' + esc(t.partEta) + '</div></div>' : '') +
                            (t.actionNote ? '<div class="task-remark-saved-row"><div class="task-remark-saved-lbl">Action</div><div class="task-remark-saved-val">' + esc(t.actionNote) + '</div></div>' : '') +
                            '</div>' +
                            '<button class="task-remark-save" data-id="' + t._id + '" data-edit="1">✏️ Edit remark</button>';
                    } else {
                        remarkHtml = '<div class="task-remark-panel" id="remark-panel-' + t._id + '">' +
                            (t.status === 'Pending Parts' ?
                                '<div class="task-remark-row"><div class="task-remark-label">Part ETA</div><textarea class="task-remark-input" id="remark-eta-' + t._id + '" placeholder="e.g. ETA Thursday 10AM, PO#1234"></textarea></div>' : '') +
                            '<div class="task-remark-row"><div class="task-remark-label">' + (t.status === 'Pending Parts' ? 'Temp action' : t.status === 'In Progress' ? 'Action taken' : 'How solved') + '</div><textarea class="task-remark-input" id="remark-action-' + t._id + '" placeholder="' + (t.status === 'Pending Parts' ? 'e.g. Using spare unit temporarily' : t.status === 'In Progress' ? 'e.g. Replaced sensor, ran verification' : 'e.g. Replaced sensor, ran verification') + '"></textarea></div>' +
                            '</div>' +
                            '<button class="task-remark-save" data-id="' + t._id + '">💾 Save remark</button>';
                    }
                }
                var showAge = t.status !== 'Resolved' && !t.actionNote;
                var ageClass = showAge ? getAgeClass(t.created) : '';
                var ageText = showAge ? fmtAge(t.created) : '';
                var ageHtml = ageText ? '<div class="task-age ' + ageClass + '"><div class="age-dot"></div>⏱ ' + ageText + '</div>' : '';
                return '<div class="task-card" data-priority="' + t.priority + '" data-id="' + t._id + '">' +
                    '<div class="task-header">' +
                    '<div style="flex:1;min-width:0">' +
                    '<div class="task-meta">' +
                    '<span class="badge badge-line">' + t.line + '</span>' +
                    '<span class="badge badge-' + t.priority + '">' + t.priority + '</span>' +
                    '<span class="badge badge-' + statusKey(t.status) + '">' + t.status + '</span>' +
                    '</div>' +
                    '<div class="task-title">' + (CAT_ICON[t.category] || '📌') + ' ' + esc(t.title) +
                    ' <span class="toggle-arrow open">▶</span></div>' +
                    '<div class="task-info">👷 ' + esc(assigned) + (t.date ? ' · 📅 ' + esc(t.date) : (t.created ? ' · 📅 ' + esc(new Date(t.created).toISOString().slice(0,10)) : '')) + ' · 🕐 ' + esc(time) + ' · ' + esc(shift) + ' Shift</div>' +
                    ageHtml +
                    '</div>' +
                    '<button class="task-archive' + (isTech ? ' role-restricted' : '') + '" data-id="' + t._id + '" title="Archive task">📦</button>' +
                    '</div>' +
                    '<div class="task-body open" id="body-' + t._id + '">' +
                    '<div class="task-note">📝 ' + esc(t.note || 'No notes.') + '</div>' +
                    '<div class="status-row">' +
                    STATUSES.map(function(s) {
                        return '<button class="status-btn ' + (t.status === s ? 's-' + statusKey(s) : '') +
                            '" data-id="' + t._id + '" data-status="' + s + '">' + s + '</button>';
                    }).join('') +
                    '</div>' +
                    remarkHtml +
                    (function() {
                        var comments = t.comments || {};
                        var commentList = Object.keys(comments).map(function(cid) { return comments[cid]; })
                            .sort(function(a, b) { return (a.time || 0) - (b.time || 0); });
                        var count = commentList.length;
                        return '<div class="action-history-header" data-id="' + t._id + '" style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:8px 0;border-top:1px solid var(--border);margin-top:6px;font-size:11px;color:var(--muted);font-weight:600;">' +
                            '<span class="toggle-arrow" id="ah-arrow-' + t._id + '">▶</span>' +
                            '<span>📋 Action History (' + count + ')</span>' +
                            '</div>' +
                            '<div class="comment-list collapsed" id="ah-list-' + t._id + '" style="display:none;">' +
                            (commentList.length ? commentList.map(function(c) {
                                return '<div class="comment-item"><div class="comment-meta"><span class="c-author">' + esc(c.author) +
                                    '</span><span>' + fmtDate(c.time) + '</span></div><div class="comment-text">' + esc(c.text) + '</div></div>';
                            }).join('') : '<div class="comment-empty">No action history yet</div>') +
                            '</div>';
                    })() +
                    '</div>' +
                    '</div>';
            }).join('');

            document.querySelectorAll('.task-header').forEach(function(el) {
                el.addEventListener('click', function() {
                    var id = el.closest('.task-card').getAttribute('data-id');
                    var body = document.getElementById('body-' + id);
                    var arrow = el.querySelector('.toggle-arrow');
                    if (body) {
                        body.classList.toggle('open');
                        body.classList.toggle('collapsed');
                        if (arrow) arrow.classList.toggle('open');
                    }
                });
            });

            // Action History toggle
            document.querySelectorAll('.action-history-header').forEach(function(el) {
                el.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var id = el.getAttribute('data-id');
                    var list = document.getElementById('ah-list-' + id);
                    var arrow = document.getElementById('ah-arrow-' + id);
                    if (list) {
                        var isHidden = list.style.display === 'none';
                        list.style.display = isHidden ? 'block' : 'none';
                        if (arrow) arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
                    }
                });
            });

            document.querySelectorAll('.task-archive').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (!can('archive')) { showToast('Permission denied'); return; }
                    var id = btn.getAttribute('data-id');
                    var task = tasks[id];
                    var title = task ? task.title : 'this issue';
                    showConfirm('Archive "' + title + '"?', 'It will be moved to the Archive tab.',
                        function() {
                            tasksRef.child(id).update({ archived: true });
                            logAudit('archive', 'Archived: ' + title, id);
                            showToast('Issue archived 📦');
                        });
                });
            });
            document.querySelectorAll('.status-btn').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var id = btn.getAttribute('data-id');
                    var newStatus = btn.getAttribute('data-status');
                    var oldStatus = tasks[id] ? tasks[id].status : '';
                    var commentId = Date.now().toString();
                    var updates = { status: newStatus };
                    updates['comments/' + commentId] = { author: currentUser.name, text: 'Status changed from "' + oldStatus + '" to "' + newStatus + '"', time: Date.now() };
                    tasksRef.child(id).update(updates);
                    logAudit('status', 'Status: ' + oldStatus + ' → ' + newStatus + ' | ' + (tasks[id] ? tasks[id].title : ''), id);
                    showToast('Status → ' + newStatus);
                });
            });



            // Remark save button
            document.querySelectorAll('.task-remark-save').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var id = btn.getAttribute('data-id');
                    var isEdit = btn.getAttribute('data-edit') === '1';
                    if (isEdit) {
                        // Switch saved view back to edit panel
                        var task = tasks[id];
                        var panel = btn.closest('.task-body');
                        var savedEl = btn.previousElementSibling;
                        var needsEta = task && task.status === 'Pending Parts';
                        var etaVal = task ? (task.partEta || '') : '';
                        var actionVal = task ? (task.actionNote || '') : '';
                        if (savedEl) savedEl.outerHTML =
                            '<div class="task-remark-panel" id="remark-panel-' + id + '">' +
                            (needsEta ? '<div class="task-remark-row"><div class="task-remark-label">Part ETA</div><textarea class="task-remark-input" id="remark-eta-' + id + '" placeholder="e.g. ETA Thursday 10AM, PO#1234">' + esc(etaVal) + '</textarea></div>' : '') +
                            '<div class="task-remark-row"><div class="task-remark-label">' + (needsEta ? 'Temp action' : 'How solved') + '</div><textarea class="task-remark-input" id="remark-action-' + id + '" placeholder="' + (needsEta ? 'e.g. Using spare unit temporarily' : 'e.g. Replaced sensor, ran verification') + '">' + esc(actionVal) + '</textarea></div>' +
                            '</div>';
                        btn.removeAttribute('data-edit');
                        btn.textContent = '💾 Save remark';
                    } else {
                        var etaInput = document.getElementById('remark-eta-' + id);
                        var actionInput = document.getElementById('remark-action-' + id);
                        var eta = etaInput ? etaInput.value.trim() : '';
                        var action = actionInput ? actionInput.value.trim() : '';
                        // Use null to delete the field from Firebase (empty string stays truthy in hasSavedRemark check)
                        var commentId = Date.now().toString();
                        var updates = {
                            partEta:    eta    || null,
                            actionNote: action || null
                        };
                        var remarkText = '';
                        var task = tasks[id];
                        var statusLabel = task && task.status === 'In Progress' ? 'Action taken' : task && task.status === 'Pending Parts' ? 'Temp action' : 'How solved';
                        if (eta && action) remarkText = 'Updated part ETA: "' + eta + '" and ' + statusLabel.toLowerCase() + ': "' + action + '"';
                        else if (eta) remarkText = 'Updated part ETA: "' + eta + '"';
                        else if (action) remarkText = 'Updated ' + statusLabel.toLowerCase() + ': "' + action + '"';
                        else remarkText = 'Cleared remark';
                        updates['comments/' + commentId] = { author: currentUser.name, text: remarkText, time: Date.now() };
                        tasksRef.child(id).update(updates);
                        showToast(eta || action ? 'Remark saved ✓' : 'Remark cleared ✓');
                    }
                });
            });
            applyRoleUI();
        }

        // ─── RENDER SUMMARY ──────────────────────────────────────────────────
        function renderSummary() {
            var arr = taskArray();
            document.getElementById('sum-lines').innerHTML = LINES.map(function(l) {
                var lt = arr.filter(function(t) { return t.line === l; });
                var open = lt.filter(function(t) { return t.status !== 'Resolved'; }).length;
                var total = lt.length;
                var pct = total > 0 ? Math.round((lt.filter(function(t) { return t.status === 'Resolved'; })
                    .length / total) * 100) : 100;
                return '<div class="line-row"><div class="line-row-top"><span class="line-row-name">' + l +
                    '</span><span class="line-row-count">' + open + ' open / ' + total +
                    ' total</span></div><div class="progress-bar"><div class="progress-fill" style="width:' +
                    pct + '%"></div></div></div>';
            }).join('');
            var catRows = CATS.map(function(c) {
                var cnt = arr.filter(function(t) { return t.category === c && t.status !== 'Resolved'; })
                    .length;
                return cnt > 0 ? '<div class="cat-row"><span>' + (CAT_ICON[c] || '') + '  ' + c +
                    '</span><span class="cat-count">' + cnt + '</span></div>' : '';
            }).join('');
            document.getElementById('sum-cats').innerHTML = catRows ||
                '<div style="color:var(--muted);font-size:13px;padding:8px 0">All clear ✅</div>';
            document.getElementById('sum-priority').innerHTML = PRIORITIES.map(function(p) {
                var cnt = arr.filter(function(t) { return t.priority === p && t.status !== 'Resolved'; })
                    .length;
                return '<div class="prio-box c-' + p + '"><div class="pnum">' + cnt +
                    '</div><div class="plbl">' + p + '</div></div>';
            }).join('');
            var ua = arr.filter(function(t) { return (!t.assignee || t.assignee === 'Unassigned') && t.status !==
                    'Resolved'; });
            document.getElementById('sum-unassigned').innerHTML = ua.length ?
                '<div class="unassigned-card"><div class="unassigned-title">⚠️ Unassigned Issues (' + ua.length +
                ')</div>' + ua.map(function(t) { return '<div class="unassigned-item">' + t.line + ' · ' + esc(t
                        .title) + '</div>'; }).join('') + '</div>' :
                '';
            applyRoleUI();
        }

        // ─── RENDER ARCHIVE ──────────────────────────────────────────────────
        function renderArchive() {
            var arr = archivedArray();
            var list = document.getElementById('archive-list');
            if (!arr.length) {
                list.innerHTML =
                    '<div class="archive-empty"><div style="font-size:40px;margin-bottom:8px">📦</div><div>No archived issues</div></div>';
                return;
            }
            var isTech = getRole() === 'technician';
            var isAdmin = getRole() === 'admin';
            list.innerHTML = arr.map(function(t) {
                return '<div class="archive-card">' +
                    '<div class="task-meta">' +
                    '<span class="badge badge-line">' + t.line + '</span>' +
                    '<span class="badge badge-' + t.priority + '">' + t.priority + '</span>' +
                    '<span class="badge badge-' + statusKey(t.status) + '">' + t.status + '</span>' +
                    '</div>' +
                    '<div class="archive-card-title">' + (CAT_ICON[t.category] || '📌') + ' ' + esc(t.title) +
                    '</div>' +
                    '<div class="archive-card-info">👷 ' + esc(t.assignee || 'Unassigned') + ' · ' + esc(t
                        .shift || '') + '</div>' +
                    '<div class="archive-card-actions">' +
                    '<button class="restore-btn' + (isTech ? ' role-restricted' : '') + '" data-id="' + t._id +
                    '">↩ Restore</button>' +
                    '<button class="delete-btn' + (!isAdmin ? ' role-restricted' : '') + '" data-id="' + t
                    ._id + '">🗑 Delete</button>' +
                    '</div>' +
                    '</div>';
            }).join('');

            document.querySelectorAll('.restore-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    if (!can('restore')) { showToast('Permission denied'); return; }
                    var rid = btn.getAttribute('data-id');
                    var rt = tasks[rid];
                    var commentId = Date.now().toString();
                    var updates = { archived: false };
                    updates['comments/' + commentId] = { author: currentUser.name, text: 'Issue restored by ' + currentUser.name, time: Date.now() };
                    tasksRef.child(rid).update(updates);
                    logAudit('restore', 'Restored: ' + (rt ? rt.title : ''), rid);
                    showToast('Issue restored ✓');
                });
            });
            document.querySelectorAll('.delete-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    if (!can('delete')) { showToast('Permission denied'); return; }
                    var id = btn.getAttribute('data-id');
                    showConfirm('Permanently delete?', 'This cannot be undone.', function() {
                        var dt = tasks[id];
                        tasksRef.child(id).remove();
                        logAudit('delete', 'Deleted: ' + (dt ? dt.title : ''), id);
                        showToast('Permanently deleted');
                    });
                });
            });
            applyRoleUI();
        }

