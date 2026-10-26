// Icônes en trait (24×24), dessinées à la main pour rester légères et cohérentes.
const paths = {
  today: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  hanger: 'M12 7.5a2 2 0 1 1 2-2M12 7.5v1.2L3.4 15a1.4 1.4 0 0 0 .8 2.5h15.6a1.4 1.4 0 0 0 .8-2.5L12 8.7',
  layers: 'M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5 10 17.5 19 7',
  refresh: 'M20 11a8 8 0 0 0-14.7-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.7 4.3l1.3-1.8M20 20v-4.5h-4.5',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  share: 'M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12v7.5h14V12',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5',
  camera: 'M4 8.5h3l1.8-2.5h6.4L17 8.5h3v11H4zM12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  close: 'M6 6l12 12M18 6 6 18',
  pin: 'M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  download: 'M12 3.5V15M7.5 10.5 12 15l4.5-4.5M5 19.5h14',
  upload: 'M12 15V3.5M7.5 8 12 3.5 16.5 8M5 19.5h14',
  inbox: 'M3.5 13.5 6 5h12l2.5 8.5M3.5 13.5V19h17v-5.5h-5.5l-1 2h-4l-1-2z',
  undo: 'M9 7 4.5 11.5 9 16M5 11.5h9.5a5 5 0 0 1 0 10H12',
  shield: 'M12 3 5 6v5.5c0 4.4 3 8.2 7 9.5 4-1.3 7-5.1 7-9.5V6z',
  chevron: 'M9 6l6 6-6 6',
  sun: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  cloud: 'M7 18h10a4 4 0 0 0 .4-8A6 6 0 0 0 6.1 11.6 3.3 3.3 0 0 0 7 18z',
  fog: 'M4 8h16M4 12h16M6 16h12M9 20h6',
  rain: 'M7 15h10a4 4 0 0 0 .4-8A6 6 0 0 0 6.1 8.6 3.3 3.3 0 0 0 7 15zM8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5',
  snow: 'M7 15h10a4 4 0 0 0 .4-8A6 6 0 0 0 6.1 8.6 3.3 3.3 0 0 0 7 15zM8 19h.01M12 19h.01M16 19h.01M10 21.5h.01M14 21.5h.01',
  storm: 'M7 15h10a4 4 0 0 0 .4-8A6 6 0 0 0 6.1 8.6 3.3 3.3 0 0 0 7 15zM12.5 16 10.5 19h3l-2 3',
  edit: 'M14.5 5.5l4 4M4 20l1-5L15.5 4.5l4 4L9 19z',
  scissors: 'M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8.6 7.9 20 17M8.6 16.1 20 7',
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 22, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  )
}
