const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: "https://unspattered-cherrie-calculational.ngrok-free.dev",
      changeOrigin: true,
      secure: true,
      onProxyReq: (proxyReq) => {
        // ✅ ngrok 브라우저 경고 페이지 스킵 (서버측에서 헤더 추가 → 브라우저 CORS 영향 없음)
        proxyReq.setHeader("ngrok-skip-browser-warning", "true");
      },
    })
  );
};
