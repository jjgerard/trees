// Anonymous visit counts (how many, and from which country), nothing about individuals.
// Uses Cloudflare Web Analytics: no cookies, no IP addresses stored, no fingerprinting.
// To switch it on, paste the token from Cloudflare dashboard > Web Analytics > your site into TOKEN.
// Left empty, or if the browser sends Do Not Track, this loads nothing.
(function () {
  var TOKEN = '';
  if (!TOKEN || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  var s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: TOKEN }));
  document.head.appendChild(s);
})();
