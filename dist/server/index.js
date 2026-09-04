export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const assetPath = url.pathname === '/' ? '/dist/index.html' : `/dist${url.pathname}`;
    return env.ASSETS.fetch(new Request(new URL(assetPath, url)));
  }
};
