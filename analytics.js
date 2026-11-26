// Anonymous visit counts (how many, and from which country), nothing about individuals.
// Uses Cloudflare Web Analytics: no cookies, no IP addresses stored, no fingerprinting.
// To switch it on, paste the token from Cloudflare dashboard > Web Analytics > your site into TOKEN.
// Left empty, or if the browser sends Do Not Track, this loads nothing.
(function () {
  var TOKEN = '32366b54719f41679aa810f7286f4313';   // a public site id, not a secret: it appears in the page source
  if (!TOKEN || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  var s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: TOKEN }));
  document.head.appendChild(s);
})();
