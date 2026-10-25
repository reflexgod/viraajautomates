// One lightbox for ring cards and preview titles: an image (WebP with a JPEG
// fallback), the demo video (plays, muted, with controls), or the drawn
// "What I fix" card. The caption always carries "Demo" where the media is demo.

let box = null;

function el() {
  if (box) return box;
  box = document.querySelector('[data-lightbox]');
  if (!box) return null;
  const media = box.querySelector('[data-lightbox-media]');
  box.querySelector('[data-lightbox-close]').addEventListener('click', () => box.close());
  box.addEventListener('click', (e) => { if (e.target === box) box.close(); });
  // Stop the video when the box closes.
  box.addEventListener('close', () => { media.querySelectorAll('video').forEach((v) => v.pause()); media.replaceChildren(); });
  return box;
}

export function openLightbox({ kind = 'image', src, fallback, video, alt = '', caption = '', template }) {
  const b = el();
  if (!b) return;
  const media = b.querySelector('[data-lightbox-media]');
  if (kind === 'video') {
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.controls = true; v.preload = 'auto';
    v.setAttribute('aria-label', alt);
    if (src) v.poster = src;
    v.innerHTML = `<source src="${video}.webm" type="video/webm"><source src="${video}.mp4" type="video/mp4">`;
    media.replaceChildren(v);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) v.play().catch(() => {});
  } else if (kind === 'html') {
    media.replaceChildren(document.querySelector(template).content.cloneNode(true));
  } else {
    const pic = document.createElement('picture');
    pic.innerHTML = `<source type="image/webp" srcset="${src}"><img src="${fallback || src}" alt="">`;
    pic.querySelector('img').alt = alt;
    media.replaceChildren(pic);
  }
  b.querySelector('[data-lightbox-cap]').textContent = caption;
  b.showModal();
}
