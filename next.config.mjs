/** @type {import('next').NextConfig} */
const nextConfig = {
  // GitHub Pages で公開するため静的書き出しにする。
  // basePath はリポジトリ名のサブパス（例 /quizManager）。ワークフローから渡す
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
