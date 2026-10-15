// Full-screen envelope (seen from the back) that opens by breaking the wax seal.
// The folds are drawn for the real screen proportions, so the paper texture is never stretched.

function draw() {
  const W = window.innerWidth, H = window.innerHeight;
  const cx = W / 2;
  const tipY = H * 0.56;                 // where the flap's point (and the seal) sits
  const meetY = H * 0.54;                // where the side pockets meet
  const r = Math.min(W, H) * 0.045;      // rounding of the flap's point
  const inset = Math.max(10, Math.min(W, H) * 0.022);

  const pocket = document.getElementById('env-pocket');
  pocket.setAttribute('viewBox', `0 0 ${W} ${H}`);
  pocket.innerHTML = `
    <rect width="${W}" height="${H}" fill="#d6c39b"/>
    <g filter="url(#paper)">
      <path d="M0 0 L${cx} ${meetY} L${W} 0 L${W} ${H} L0 ${H} Z" fill="url(#pocketB)"/>
      <path d="M0 0 L${cx - 10} ${meetY} Q${cx} ${meetY + 10} ${cx - 10} ${meetY + 22} L0 ${H} Z" fill="url(#pocketL)"/>
      <path d="M${W} 0 L${cx + 10} ${meetY} Q${cx} ${meetY + 10} ${cx + 10} ${meetY + 22} L${W} ${H} Z" fill="url(#pocketR)"/>
      <path d="M0 ${H} L${cx - 14} ${meetY - H * 0.035} Q${cx} ${meetY - H * 0.05} ${cx + 14} ${meetY - H * 0.035} L${W} ${H} Z" fill="url(#pocketB)"/>
    </g>
    <g fill="none" stroke-linecap="round">
      <path d="M0 ${H} L${cx - 14} ${meetY - H * 0.035} Q${cx} ${meetY - H * 0.05} ${cx + 14} ${meetY - H * 0.035} L${W} ${H}" stroke="#bda679" stroke-width="1.6"/>
      <path d="M0 ${H + 3} L${cx - 14} ${meetY - H * 0.035 + 3} Q${cx} ${meetY - H * 0.05 + 3} ${cx + 14} ${meetY - H * 0.035 + 3} L${W} ${H + 3}" stroke="#fff8e8" stroke-width="1.2" opacity=".7"/>
      <path d="M0 0 L${cx - 10} ${meetY} Q${cx} ${meetY + 10} ${cx - 10} ${meetY + 22} L0 ${H} M${W} 0 L${cx + 10} ${meetY} Q${cx} ${meetY + 10} ${cx + 10} ${meetY + 22} L${W} ${H}" stroke="#c9b285" stroke-width="1.2" opacity=".8"/>
      <rect x="${inset}" y="${inset}" width="${W - inset * 2}" height="${H - inset * 2}" stroke="#c9a85a" stroke-width="1.4" opacity=".75"/>
      <rect x="${inset + 5}" y="${inset + 5}" width="${W - inset * 2 - 10}" height="${H - inset * 2 - 10}" stroke="#c9a85a" stroke-width=".8" opacity=".55"/>
    </g>`;

  const flap = document.getElementById('env-flap');
  flap.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const flapPath = `M0 0 L${W} 0 L${cx + r} ${tipY - r * 0.9} Q${cx} ${tipY + r * 0.25} ${cx - r} ${tipY - r * 0.9} Z`;
  // dotted gold line running parallel to the flap's edges
  const k = inset * 1.6;
  flap.innerHTML = `
    <path d="${flapPath}" fill="url(#flapG)" filter="url(#paper)"/>
    <path d="M0 0 L${cx - r} ${tipY - r * 0.9} Q${cx} ${tipY + r * 0.25} ${cx + r} ${tipY - r * 0.9} L${W} 0" fill="none" stroke="#b89e70" stroke-width="2"/>
    <path d="M${k} ${inset} L${cx - r * 0.8} ${tipY - r * 0.9 - k * 1.1} M${cx + r * 0.8} ${tipY - r * 0.9 - k * 1.1} L${W - k} ${inset}" fill="none" stroke="#c9a85a" stroke-width="1.6" stroke-dasharray="1 6" stroke-linecap="round" opacity=".85"/>
    <rect x="${inset}" y="${inset}" width="${W - inset * 2}" height="1.4" fill="#c9a85a" opacity=".75"/>`;

  const gate = document.getElementById('gate');
  gate.style.setProperty('--tip-y', `${tipY}px`);
}

// greeting: text written on the flap; onOpen: called the moment the seal is tapped (start music etc.);
// onDone: called when the envelope has dissolved and the page should take over.
export function initGate({ greeting, onOpen, onDone }) {
  document.getElementById('gate-to').textContent = greeting;
  draw();
  window.addEventListener('resize', draw);

  const gate = document.getElementById('gate');
  document.getElementById('open-btn').addEventListener('click', () => {
    onOpen?.();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gate.classList.add('open'); // seal cracks apart, flap swings up
    setTimeout(() => {
      gate.classList.add('opened'); // fade out, revealing the sky intro underneath
      onDone?.();
      setTimeout(() => {
        window.removeEventListener('resize', draw);
        gate.remove(); // drop the full-screen envelope and its paper filters entirely
      }, 700);
    }, reduced ? 0 : 450);
  }, { once: true });
}

