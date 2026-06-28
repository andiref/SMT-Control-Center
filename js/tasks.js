            }
            editingReportId = r._id;
            document.getElementById('lr-line').value = r.line || 'L1';
            document.getElementById('lr-shift').value = r.shift || getShift();
            document.getElementById('lr-date').value = r.date || '';
            document.getElementById('lr-model').value = r.model || '';
            document.getElementById('lr-issue1').value = r.issue1 || r.issues || '';
            document.getElementById('lr-loc1').value = r.loc1 || '';
            document.getElementById('lr-qty1').value = r.qty1 || '';
            document.getElementById('lr-rootcause1').value = r.rootcause1 || r.rootcause || '';
            document.getElementById('lr-action1').value = r.action1 || r.action || '';
            document.getElementById('lr-issue2').value = r.issue2 || '';
            document.getElementById('lr-loc2').value = r.loc2 || '';
            document.getElementById('lr-qty2').value = r.qty2 || '';
            document.getElementById('lr-rootcause2').value = r.rootcause2 || '';
            document.getElementById('lr-action2').value = r.action2 || '';
            document.getElementById('lr-issue3').value = r.issue3 || '';
            document.getElementById('lr-loc3').value = r.loc3 || '';
            document.getElementById('lr-qty3').value = r.qty3 || '';
            document.getElementById('lr-rootcause3').value = r.rootcause3 || '';
            document.getElementById('lr-action3').value = r.action3 || '';
            var ct = r.ct || {};
            document.getElementById('lr-ct-printing').value = ct.Printing || '';
            document.getElementById('lr-ct-spi').value = ct.SPI || '';
            document.getElementById('lr-ct-pp1').value = ct.PP1 || '';
            document.getElementById('lr-ct-pp2').value = ct.PP2 || '';
            document.getElementById('lr-ct-pp3').value = ct.PP3 || '';
            document.getElementById('lr-notes').value = r.notes || '';
            document.getElementById('lr-edit-banner').classList.add('show');
            document.getElementById('lr-submit-btn').textContent = 'Save Edit →';
            document.getElementById('lr-submit-btn').disabled = false;
            document.getElementById('linereport-view').scrollIntoView({ behavior: 'smooth' });
        }

        function cancelEditLineReport() {
            editingReportId = null;
            document.getElementById('lr-edit-banner').classList.remove('show');
            document.getElementById('lr-submit-btn').textContent = 'Submit Line Report →';
            ['lr-model',
                'lr-issue1', 'lr-loc1', 'lr-qty1', 'lr-rootcause1', 'lr-action1',
                'lr-issue2', 'lr-loc2', 'lr-qty2', 'lr-rootcause2', 'lr-action2',
                'lr-issue3', 'lr-loc3', 'lr-qty3', 'lr-rootcause3', 'lr-action3',
                'lr-ct-printing', 'lr-ct-spi', 'lr-ct-pp1', 'lr-ct-pp2', 'lr-ct-pp3',
                'lr-notes'
            ].forEach(function(id) { document.getElementById(id).value = ''; });
            document.querySelectorAll('.issue-name-input, .issue-rca-input').forEach(function(el) { el.classList.remove('has-error'); });
            document.querySelectorAll('.issue-card-row').forEach(function(el) { el.classList.remove('has-error'); });
            var errEl = document.getElementById('lr-issue-error');
            if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
            document.getElementById('lr-submit-btn').disabled = false;
        }

        document.getElementById('lr-cancel-edit').addEventListener('click', cancelEditLineReport);

        // ─── FORM HANDLERS ───────────────────────────────────────────────────
        function initFormHandlers() {
            // Add task
            document.getElementById('f-title').addEventListener('input', function() {
                document.getElementById('submit-btn').disabled = !this.value.trim();
                var line = document.getElementById('f-line').value;
                var title = this.value.trim();
                var dup = checkDuplicateIssue(line, title);
                var warn = document.getElementById('dup-warning');
                if (dup && title.length > 5) {
                    document.getElementById('dup-line').textContent = dup.line;
                    warn.classList.add('show');
                } else {
                    warn.classList.remove('show');
                }
            });
            document.getElementById('f-line').addEventListener('change', function() {
                var title = document.getElementById('f-title').value.trim();
                var dup = checkDuplicateIssue(this.value, title);
                var warn = document.getElementById('dup-warning');
                if (dup && title.length > 5) {
                    document.getElementById('dup-line').textContent = dup.line;
                    warn.classList.add('show');
                } else {
                    warn.classList.remove('show');
                }
            });
            document.getElementById('dup-dismiss').addEventListener('click', function() {
                document.getElementById('dup-warning').classList.remove('show');
            });
            var submitDebounced = false;
            document.getElementById('submit-btn').addEventListener('click', function() {
                if (submitDebounced) return;
                submitDebounced = true;
                setTimeout(function() { submitDebounced = false; }, 300);
                var title = document.getElementById('f-title').value.trim();
                if (!title) return;
                if (!currentUser) { showToast('Not logged in'); return; }
                var newTaskRef = tasksRef.push({
                    line: document.getElementById('f-line').value,
                    category: document.getElementById('f-cat').value,
                    priority: document.getElementById('f-priority').value,
                    status: document.getElementById('f-status').value,
                    title: sanitizeFirebase(title),
                    assignee: currentUser.name,
                    date: document.getElementById('f-date').value,
                    time: document.getElementById('f-time').value,
                    shift: document.getElementById('f-shift').value,
                    note: sanitizeFirebase(document.getElementById('f-note').value.trim()),
                    created: Date.now()
                });
                var commentId = Date.now().toString();
                var commentUpdates = {};
                commentUpdates['comments/' + commentId] = { author: currentUser.name, text: 'Issue created — Status: "' + document.getElementById('f-status').value + '"', time: Date.now() };
                newTaskRef.update(commentUpdates);
                logAudit('create', 'Created: ' + title, newTaskRef.key);
                document.getElementById('f-title').value = '';
                document.getElementById('f-note').value = '';
                document.getElementById('f-date').value = '';
                document.getElementById('submit-btn').disabled = true;
                document.getElementById('dup-warning').classList.remove('show');
                switchView('board');
                showToast('Issue logged ✓');
            });

            // Handover submit
            var handoverDebounced = false;
            document.getElementById('h-submit-btn').addEventListener('click', function() {
                if (handoverDebounced) return;
                handoverDebounced = true;
                setTimeout(function() { handoverDebounced = false; }, 300);
                if (!currentUser) { showToast('Not logged in'); return; }
                if (editingHandoverId) {
                    var original = handovers[editingHandoverId];
                    if (!original) { showToast('Report not found'); return; }
                    if ((original.editCount || 0) >= 7) { showToast('Edit limit reached — no more edits allowed'); return; }
                    // Note: Edit limits are enforced client-side. For production, enforce via Firebase Security Rules.
                    // Note: Edit limits are enforced client-side. For production, enforce via Firebase Security Rules.
                    var name = original.name;
                    var data = {
                        name: sanitizeFirebase(name),
                        role: document.getElementById('h-role').value,
                        shift: document.getElementById('h-shift').value,
                        date: document.getElementById('h-date').value,
                        lineStatus: lineStatus,
                        equipment: sanitizeFirebase(document.getElementById('h-equipment').value.trim()),
                        openIssues: sanitizeFirebase(document.getElementById('h-openissues').value.trim() || ''),
                        notes: sanitizeFirebase(document.getElementById('h-notes').value.trim() || '')
                    };
                    var editCount = (original.editCount || 0) + 1;
                    data.created = original.created || Date.now();
                    data.editCount = editCount;
                    data.lastEdited = Date.now();
                    handoverRef.child(editingHandoverId).set(data);
                    logAudit('edit', 'Edited handover report', editingHandoverId);
                    showToast('Handover updated (edit ' + editCount + '/7) ✓');
                    cancelEditHandover();
                    renderHandover();
                } else {
                    var name = currentUser.name;
                    var openTasks = taskArray().filter(function(t) { return t.status !== 'Resolved'; });
                    var autoCarried = openTasks.length > 0 ? openTasks.map(function(t) { return t.line + ': ' +
                        t.title + ' [' + t.status + ']'; }).join('\n') : '';
                    var manualCarried = document.getElementById('h-openissues').value.trim();
                    handoverRef.push({
                        name: sanitizeFirebase(name),
                        role: document.getElementById('h-role').value,
                        shift: document.getElementById('h-shift').value,
                        date: document.getElementById('h-date').value,
                        lineStatus: lineStatus,
                        equipment: sanitizeFirebase(document.getElementById('h-equipment').value.trim()),
                        openIssues: sanitizeFirebase(manualCarried || autoCarried),
                        notes: sanitizeFirebase(document.getElementById('h-notes').value.trim()),
                        created: Date.now(),
                        editCount: 0
                    });
                    showToast('Handover report submitted ✓');
                    document.getElementById('h-equipment').value = '';
                    document.getElementById('h-openissues').value = '';
                    document.getElementById('h-notes').value = '';
                    Object.keys(lineStatus).forEach(function(l) { lineStatus[l] = 'OK'; });
                    document.querySelectorAll('.ls-btn').forEach(function(b) {
                        b.className = 'ls-btn' + (b.getAttribute('data-status') === 'OK' ? ' active-OK' :
                        '');
                    });
                    renderHandover();
                }
            });

            // ─── LINE REPORT VALIDATION ──────────────────────────────────────────
        function validateLineReportIssues() {
            var issues = [
                { name: 'lr-issue1', loc: 'lr-loc1', qty: 'lr-qty1', rc: 'lr-rootcause1', ac: 'lr-action1', row: 0 },
                { name: 'lr-issue2', loc: 'lr-loc2', qty: 'lr-qty2', rc: 'lr-rootcause2', ac: 'lr-action2', row: 1 },
                { name: 'lr-issue3', loc: 'lr-loc3', qty: 'lr-qty3', rc: 'lr-rootcause3', ac: 'lr-action3', row: 2 }
            ];
            var errEl = document.getElementById('lr-issue-error');
            var rows = document.querySelectorAll('.issue-card-row');
            var errors = [];

            // Clear previous error states (must happen before any checks add classes)
            document.querySelectorAll('.issue-name-input, .issue-rca-input, .issue-meta-input').forEach(function(el) { el.classList.remove('has-error'); });
            rows.forEach(function(el) { el.classList.remove('has-error'); });
            var modelEl = document.getElementById('lr-model');
            if (modelEl) modelEl.classList.remove('has-error');

            // ── Check model is filled ──
            var reportModel = sanitizeFirebase(document.getElementById('lr-model').value.trim());
            if (!reportModel) {
                errors.push('Model is required.');
                document.getElementById('lr-model').classList.add('has-error');
            }

            // ── Check date/shift: cannot submit for next shift or next day ──
            var reportDate = document.getElementById('lr-date').value;
            var reportShift = document.getElementById('lr-shift').value;
            var now = new Date();
            var todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
            var h = now.getHours();
            var currentShift = '';
            if (h >= 7 && h < 15) currentShift = 'Shift 1 (7AM-3PM)';
            else if (h >= 15 && h < 23) currentShift = 'Shift 2 (3PM-11PM)';
            else currentShift = 'Shift 3 (11PM-7AM)';

            if (reportDate > todayStr) {
                errors.push('Cannot submit a report for a future date.');
            } else if (reportDate === todayStr) {
                var shiftOrder = ['Shift 1 (7AM-3PM)', 'Shift 2 (3PM-11PM)', 'Shift 3 (11PM-7AM)'];
                if (shiftOrder.indexOf(reportShift) > shiftOrder.indexOf(currentShift)) {
                    errors.push('Cannot submit a report for a future shift.');
                }
            }

            // Must have at least issue #1 filled
            var hasAny = issues.some(function(i) { return document.getElementById(i.name).value.trim(); });
            if (!hasAny) {
                errors.push('At least one quality issue is required.');
                rows[0].classList.add('has-error');
                document.getElementById('lr-issue1').classList.add('has-error');
            }

            // Any filled issue must have name + loc + qty + root cause + corrective action
            issues.forEach(function(i, idx) {
                var nameVal = document.getElementById(i.name).value.trim();
                var locVal = document.getElementById(i.loc).value.trim();
                var qtyVal = document.getElementById(i.qty).value.trim();
                var rcVal = document.getElementById(i.rc).value.trim();
                var acVal = document.getElementById(i.ac).value.trim();
                var anyFilled = nameVal || locVal || qtyVal || rcVal || acVal;
                if (anyFilled) {
                    var missing = [];
                    if (!nameVal) { missing.push('defect name'); document.getElementById(i.name).classList.add('has-error'); rows[idx].classList.add('has-error'); }
                    if (!locVal)  { missing.push('location'); document.getElementById(i.loc).classList.add('has-error'); rows[idx].classList.add('has-error'); }
                    if (!qtyVal)  { missing.push('quantity'); document.getElementById(i.qty).classList.add('has-error'); rows[idx].classList.add('has-error'); }
                    if (!rcVal)   { missing.push('root cause'); document.getElementById(i.rc).classList.add('has-error'); }
                    if (!acVal)   { missing.push('corrective action'); document.getElementById(i.ac).classList.add('has-error'); }
                    if (missing.length) {
                        errors.push('Issue #' + (idx + 1) + ': missing ' + missing.join(', ') + '.');
                    }
                }
            });

            // ── ALL CT fields are required ──
            var ctFields = ['lr-ct-printing', 'lr-ct-spi', 'lr-ct-pp1', 'lr-ct-pp2', 'lr-ct-pp3'];
            var ctMissing = [];
            ctFields.forEach(function(id) {
                if (!document.getElementById(id).value.trim()) {
                    ctMissing.push(id.replace('lr-ct-', '').toUpperCase());
                    document.getElementById(id).classList.add('has-error');
                }
            });
            if (ctMissing.length) {
                errors.push('Machine Cycle Time required for: ' + ctMissing.join(', ') + '.');
            }

            if (errors.length) {
                errEl.textContent = '⚠️ ' + errors.join(' ');
                errEl.style.display = 'block';
                errEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                return false;
            }
            errEl.style.display = 'none';
            errEl.textContent = '';
            return true;
        }

        // Line Report submit
            var lrDebounced = false;
            document.getElementById('lr-submit-btn').addEventListener('click', function() {
                if (lrDebounced) return;
                lrDebounced = true;
                setTimeout(function() { lrDebounced = false; }, 300);
                if (!currentUser) { showToast('Not logged in'); return; }
                if (!validateLineReportIssues()) return;
                if (!editingReportId) {
                    var dup = checkDuplicateLineReport(
                        document.getElementById('lr-line').value,
                        document.getElementById('lr-date').value,
                        document.getElementById('lr-shift').value,
                        sanitizeFirebase(document.getElementById('lr-model').value.trim())
                    );
                    if (dup) {
                        showConfirm('Report already exists', 'A report for this model, line, date and shift already exists. Edit it instead?', function() {
                            startEditLineReport(dup);
                        });
                        // Temporarily override confirm button for edit context
                        var origYes = document.getElementById('confirm-yes');
                        var originalText = origYes.textContent;
                        var originalBg = origYes.style.background;
                        origYes.textContent = 'Edit ✏️';
                        origYes.style.background = 'var(--accent)';
                        var restored = false;
                        var restoreBtn = function() {
                            if (restored) return;
                            restored = true;
                            origYes.textContent = originalText;
                            origYes.style.background = originalBg;
                            document.getElementById('confirm-overlay').removeEventListener('transitionend', restoreBtn);
                        };
                        document.getElementById('confirm-overlay').addEventListener('transitionend', restoreBtn);
                        setTimeout(restoreBtn, 500); // Fallback: overlay has no CSS transition
                        return;
                    }
                }
                if (editingReportId) {
                    var original = lineReports[editingReportId];
                    if (!original) { showToast('Report not found'); return; }
                    if ((original.editCount || 0) >= 7) { showToast('Edit limit reached — no more edits allowed'); return; }
                    // Note: Edit limits are enforced client-side. For production, enforce via Firebase Security Rules.
                    // Note: Edit limits are enforced client-side. For production, enforce via Firebase Security Rules.
                    var name = original.name;
                    var data = {
                        name: name,
                        line: document.getElementById('lr-line').value,
                        shift: document.getElementById('lr-shift').value,
                        date: document.getElementById('lr-date').value,
                        model: sanitizeFirebase(document.getElementById('lr-model').value.trim()),
                        issue1: sanitizeFirebase(document.getElementById('lr-issue1').value.trim()),
                        loc1: sanitizeFirebase(document.getElementById('lr-loc1').value.trim()),
                        qty1: document.getElementById('lr-qty1').value || '',
                        rootcause1: sanitizeFirebase(document.getElementById('lr-rootcause1').value.trim()),
                        action1: sanitizeFirebase(document.getElementById('lr-action1').value.trim()),
                        issue2: sanitizeFirebase(document.getElementById('lr-issue2').value.trim()),
                        loc2: sanitizeFirebase(document.getElementById('lr-loc2').value.trim()),
                        qty2: document.getElementById('lr-qty2').value || '',
                        rootcause2: sanitizeFirebase(document.getElementById('lr-rootcause2').value.trim()),
                        action2: sanitizeFirebase(document.getElementById('lr-action2').value.trim()),
                        issue3: sanitizeFirebase(document.getElementById('lr-issue3').value.trim()),
                        loc3: sanitizeFirebase(document.getElementById('lr-loc3').value.trim()),
                        qty3: document.getElementById('lr-qty3').value || '',
                        rootcause3: sanitizeFirebase(document.getElementById('lr-rootcause3').value.trim()),
                        action3: sanitizeFirebase(document.getElementById('lr-action3').value.trim()),
                        ct: {
                            Printing: document.getElementById('lr-ct-printing').value || '',
                            SPI: document.getElementById('lr-ct-spi').value || '',
                            PP1: document.getElementById('lr-ct-pp1').value || '',
                            PP2: document.getElementById('lr-ct-pp2').value || '',
                            PP3: document.getElementById('lr-ct-pp3').value || ''
                        },
                        notes: sanitizeFirebase(document.getElementById('lr-notes').value.trim())
                    };
                    var editCount = (original.editCount || 0) + 1;
                    data.created = original.created || Date.now();
                    data.editCount = editCount;
                    data.lastEdited = Date.now();
                    lineReportRef.child(editingReportId).set(data);
                    logAudit('edit', 'Edited line report', editingReportId);
                    showToast('Report updated (edit ' + editCount + '/7) ✓');
                    cancelEditLineReport();
                    renderLineReport();
                } else {
                    var name = currentUser.name;
                    var data = {
                        name: name,
                        line: document.getElementById('lr-line').value,
                        shift: document.getElementById('lr-shift').value,
                        date: document.getElementById('lr-date').value,
                        model: sanitizeFirebase(document.getElementById('lr-model').value.trim()),
                        issue1: sanitizeFirebase(document.getElementById('lr-issue1').value.trim()),
                        loc1: sanitizeFirebase(document.getElementById('lr-loc1').value.trim()),
                        qty1: document.getElementById('lr-qty1').value || '',
                        rootcause1: sanitizeFirebase(document.getElementById('lr-rootcause1').value.trim()),
                        action1: sanitizeFirebase(document.getElementById('lr-action1').value.trim()),
                        issue2: sanitizeFirebase(document.getElementById('lr-issue2').value.trim()),
                        loc2: sanitizeFirebase(document.getElementById('lr-loc2').value.trim()),
                        qty2: document.getElementById('lr-qty2').value || '',
                        rootcause2: sanitizeFirebase(document.getElementById('lr-rootcause2').value.trim()),
                        action2: sanitizeFirebase(document.getElementById('lr-action2').value.trim()),
                        issue3: sanitizeFirebase(document.getElementById('lr-issue3').value.trim()),
                        loc3: sanitizeFirebase(document.getElementById('lr-loc3').value.trim()),
                        qty3: document.getElementById('lr-qty3').value || '',
                        rootcause3: sanitizeFirebase(document.getElementById('lr-rootcause3').value.trim()),
                        action3: sanitizeFirebase(document.getElementById('lr-action3').value.trim()),
                        ct: {
                            Printing: document.getElementById('lr-ct-printing').value || '',
                            SPI: document.getElementById('lr-ct-spi').value || '',
                            PP1: document.getElementById('lr-ct-pp1').value || '',
                            PP2: document.getElementById('lr-ct-pp2').value || '',
                            PP3: document.getElementById('lr-ct-pp3').value || ''
                        },
                        notes: sanitizeFirebase(document.getElementById('lr-notes').value.trim()),
                        created: Date.now(),
                        editCount: 0
                    };
                    lineReportRef.push(data);
                    showToast('Line report submitted ✓');
                    ['lr-model',
                        'lr-issue1', 'lr-loc1', 'lr-qty1', 'lr-rootcause1', 'lr-action1',
                        'lr-issue2', 'lr-loc2', 'lr-qty2', 'lr-rootcause2', 'lr-action2',
                        'lr-issue3', 'lr-loc3', 'lr-qty3', 'lr-rootcause3', 'lr-action3',
                        'lr-ct-printing', 'lr-ct-spi', 'lr-ct-pp1', 'lr-ct-pp2', 'lr-ct-pp3',
                        'lr-notes'
                    ].forEach(function(id) { document.getElementById(id).value = ''; });
                    var errEl = document.getElementById('lr-issue-error');
                    if (errEl) { errEl.style.display = 'none'; }
                    renderLineReport();
                }
            });

            // Line report search
            var lrSearchInput = document.getElementById('lr-search-input');
            if (lrSearchInput) {
                lrSearchInput.addEventListener('input', function() {
                    if (currentView === 'linereport') renderLineReport();
                });
            }

            // Audit log filters
            ['audit-filter-type', 'audit-filter-user', 'audit-filter-date'].forEach(function(id) {
                var el = document.getElementById(id);
                if (el) el.addEventListener('change', renderAudit);
            });
            var auditClear = document.getElementById('audit-clear-filters');
            if (auditClear) auditClear.addEventListener('click', function() {
                document.getElementById('audit-filter-type').value = '';
                document.getElementById('audit-filter-user').value = '';
                document.getElementById('audit-filter-date').value = '';
                renderAudit();
            });

            // User management
            document.getElementById('add-user-btn').addEventListener('click', function() {
                if (!isAdmin()) { showToast('Admin only'); return; }
                var name = document.getElementById('new-user-name').value.trim();
                var badge = document.getElementById('new-user-badge').value.trim();
                var role = document.getElementById('new-user-role').value;
                if (!name || !badge) {
                    document.getElementById('add-user-msg').textContent = 'Name and badge required.';
                    return;
                }
                var msgEl = document.getElementById('add-user-msg');
                msgEl.textContent = 'Adding…';
                msgEl.style.color = 'var(--muted)';
                usersRef.child(badge).once('value').then(function(snap) {
                    if (snap.exists()) {
                        msgEl.textContent = 'Badge already exists.';
                        msgEl.style.color = 'var(--critical)';
                        return;
                    }
                    return usersRef.child(badge).set({
                        name: sanitizeFirebase(name),
                        role: role
                    }).then(function() {
                        msgEl.textContent = '✅ User added!';
                        msgEl.style.color = 'var(--green)';
                        document.getElementById('new-user-name').value = '';
                        document.getElementById('new-user-badge').value = '';
                        renderUserList();
                    });
                }).catch(function(err) {
                    msgEl.textContent = 'Error: ' + err.message;
                    msgEl.style.color = 'var(--critical)';
                });
            });
        }

        // ─── RENDER USER LIST ───────────────────────────────────────────────
        // ─── RENDER AUDIT LOG ───────────────────────────────────────────────
        function renderAudit() {
            var typeFilter = document.getElementById('audit-filter-type').value;
            var userFilter = document.getElementById('audit-filter-user').value;
            var dateFilter = document.getElementById('audit-filter-date').value;
            auditRef.orderByChild('timestamp').limitToLast(500).once('value').then(function(snap) {
                var data = snap.val() || {};
                var rows = Object.keys(data).map(function(id) { return Object.assign({}, data[id], { _id: id }); })
                    .sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
                if (typeFilter) rows = rows.filter(function(r) { return r.action === typeFilter; });
                if (userFilter) rows = rows.filter(function(r) { return r.user === userFilter; });
                if (dateFilter) {
                    var d = new Date(dateFilter);
                    var start = d.getTime();
                    var end = start + 86400000;
                    rows = rows.filter(function(r) { return r.timestamp >= start && r.timestamp < end; });
                }
                var tbody = document.getElementById('audit-tbody');
                var empty = document.getElementById('audit-empty');
                var table = document.getElementById('audit-table');
                if (!rows.length) {
                    tbody.innerHTML = '';
                    table.style.display = 'none';
                    empty.style.display = 'block';
                    return;
                }
                table.style.display = 'table';
                empty.style.display = 'none';
                var badgeClass = { create: 'audit-create', status: 'audit-status', archive: 'audit-archive',
                    restore: 'audit-restore', delete: 'audit-delete', edit: 'audit-edit', comment: 'audit-comment' };
                tbody.innerHTML = rows.slice(0, 200).map(function(r) {
                    return '<tr>' +
                        '<td>' + fmtDate(r.timestamp) + '</td>' +
                        '<td>' + esc(r.user) + '</td>' +
                        '<td><span class="audit-badge ' + (badgeClass[r.action] || '') + '">' + esc(r.action) + '</span></td>' +
                        '<td>' + esc(r.details) + '</td>' +
                        '</tr>';
                }).join('');
            });
        }

        function populateAuditUserFilter() {
            var sel = document.getElementById('audit-filter-user');
            if (!sel) return;
            var currentVal = sel.value;
            usersRef.once('value').then(function(snap) {
                var data = snap.val() || {};
                var users = Object.values(data).map(function(u) { return u.name; }).filter(Boolean).sort();
                var unique = [''].concat(users.filter(function(u, i, a) { return a.indexOf(u) === i; }));
                sel.innerHTML = unique.map(function(u) {
                    return '<option value="' + esc(u) + '"' + (u === currentVal ? ' selected' : '') + '>' + (u || 'All Users') + '</option>';
                }).join('');
            });
        }

        function renderUserList() {
            if (!isAdmin()) {
                document.getElementById('user-list').innerHTML =
                    '<div style="color:var(--muted);padding:12px 0">Admin only</div>';
                return;
            }
            var el = document.getElementById('user-list');
            usersRef.once('value').then(function(snap) {
                var data = snap.val();
                if (!data) {
                    el.innerHTML = '<div style="color:var(--muted);padding:12px 0">No users found.</div>';
                    return;
                }
                var keys = Object.keys(data);
                var html = keys.map(function(badge) {
                    var u = data[badge];
                    var roleLabel = u.role || 'technician';
                    roleLabel = roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1);
                    return '<div class="user-mgmt-item">' +
                        '<div><strong>' + esc(u.name) + '</strong> <span class="badge-role">' + esc(
                            roleLabel) + '</span></div>' +
                        '<div style="display:flex;align-items:center;gap:8px">' +
                        '<span style="font-size:11px;color:var(--muted)">#' + esc(badge) + '</span>' +
                        (badge !== currentUser.badge ?
                            '<button class="delete-user" data-badge="' + badge +
                            '" title="Delete user">✕</button>' :
                            '<span style="font-size:10px;color:var(--muted)">(you)</span>') +
                        '</div>' +
                        '</div>';
                }).join('');
                el.innerHTML = html;
                document.querySelectorAll('.delete-user').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        if (!isAdmin()) return;
                        var badge = btn.getAttribute('data-badge');
                        showConfirm('Delete user?', 'This will permanently remove the user account.',
                            function() {
                                usersRef.child(badge).remove().then(function() {
                                    showToast('User deleted');
                                });
                            });
                    });
                });
            });
        }

        // ─── EXPORT FUNCTIONS ───────────────────────────────────────────────
        document.getElementById('btn-export-issues').addEventListener('click', function() {
            var range = getDateRange('exp-from', 'exp-to');
            var allTasks = Object.keys(tasks).map(function(id) { return Object.assign({}, tasks[id], { _id: id }); });
            var filtered = allTasks.filter(function(t) {
                if (t.archived) return false;
                var d = t.created ? new Date(t.created) : null;
                if (!d) return true;
                return d >= range.from && d <= range.to;
            });
            if (!filtered.length) { showToast('No issues in this date range'); return; }
            var order = ['Critical', 'High', 'Medium', 'Low'];
            filtered.sort(function(a, b) { return order.indexOf(a.priority) - order.indexOf(b.priority); });
            var rows = filtered.map(function(t) {
                return {
                    'Date Logged': fmtDate(t.created),
                    'Line': t.line || '',
                    'Shift': t.shift || '',
                    'Category': t.category || '',
                    'Priority': t.priority || '',
                    'Status': t.status || '',
                    'Title': t.title || '',
                    'Assigned To': t.assignee || '',
                    'Date Found': t.date || '',
                    'Time Found': t.time || '',
                    'Notes': t.note || '',
                    'Part ETA': t.partEta || '',
                    'Action Taken': t.actionNote || ''
                };
            });
            var ws = XLSX.utils.json_to_sheet(rows);
            autoWidth(ws, rows);
            var wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Issues');
            XLSX.writeFile(wb, 'SMT_Issues_' + todayStr() + '.xlsx');
            showToast('Exported ' + rows.length + ' issues ✓');
        });

        document.getElementById('btn-export-summary').addEventListener('click', function() {
            var range = getDateRange('exp-from', 'exp-to');
            var allTasks = Object.keys(tasks).map(function(id) { return Object.assign({}, tasks[id], { _id: id }); });
            var filtered = allTasks.filter(function(t) {
                if (t.archived) return false;
                var d = t.created ? new Date(t.created) : null;
                if (!d) return true;
                return d >= range.from && d <= range.to;
            });
            var wb = XLSX.utils.book_new();
            // By Line
            var lineRows = LINES.map(function(l) {
                var lt = filtered.filter(function(t) { return t.line === l; });
                var row = { 'Line': l, 'Total Issues': lt.length };
                ['Critical', 'High', 'Medium', 'Low'].forEach(function(p) { row[p] = lt.filter(function(t) {
                        return t.priority === p; }).length; });
                ['Open', 'In Progress', 'Pending Parts', 'Resolved'].forEach(function(s) { row[s] = lt
                        .filter(function(t) { return t.status === s; }).length; });
                return row;
            });
            var ws1 = XLSX.utils.json_to_sheet(lineRows);
            autoWidth(ws1, lineRows);
            XLSX.utils.book_append_sheet(wb, ws1, 'By Line');
            // By Category
            var catRows = CATS.map(function(c) {
                var ct = filtered.filter(function(t) { return t.category === c; });
                return { 'Category': c, 'Total': ct.length, 'Open': ct.filter(function(t) { return t
                        .status === 'Open'; }).length, 'In Progress': ct.filter(function(t) { return t
                        .status === 'In Progress'; }).length, 'Resolved': ct.filter(function(t) { return t
                        .status === 'Resolved'; }).length };
            });
            var ws2 = XLSX.utils.json_to_sheet(catRows);
            autoWidth(ws2, catRows);
            XLSX.utils.book_append_sheet(wb, ws2, 'By Category');
            // By Shift
            var shiftRows = ['Shift 1 (7AM-3PM)', 'Shift 2 (3PM-11PM)', 'Shift 3 (11PM-7AM)'].map(function(s) {
                var st = filtered.filter(function(t) { return t.shift === s; });
                var row = { 'Shift': s, 'Total Issues': st.length };
                ['Critical', 'High', 'Medium', 'Low'].forEach(function(p) { row[p] = st.filter(function(t) {
                        return t.priority === p; }).length; });
                return row;
            });
            var ws3 = XLSX.utils.json_to_sheet(shiftRows);
            autoWidth(ws3, shiftRows);
            XLSX.utils.book_append_sheet(wb, ws3, 'By Shift');
            // By Technician
            var techMap = {};
            filtered.forEach(function(t) {
                var a = t.assignee || 'Unassigned';
                if (!techMap[a]) techMap[a] = { name: a, total: 0, resolved: 0, critical: 0 };
                techMap[a].total++;
                if (t.status === 'Resolved') techMap[a].resolved++;
                if (t.priority === 'Critical') techMap[a].critical++;
            });
            var techRows = Object.values(techMap).sort(function(a, b) { return b.total - a.total; }).map(function(
                t) {
                return { 'Technician': t.name, 'Total Tasks': t.total, 'Resolved': t.resolved,
                    'Critical Issues': t.critical, 'Resolution Rate': t.total > 0 ? Math.round(t
                        .resolved / t.total * 100) + '%' : '0%' };
            });
            var ws4 = XLSX.utils.json_to_sheet(techRows.length ? techRows : [{ Note: 'No data in range' }]);
            autoWidth(ws4, techRows.length ? techRows : [{ Note: 'No data' }]);
            XLSX.utils.book_append_sheet(wb, ws4, 'By Technician');
            XLSX.writeFile(wb, 'SMT_Summary_' + todayStr() + '.xlsx');
            showToast('Summary exported — 4 sheets ✓');
        });

        document.getElementById('btn-export-handover').addEventListener('click', function() {
            var range = getDateRange('hexp-from', 'hexp-to');
            var arr = Object.keys(handovers).map(function(id) { return Object.assign({}, handovers[id], { _id: id }); });
            var filtered = arr.filter(function(r) {
                var d = r.created ? new Date(r.created) : null;
                if (!d) return true;
                return d >= range.from && d <= range.to;
            });
            if (!filtered.length) { showToast('No handover reports in this date range'); return; }
            filtered.sort(function(a, b) { return (b.created || 0) - (a.created || 0); });
            var rows = filtered.map(function(r) {
                var ls = r.lineStatus || {};
                return {
                    'Submitted At': fmtDate(r.created),
                    'Production Date': r.date || '',
                    'Submitted By': r.name || '',
                    'Role': r.role || '',
                    'Shift': r.shift || '',
                    'L1 Status': ls.L1 || '',
                    'L2 Status': ls.L2 || '',
                    'L3 Status': ls.L3 || '',
                    'L4 Status': ls.L4 || '',
                    'L5 Status': ls.L5 || '',
                    'L6 Status': ls.L6 || '',
                    'Open Issues Carried': r.openIssues || '',
                    'Equipment Notes': r.equipment || '',
                    'Notes for Next Shift': r.notes || ''
                };
            });
            var ws = XLSX.utils.json_to_sheet(rows);
            autoWidth(ws, rows);
            var wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Handover Reports');
            XLSX.writeFile(wb, 'SMT_Handover_' + todayStr() + '.xlsx');
            showToast('Exported ' + filtered.length + ' handover reports ✓');
        });

        document.getElementById('btn-export-linereport').addEventListener('click', function() {
            var range = getDateRange('lrexp-from', 'lrexp-to');
            var arr = Object.keys(lineReports).map(function(id) { return Object.assign({}, lineReports[id], { _id: id }); });
            var filtered = arr.filter(function(r) {
                var d = r.created ? new Date(r.created) : null;
                if (!d) return true;
                return d >= range.from && d <= range.to;
            });
            if (!filtered.length) { showToast('No reports in this date range'); return; }
            filtered.sort(function(a, b) { return (b.created || 0) - (a.created || 0); });
            var wb = XLSX.utils.book_new();
            // Quality
            var qRows = filtered.map(function(r) {
                return {
                    'Submitted At': fmtDate(r.created),
                    'Last Edited': r.lastEdited ? fmtDate(r.lastEdited) : '',
                    'Edit Count': r.editCount || 0,
                    'Production Date': r.date || '',
                    'Technician': r.name || '',
                    'Line': r.line || '',
                    'Shift': r.shift || '',
                    'Model': r.model || '',
                    'Issue #1': r.issue1 || r.issues || '',
                    'Location #1': r.loc1 || '',
                    'Qty #1': r.qty1 || '',
                    'Root Cause #1': r.rootcause1 || r.rootcause || '',
                    'Corrective Action #1': r.action1 || r.action || '',
                    'Issue #2': r.issue2 || '',
                    'Location #2': r.loc2 || '',
                    'Qty #2': r.qty2 || '',
                    'Root Cause #2': r.rootcause2 || '',
                    'Corrective Action #2': r.action2 || '',
                    'Issue #3': r.issue3 || '',
                    'Location #3': r.loc3 || '',
                    'Qty #3': r.qty3 || '',
                    'Root Cause #3': r.rootcause3 || '',
                    'Corrective Action #3': r.action3 || '',
                    'Notes': r.notes || ''
                };
            });
            var ws1 = XLSX.utils.json_to_sheet(qRows);
            autoWidth(ws1, qRows);
            XLSX.utils.book_append_sheet(wb, ws1, 'Quality Issues');
            // CT
            var ctRows = filtered.map(function(r) {
                var ct = r.ct || {};
                return {
                    'Submitted At': fmtDate(r.created),
                    'Last Edited': r.lastEdited ? fmtDate(r.lastEdited) : '',
                    'Edit Count': r.editCount || 0,
                    'Production Date': r.date || '',
                    'Technician': r.name || '',
                    'Line': r.line || '',
                    'Shift': r.shift || '',
                    'Model': r.model || '',
                    'Printing (s)': ct.Printing || '',
                    'SPI (s)': ct.SPI || '',
                    'P&P 1 (s)': ct.PP1 || '',
                    'P&P 2 (s)': ct.PP2 || '',
                    'P&P 3 (s)': ct.PP3 || ''
                };
            });
            var ws2 = XLSX.utils.json_to_sheet(ctRows);
            autoWidth(ws2, ctRows);
            XLSX.utils.book_append_sheet(wb, ws2, 'Machine CT');
            XLSX.writeFile(wb, 'SMT_LineReport_' + todayStr() + '.xlsx');
            showToast('Exported ' + filtered.length + ' reports — 2 sheets ✓');
        });

        // ─── STARTUP ──────────────────────────────────────────────────────────

        var stored = loadStoredUser();
        if (stored) {
            usersRef.child(stored.badge).once('value').then(function(snap) {
                var data = snap.val();
                if (data && data.name && data.name.toLowerCase() === stored.name.toLowerCase()) {
                    currentUser = { badge: stored.badge, name: data.name, role: data.role || 'technician' };
                    loginSuccess();
                } else {
                    clearStoredUser();
                    checkUsersExist();
                }
            }).catch(function() {
                clearStoredUser();
                checkUsersExist();
            });
        } else {
            checkUsersExist();
        }

        console.log('✅ SMT Report Center – CSS fully loaded, compact layout active.');
        console.log('🔒 Security: Ensure Firebase Security Rules are deployed. See documentation.');
        console.log('💾 Backup: Enable Firebase automated backups (Blaze plan) for production data.');

