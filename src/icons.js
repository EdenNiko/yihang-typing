// 线条图标（内嵌 SVG）。HTML 里写 <i data-icon="home"></i>，启动时统一填充
(function (TP) {
  const P = {
    logo: '<rect x=".5" y=".5" width="23" height="23" rx="5.2" fill="#fff" stroke="#cfe0f3" stroke-width=".5"/><g stroke="none"><circle cx="5.95" cy="8.67" r=".76" fill="#a9cdf0"/><circle cx="8.07" cy="8.67" r=".76" fill="#a9cdf0"/><circle cx="10.18" cy="8.67" r=".76" fill="#a9cdf0"/><rect x="4.59" y="11.39" width="8.78" height="2.42" rx="1.21" fill="#6aaeea"/><rect x="14.27" y="9.28" width=".91" height="6.81" rx=".45" fill="#3b7fcf"/><rect x="16.24" y="11.39" width="3.48" height="2.42" rx="1.21" fill="#d5e5f6"/></g>',
    home: '<path d="M3 10l9-7 9 7v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20z"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    docCheck: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.5V12l3.5 2"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9.5 2.5h5"/>',
    search: '<circle cx="11" cy="11" r="7.5"/><path d="M21 21l-4.6-4.6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    right: '<path d="M9 18l6-6-6-6"/>',
    left: '<path d="M15 18l-6-6 6-6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
    gauge: '<path d="M4.5 18a9.5 9.5 0 1 1 15 0"/><path d="M12 14l4-5"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="3.5"/><path d="M6.5 10h.01M10.2 10h.01M13.8 10h.01M17.5 10h.01M8 14h8"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/>',
    flag: '<path d="M5 21V4h13l-3 5 3 5H5"/>',
    pause: '<rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/>',
    play: '<path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor" stroke-linejoin="round"/>',
    restart: '<path d="M2 4v6h6"/><path d="M4.5 15a9 9 0 1 0 2.1-9.4L2 10"/>',
    exit: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    warn: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    winMin: '<path d="M5.5 12h13"/>',
    winMax: '<rect x="5.5" y="5.5" width="13" height="13" rx="3.2"/>',
    winRestore: '<rect x="4.5" y="8.5" width="11" height="11" rx="2.8"/><path d="M8.5 5.6a2.8 2.8 0 0 1 2.3-1.1h5.9a2.8 2.8 0 0 1 2.8 2.8v5.9a2.8 2.8 0 0 1-1.1 2.3"/>',
    winClose: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  };

  TP.icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

  TP.fillIcons = (root) => root.querySelectorAll('[data-icon]').forEach((e) => (e.innerHTML = TP.icon(e.dataset.icon)));
})((globalThis.TP = globalThis.TP || {}));
