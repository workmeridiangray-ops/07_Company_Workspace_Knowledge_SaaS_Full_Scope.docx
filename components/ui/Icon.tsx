const P: Record<string, string> = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10', page: 'M7 3h7l5 5v13H7zM14 3v5h5', db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  task: 'M9 11l3 3 8-8M5 5h8M5 19h14V9', goal: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z', book: 'M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11',
  cal: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4', search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5', bell: 'M6 16V11a6 6 0 1112 0v5l2 2H4zM10 21h4', users: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 3-5 6-5s6 2 6 5M17 11a3 3 0 100-6M21 20c0-2.5-1.5-4-4-4.6',
  settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12l2-1-2-4-2 .5-1.5-1L15 4h-4l-.5 2.5-1.5 1L7 7 5 11l2 1v1l-2 1 2 4 2-.5 1.5 1L11 20h4l.5-2.5 1.5-1 2 .5 2-4-2-1z', plus: 'M12 5v14M5 12h14',
  chev: 'M9 6l6 6-6 6', check: 'M5 12l5 5 9-10', x: 'M6 6l12 12M18 6L6 18', trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13', share: 'M8 12l8-5M8 12l8 5M6 9a3 3 0 100 6 3 3 0 000-6zM18 4a3 3 0 100 6 3 3 0 000-6zM18 14a3 3 0 100 6 3 3 0 000-6z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z', lock: 'M6 11h12v9H6zM8 11V8a4 4 0 118 0v3', link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  menu: 'M4 7h16M4 12h16M4 17h16', clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2', warn: 'M12 3l10 18H2zM12 10v4M12 17h.01', bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', form: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h4',
  plug: 'M9 2v6M15 2v6M6 8h12v4a6 6 0 01-12 0zM12 18v4', chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8', box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10', folder: 'M3 6h6l2 2h10v11H3z',
  building: 'M5 21V4h9v17M14 9h5v12M8 8h3M8 12h3M8 16h3', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6', download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', board: 'M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v13h-4z', history: 'M3 12a9 9 0 109-9 9 9 0 00-7 3.5M3 4v4h4M12 8v5l3 2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z', flag: 'M5 21V4h12l-2 4 2 4H5',
};
export function Icon({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) {
  return (<svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={'shrink-0 ' + className}><path d={P[name] || P.page} /></svg>);
}
