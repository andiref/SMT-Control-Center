        // ─── RENDER HANDOVER ──────────────────────────────────────────────
        function renderHandover() {
            var h = document.getElementById('h-shift');
            if (h) h.value = getShift();
            var d = document.getElementById('h-date');
            if (d && !d.value) { var now = new Date();
                d.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now
                    .getDate()).padStart(2, '0'); }

            var arr = Object.keys(handovers).map(function(id) { return Object.assign({}, handovers[id], { _id: id }); });
            arr.sort(function(a, b) { return (b.created || 0) - (a.created || 0); });

            var el = document.getElementById('handover-history');
            if (!arr.length) {
                el.innerHTML =
                    '<div class="handover-empty"><div style="font-size:36px;margin-bottom:8px">📋</div><div>No handover reports yet</div></div>';
                return;
            }

            var currentName = currentUser ? currentUser.name : '';

            el.innerHTML = arr.map(function(r) {
                var ls = r.lineStatus || {};
                var lsBadges = LINES.map(function(l) {
                    var st = ls[l] || 'OK';
                    return '<span class="hl-badge hl-' + st + '">' + l + ': ' + st + '</span>';
                }).join('');
                var dt = r.created ? new Date(r.created).toLocaleString([], { month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit' }) : r.date || '';
                var editCount = r.editCount || 0;
                var editsLeft = 7 - editCount;
                var isOwner = currentName.toLowerCase() === (r.name || '').toLowerCase();
                var editSection = '';
                if (isOwner && editsLeft > 0) {
                    editSection = '<button class="edit-btn" data-id="' + r._id +
                        '" data-type="handover">✏️ Edit</button>' +
                        '<div class="edit-count">' + editsLeft + ' edit' + (editsLeft > 1 ? 's' : '') +
                        ' remaining</div>';
                } else if (isOwner && editsLeft === 0) {
                    editSection = '<div class="edit-locked">🔒 Locked — no more edits allowed</div>';
                } else {
                    editSection = '<div style="font-size:10px;color:var(--muted);margin-top:8px">👁️ View only</div>';
                }
                return '<div class="handover-card">' +
                    '<div class="handover-card-header">' +
                    '<div>' +
                    '<div class="handover-card-who">' + esc(r.name) +
                    ' <span style="color:var(--muted);font-weight:400;font-size:11px">(' + esc(r.role) +
                    ')</span></div>' +
                    '<div class="handover-card-meta">' + dt + '</div>' +
                    '</div>' +
                    '<div class="handover-shift-badge">' + esc((r.shift || '').replace('Shift ', 'S')) +
                    '</div>' +
                    '</div>' +
                    '<div class="handover-section"><div class="handover-section-title">🏭 Line Status</div><div class="handover-line-row">' +
                    lsBadges + '</div></div>' +
                    (r.openIssues ? '<div class="handover-section"><div class="handover-section-title">⚠️ Open Issues Carried</div><div class="handover-text">' +
                        esc(r.openIssues) + '</div></div>' : '') +
                    (r.equipment ? '<div class="handover-section"><div class="handover-section-title">⚙️ Equipment Notes</div><div class="handover-text">' +
                        esc(r.equipment) + '</div></div>' : '') +
                    (r.notes ? '<div class="handover-section"><div class="handover-section-title">📝 Notes for Next Shift</div><div class="handover-text">' +
                        esc(r.notes) + '</div></div>' : '') +
                    editSection +
                    '</div>';
            }).join('');

            document.querySelectorAll('.edit-btn[data-type="handover"]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var id = btn.getAttribute('data-id');
                    var r = handovers[id];
                    if (r) startEditHandover(Object.assign({}, r, { _id: id }));
                });
            });
            applyRoleUI();
        }

        function startEditHandover(r) {
            if ((currentUser.name || '').toLowerCase() !== (r.name || '').toLowerCase()) {
                showToast('You are not the submitter of this report.');
                return;
            }
            editingHandoverId = r._id;
            document.getElementById('h-role').value = r.role || 'Shift Leader';
            document.getElementById('h-shift').value = r.shift || getShift();
            document.getElementById('h-date').value = r.date || '';
            document.getElementById('h-equipment').value = r.equipment || '';
            document.getElementById('h-openissues').value = r.openIssues || '';
            document.getElementById('h-notes').value = r.notes || '';
            var ls = r.lineStatus || {};
            LINES.forEach(function(l) {
                var st = ls[l] || 'OK';
                lineStatus[l] = st;
                document.querySelectorAll('.ls-btn[data-line="' + l + '"]').forEach(function(b) {
                    b.className = 'ls-btn' + (b.getAttribute('data-status') === st ? ' active-' + st : '');
                });
            });
            document.getElementById('h-submit-btn').textContent = 'Save Edit →';
            document.getElementById('h-submit-btn').disabled = false;
            showToast('Editing your handover report — save to update.');
            document.getElementById('handover-form-card').scrollIntoView({ behavior: 'smooth' });
        }

        function cancelEditHandover() {
            editingHandoverId = null;
            document.getElementById('h-submit-btn').textContent = 'Submit Handover Report →';
            document.getElementById('h-equipment').value = '';
            document.getElementById('h-openissues').value = '';
            document.getElementById('h-notes').value = '';
            LINES.forEach(function(l) {
                lineStatus[l] = 'OK';
                document.querySelectorAll('.ls-btn[data-line="' + l + '"]').forEach(function(b) {
                    b.className = 'ls-btn' + (b.getAttribute('data-status') === 'OK' ? ' active-OK' : '');
                });
            });
            document.getElementById('h-submit-btn').disabled = false;
            showToast('Edit cancelled');
        }

        // ─── RENDER LINE REPORT ────────────────────────────────────────────
        function renderLineReport() {
            var lr = document.getElementById('lr-shift');
            if (lr) lr.value = getShift();
            var ld = document.getElementById('lr-date');
            if (ld && !ld.value) { var now = new Date();
                ld.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now
                    .getDate()).padStart(2, '0'); }

            var arr = Object.keys(lineReports).map(function(id) { return Object.assign({}, lineReports[id], { _id: id }); });
            var lrSearchTerm = document.getElementById('lr-search-input') ? document.getElementById('lr-search-input').value.trim().toLowerCase() : '';
            if (lrSearchTerm) {
                arr = arr.filter(function(r) {
                    var combined = (r.model + ' ' + r.line + ' ' + r.name + ' ' + r.issue1 + ' ' + r.issue2 + ' ' + r.issue3 + ' ' + r.notes).toLowerCase();
                    return combined.indexOf(lrSearchTerm) !== -1;
                });
            }
            arr.sort(function(a, b) { return (b.created || 0) - (a.created || 0); });

            var el = document.getElementById('linereport-history');
            if (!arr.length) {
                var hasSearch = document.getElementById('lr-search-input') && document.getElementById('lr-search-input').value.trim();
                el.innerHTML =
                    '<div class="handover-empty"><div style="font-size:36px;margin-bottom:8px">📊</div><div>' + (hasSearch ? 'No reports match your search' : 'No line reports yet') + '</div></div>';
                return;
            }

            var currentName = currentUser ? currentUser.name : '';

            el.innerHTML = arr.map(function(r) {
                var dt = r.created ? new Date(r.created).toLocaleString([], { month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit' }) : r.date || '';
                var lastEd = r.lastEdited ? ' · Last edited: ' + new Date(r.lastEdited).toLocaleString([],
                    { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                var ct = r.ct || {};
                var hasQuality = r.model || r.issue1 || r.issues || r.rootcause1 || r.rootcause || r.action1 || r.action;
                var hasCT = ct.Printing || ct.SPI || ct.PP1 || ct.PP2 || ct.PP3;
                var editCount = r.editCount || 0;
                var editsLeft = 7 - editCount;
                var isOwner = currentName.toLowerCase() === (r.name || '').toLowerCase();
                var editSection = '';
                if (isOwner && editsLeft > 0) {
                    editSection = '<button class="edit-btn" data-id="' + r._id +
                        '" data-type="linereport">✏️ Edit</button>' +
                        '<div class="edit-count">' + editsLeft + ' edit' + (editsLeft > 1 ? 's' : '') +
                        ' remaining</div>';
                } else if (isOwner && editsLeft === 0) {
                    editSection = '<div class="edit-locked">🔒 Locked — no more edits allowed</div>';
                } else {
                    editSection = '<div style="font-size:10px;color:var(--muted);margin-top:8px">👁️ View only</div>';
                }

                return '<div class="handover-card">' +
                    '<div class="handover-card-header">' +
                    '<div>' +
                    '<div class="handover-card-who">' + esc(r.name) + '</div>' +
                    '<div class="handover-card-meta">Submitted: ' + dt + lastEd + (r.date ? ' · Production: ' +
                        esc(r.date) : '') + '  · ' + esc(r.shift || '') + '</div>' +
                    '</div>' +
                    '<div class="handover-shift-badge" style="background:var(--accent2);color:#000">' + esc(r
                        .line) + '</div>' +
                    '</div>' +
                    (hasQuality ?
                        '<div class="handover-section">' +
                        '<div class="handover-section-title">🔍 Quality Issues — Model: ' + esc(r.model || '-') + '</div>' +
                        (function() {
                            var issues = [
                                { name: r.issue1 || (r.issues ? r.issues.split('\n')[0] : ''), loc: r.loc1 || '', qty: r.qty1 || '', rc: r.rootcause1 || r.rootcause || '', ac: r.action1 || r.action || '' },
                                { name: r.issue2 || (r.issues ? r.issues.split('\n')[1] : ''), loc: r.loc2 || '', qty: r.qty2 || '', rc: r.rootcause2 || '', ac: r.action2 || '' },
                                { name: r.issue3 || (r.issues ? r.issues.split('\n')[2] : ''), loc: r.loc3 || '', qty: r.qty3 || '', rc: r.rootcause3 || '', ac: r.action3 || '' }
                            ];
                            var ranks = ['rank-1','rank-2','rank-3'];
                            return issues.filter(function(i) { return i.name || i.rc || i.ac; }).map(function(item, idx) {
                                var metaBadges = '';
                                if (item.loc) metaBadges += '<span style="font-size:10px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:1px 6px;color:var(--muted);margin-left:6px">' + esc(item.loc) + '</span>';
                                if (item.qty) metaBadges += '<span style="font-size:10px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:1px 6px;color:var(--accent2);margin-left:4px">×' + esc(item.qty) + '</span>';
                                return '<div class="issue-block" style="margin-bottom:8px">' +
                                    '<div class="issue-card-row" style="background:var(--surface2)">' +
                                    '<div class="issue-rank ' + ranks[idx] + '">#' + (idx + 1) + '</div>' +
                                    '<div style="font-size:13px;font-weight:600;color:var(--text);flex:1">' + esc(item.name || '—') + metaBadges + '</div>' +
                                    '</div>' +
                                    '<div class="issue-rca-block">' +
                                    (item.rc ? '<div class="issue-rca-row"><div class="issue-rca-label">Root cause</div><div style="font-size:12px;color:var(--text);padding:8px 10px;flex:1;line-height:1.5">' + esc(item.rc) + '</div></div>' : '') +
                                    (item.ac ? '<div class="issue-rca-row"><div class="issue-rca-label">Corrective action</div><div style="font-size:12px;color:var(--text);padding:8px 10px;flex:1;line-height:1.5">' + esc(item.ac) + '</div></div>' : '') +
                                    '</div>' +
                                    '</div>';
                            }).join('');
                        })() +
                        '</div>' :
                        '') +
                    (hasCT ?
                        '<div class="handover-section">' +
                        '<div class="handover-section-title">⏱ Machine CT — Model: ' + esc(r.model || '-') +
                        '</div>' +
                        '<div style="overflow-x:auto"><table class="ho-table">' +
                        '<tr><th>Printing</th><th>SPI</th><th>P&amp;P 1</th><th>P&amp;P 2</th><th>P&amp;P 3</th></tr>' +
                        '<tr>' +
                        '<td>' + (ct.Printing || '-') + 's</td>' +
                        '<td>' + (ct.SPI || '-') + 's</td>' +
                        '<td>' + (ct.PP1 || '-') + 's</td>' +
                        '<td>' + (ct.PP2 || '-') + 's</td>' +
                        '<td>' + (ct.PP3 || '-') + 's</td>' +
                        '</tr>' +
                        '</table></div>' +
                        '</div>' :
                        '') +
                    (r.notes ?
                        '<div class="handover-section">' +
                        '<div class="handover-section-title">📝 Notes</div>' +
                        '<div class="handover-text" style="white-space:pre-wrap">' + esc(r.notes) + '</div>' +
                        '</div>' :
                        '') +
                    editSection +
                    '</div>';
            }).join('');

            document.querySelectorAll('.edit-btn[data-type="linereport"]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var id = btn.getAttribute('data-id');
                    var r = lineReports[id];
                    if (r) startEditLineReport(Object.assign({}, r, { _id: id }));
                });
            });
            applyRoleUI();
        }

        function startEditLineReport(r) {
            if ((currentUser.name || '').toLowerCase() !== (r.name || '').toLowerCase()) {
                showToast('You are not the submitter of this report.');
                return;
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

