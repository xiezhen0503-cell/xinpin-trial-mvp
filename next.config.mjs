const pagesBasePath = process.env.GITHUB_PAGES === "true" ? "/xinpin-trial-mvp" : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  outputFileTracingRoot: process.cwd(),
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: pagesBasePath,
  assetPrefix: pagesBasePath,
};

export default nextConfig;
