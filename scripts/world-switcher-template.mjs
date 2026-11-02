const symbols = {
  photography: '<circle cx="16" cy="16" r="11"/><path d="m12 6 13 18M23 7 12 26M5 15h22M23 25 10 8M7 25 19 5"/>',
  drawings: '<path d="M6 27 12 11 28 5 22 22 6 27Zm0 0 12-12m-5-1 4-2 4 5-2 4M5 30q11-2 23-1"/>',
  writing: '<path d="M8 27C2 19 16 15 13 4c11 9 4 14 8 18 1-6 5-7 4-13 9 12 6 17 1 19M13 28c-3-6 5-8 4-14 7 5 3 9 5 14"/>'
};
export function worldStep(station, index, esc) {
  const note = { photography: 'Light & memory', drawings: 'Paper & imagination', writing: 'Ink & fire' }[station.id];
  return `<a href="#beyond-the-code-${index}" data-journey-step="${Number(index)-1}" data-world="${station.id}" style="--world-color:${station.color}"><span class="world-step-number">${index}</span><svg class="world-step-symbol" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[station.id]}</svg><small>${esc(station.title)}<em>${esc(note)}</em></small><b class="world-step-indicator" aria-hidden="true">↗</b></a>`;
}
